import { Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import {
  checkVitalSignAbnormal,
  generateDiagnosisSuggestion,
} from '../utils/emergency';
import { wsService } from '../services/websocket';
import {
  AlertSeverity,
  AlertStatus,
  UserRole,
} from '../utils/enums';

export const uploadVitalSigns = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { dispatchId } = req.params;
    const {
      heartRate,
      systolicBP,
      diastolicBP,
      oxygenSaturation,
      respiratoryRate,
      temperature,
      ecgData,
      consciousness,
      notes,
    } = req.body;

    const dispatch = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
    });

    if (!dispatch) {
      return next(new AppError('派单不存在', 404));
    }

    const call = dispatch.callId
      ? await prisma.emergencyCall.findUnique({ where: { id: dispatch.callId } })
      : null;
    const actualHospital = dispatch.actualHospitalId
      ? await prisma.hospital.findUnique({ where: { id: dispatch.actualHospitalId } })
      : null;
    const hospitalDoctors = dispatch.actualHospitalId
      ? await prisma.user.findMany({
          where: { hospitalId: dispatch.actualHospitalId, role: UserRole.DOCTOR, isActive: true },
        })
      : [];

    const checkResult = checkVitalSignAbnormal({
      heartRate,
      systolicBP,
      diastolicBP,
      oxygenSaturation,
      respiratoryRate,
      temperature,
    });

    const vitalSign = await prisma.vitalSign.create({
      data: {
        dispatchId,
        timestamp: new Date(),
        heartRate,
        systolicBP,
        diastolicBP,
        oxygenSaturation,
        respiratoryRate,
        temperature,
        ecgData,
        consciousness,
        isAbnormal: checkResult.isAbnormal,
        notes,
      },
    });

    wsService.emitToRoles(
      [UserRole.DISPATCHER, UserRole.PARAMEDIC, UserRole.DOCTOR, UserRole.HOSPITAL_STAFF],
      'vitalsign:created',
      vitalSign
    );

    if (checkResult.isAbnormal) {
      const diagnosisSuggestion = generateDiagnosisSuggestion(
        checkResult.abnormalities,
        call?.chiefComplaint || ''
      );

      const alert = await prisma.$transaction(async (tx) => {
        const newAlert = await tx.alert.create({
          data: {
            type: 'VITAL_SIGN_ABNORMAL',
            severity:
              checkResult.severity === 'CRITICAL'
                ? AlertSeverity.CRITICAL
                : checkResult.severity === 'WARNING'
                ? AlertSeverity.WARNING
                : AlertSeverity.INFO,
            status: AlertStatus.PENDING,
            dispatchId,
            vitalSignId: vitalSign.id,
            message: `生命体征异常：${checkResult.abnormalities.join('；')}`,
            diagnosisSuggestion,
          },
        });

        const patient = dispatch.id
          ? await tx.patient.findUnique({ where: { dispatchId: dispatch.id } })
          : null;
        const vehicle = dispatch.vehicleId
          ? await tx.vehicle.findUnique({ where: { id: dispatch.vehicleId } })
          : null;

        const enrichedAlert = {
          ...newAlert,
          vitalSign,
          dispatch: {
            ...dispatch,
            call: call
              ? { ...call, symptoms: JSON.parse(call.symptoms || '[]') }
              : null,
            patient,
            vehicle,
          },
        };

        const recipients: { alertId: string; userId: string }[] = [];

        const dispatchers = await tx.user.findMany({
          where: { role: UserRole.DISPATCHER, isActive: true },
          select: { id: true },
        });
        dispatchers.forEach((d) =>
          recipients.push({ alertId: newAlert.id, userId: d.id })
        );

        const paramedics = await tx.user.findMany({
          where: {
            teamId: dispatch.assignedTeamId ? dispatch.assignedTeamId : undefined,
            isActive: true,
          },
          select: { id: true },
        });
        paramedics.forEach((p) => {
          if (!recipients.some((r) => r.userId === p.id)) {
            recipients.push({ alertId: newAlert.id, userId: p.id });
          }
        });

        hospitalDoctors.forEach((doc) => {
          if (!recipients.some((r) => r.userId === doc.id)) {
            recipients.push({ alertId: newAlert.id, userId: doc.id });
          }
        });

        if (recipients.length > 0) {
          await tx.alertRecipient.createMany({
            data: recipients,
          });
        }

        return enrichedAlert;
      });

      wsService.broadcastAlert(alert);

      dispatch.assignedTeamId &&
        (async () => {
          const teamMembers = await prisma.user.findMany({
            where: { teamId: dispatch.assignedTeamId },
          });
          teamMembers.forEach((m) => {
            wsService.emitToUser(m.id, 'alert:created', alert);
          });
        })();
    }

    res.status(201).json({
      status: 'success',
      data: {
        vitalSign,
        abnormal: checkResult.isAbnormal,
        abnormalities: checkResult.abnormalities,
        severity: checkResult.severity,
      },
    });
  }
);

export const listVitalSigns = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { dispatchId } = req.params;

    const vitalSigns = await prisma.vitalSign.findMany({
      where: { dispatchId },
      orderBy: { timestamp: 'asc' },
    });

    res.status(200).json({
      status: 'success',
      data: { vitalSigns },
    });
  }
);

export const listAlerts = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { status, severity, dispatchId, userId } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (dispatchId) where.dispatchId = dispatchId as string;

    let alertIds: string[] | null = null;
    if (userId) {
      const recipients = await prisma.alertRecipient.findMany({
        where: { userId: userId as string },
        select: { alertId: true },
      });
      alertIds = recipients.map((r) => r.alertId);
      where.id = { in: alertIds };
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const enrichedAlerts = await Promise.all(
      alerts.map(async (a) => {
        const dispatch = a.dispatchId
          ? await prisma.dispatch.findUnique({ where: { id: a.dispatchId } })
          : null;
        const call = dispatch?.callId
          ? await prisma.emergencyCall.findUnique({ where: { id: dispatch.callId } })
          : null;
        const patient = dispatch?.id
          ? await prisma.patient.findUnique({ where: { dispatchId: dispatch.id } })
          : null;
        const vehicle = dispatch?.vehicleId
          ? await prisma.vehicle.findUnique({ where: { id: dispatch.vehicleId } })
          : null;
        const vitalSign = a.vitalSignId
          ? await prisma.vitalSign.findUnique({ where: { id: a.vitalSignId } })
          : null;
        const recipients = await prisma.alertRecipient.findMany({
          where: { alertId: a.id },
        });
        const recipientsWithUser = await Promise.all(
          recipients.map(async (r) => {
            const user = await prisma.user.findUnique({
              where: { id: r.userId },
              select: { id: true, fullName: true },
            });
            return { ...r, user };
          })
        );
        return {
          ...a,
          dispatch: dispatch
            ? {
                ...dispatch,
                call: call
                  ? { ...call, symptoms: JSON.parse(call.symptoms || '[]') }
                  : null,
                patient,
                vehicle,
              }
            : null,
          vitalSign,
          recipients: recipientsWithUser,
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: { alerts: enrichedAlerts },
    });
  }
);

export const acknowledgeAlert = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('请先登录', 401));
    }

    const { id } = req.params;

    const alert = await prisma.alert.findUnique({
      where: { id },
    });

    if (!alert) {
      return next(new AppError('预警不存在', 404));
    }

    const updatedAlert = await prisma.$transaction(async (tx) => {
      const updated = await tx.alert.update({
        where: { id },
        data: {
          status: AlertStatus.ACKNOWLEDGED,
          acknowledgedAt: new Date(),
        },
      });

      await tx.alertRecipient.updateMany({
        where: { alertId: id, userId: req.user!.id, readAt: null },
        data: { readAt: new Date() },
      });

      const dispatch = updated.dispatchId
        ? await tx.dispatch.findUnique({ where: { id: updated.dispatchId } })
        : null;
      const call = dispatch?.callId
        ? await tx.emergencyCall.findUnique({ where: { id: dispatch.callId } })
        : null;
      const vitalSign = updated.vitalSignId
        ? await tx.vitalSign.findUnique({ where: { id: updated.vitalSignId } })
        : null;

      return {
        ...updated,
        dispatch: dispatch
          ? {
              ...dispatch,
              call: call
                ? { ...call, symptoms: JSON.parse(call.symptoms || '[]') }
                : null,
            }
          : null,
        vitalSign,
      };
    });

    wsService.emitToRoles(
      [UserRole.DISPATCHER, UserRole.PARAMEDIC, UserRole.DOCTOR],
      'alert:updated',
      { alert: updatedAlert, event: 'acknowledged', userId: req.user.id }
    );

    res.status(200).json({
      status: 'success',
      data: { alert: updatedAlert },
    });
  }
);

export const resolveAlert = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const alert = await prisma.alert.findUnique({
      where: { id },
    });

    if (!alert) {
      return next(new AppError('预警不存在', 404));
    }

    const updated = await prisma.alert.update({
      where: { id },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedAt: new Date(),
      },
    });

    const dispatch = updated.dispatchId
      ? await prisma.dispatch.findUnique({ where: { id: updated.dispatchId } })
      : null;
    const call = dispatch?.callId
      ? await prisma.emergencyCall.findUnique({ where: { id: dispatch.callId } })
      : null;
    const vitalSign = updated.vitalSignId
      ? await prisma.vitalSign.findUnique({ where: { id: updated.vitalSignId } })
      : null;

    const updatedAlert = {
      ...updated,
      dispatch: dispatch
        ? {
            ...dispatch,
            call: call
              ? { ...call, symptoms: JSON.parse(call.symptoms || '[]') }
              : null,
          }
        : null,
      vitalSign,
    };

    wsService.emitToRoles(
      [UserRole.DISPATCHER, UserRole.PARAMEDIC, UserRole.DOCTOR],
      'alert:updated',
      { alert: updatedAlert, event: 'resolved' }
    );

    res.status(200).json({
      status: 'success',
      data: { alert: updatedAlert },
    });
  }
);
