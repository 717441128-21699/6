import { Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { wsService } from '../services/websocket';
import { UserRole } from '@prisma/client';

export const createMedicalRecord = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { dispatchId } = req.params;
    const {
      chiefComplaint,
      historyOfPresentIllness,
      physicalExamination,
      vitalSignsSummary,
      fieldDiagnosis,
      treatmentProvided,
      medicationsGiven,
      proceduresPerformed,
      patientConditionAtHandover,
      handoverToHospitalStaff,
      handoverStaffName,
    } = req.body;

    const dispatch = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
      include: { call: true, patient: true, vitalSigns: true },
    });

    if (!dispatch) {
      return next(new AppError('派单不存在', 404));
    }

    const existingRecord = await prisma.medicalRecord.findUnique({
      where: { dispatchId },
    });

    if (existingRecord) {
      return next(new AppError('该派单已存在院前急救病历', 400));
    }

    if (!dispatch.handoverTime) {
      await prisma.dispatch.update({
        where: { id: dispatchId },
        data: { handoverTime: new Date() },
      });
    }

    const vs = dispatch.vitalSigns;
    const autoSummary = vs.length > 0
      ? `共记录${vs.length}次生命体征。心率: ${vs[0].heartRate ?? '-'}~${
          vs[vs.length - 1].heartRate ?? '-'
        }; 血压: ${vs[0].systolicBP ?? '-'}/${vs[0].diastolicBP ?? '-'}~${
          vs[vs.length - 1].systolicBP ?? '-'
        }/${vs[vs.length - 1].diastolicBP ?? '-'}; 血氧: ${
          vs[0].oxygenSaturation ?? '-'
        }~${vs[vs.length - 1].oxygenSaturation ?? '-'}`
      : '未记录生命体征';

    const medicalRecord = await prisma.medicalRecord.create({
      data: {
        dispatchId,
        patientId: dispatch.patient?.id,
        chiefComplaint: chiefComplaint || dispatch.call.chiefComplaint,
        historyOfPresentIllness,
        physicalExamination,
        vitalSignsSummary: vitalSignsSummary || autoSummary,
        fieldDiagnosis,
        treatmentProvided,
        medicationsGiven,
        proceduresPerformed,
        patientConditionAtHandover,
        handoverToHospitalStaff: handoverToHospitalStaff || dispatch.actualHospitalId || '',
        handoverStaffName,
      },
      include: {
        dispatch: {
          include: {
            call: true,
            patient: true,
            vehicle: true,
            actualHospital: true,
          },
        },
      },
    });

    if (dispatch.actualHospitalId) {
      const hospitalDoctors = await prisma.user.findMany({
        where: {
          hospitalId: dispatch.actualHospitalId,
          role: { in: [UserRole.DOCTOR, UserRole.HOSPITAL_STAFF] },
          isActive: true,
        },
      });

      hospitalDoctors.forEach((doctor) => {
        wsService.emitToUser(doctor.id, 'notification:created', {
          type: 'MEDICAL_RECORD_SYNCED',
          title: '院前急救电子病历已同步',
          content: `患者${dispatch.patient?.fullName || '未知'}的院前急救电子病历已生成`,
          medicalRecord,
        });
      });
    }

    wsService.broadcastDispatchUpdate(dispatchId, {
      event: 'medical_record_created',
      medicalRecord,
    });

    res.status(201).json({
      status: 'success',
      data: { medicalRecord },
    });
  }
);

export const getMedicalRecord = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { dispatchId } = req.params;

    const medicalRecord = await prisma.medicalRecord.findUnique({
      where: { dispatchId },
      include: {
        dispatch: {
          include: {
            call: true,
            patient: true,
            vehicle: true,
            vitalSigns: { orderBy: { timestamp: 'asc' } },
            actualHospital: true,
          },
        },
      },
    });

    if (!medicalRecord) {
      return next(new AppError('院前急救病历不存在', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { medicalRecord },
    });
  }
);

export const updateMedicalRecord = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { dispatchId } = req.params;
    const updateData = req.body;

    const existing = await prisma.medicalRecord.findUnique({
      where: { dispatchId },
    });

    if (!existing) {
      return next(new AppError('院前急救病历不存在', 404));
    }

    const allowedFields = [
      'chiefComplaint',
      'historyOfPresentIllness',
      'physicalExamination',
      'vitalSignsSummary',
      'fieldDiagnosis',
      'treatmentProvided',
      'medicationsGiven',
      'proceduresPerformed',
      'patientConditionAtHandover',
      'handoverToHospitalStaff',
      'handoverStaffName',
    ];

    const filteredData: any = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    }

    const medicalRecord = await prisma.medicalRecord.update({
      where: { dispatchId },
      data: filteredData,
      include: {
        dispatch: {
          include: { call: true, patient: true, actualHospital: true },
        },
      },
    });

    res.status(200).json({
      status: 'success',
      data: { medicalRecord },
    });
  }
);

export const syncToHospital = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { dispatchId } = req.params;

    const medicalRecord = await prisma.medicalRecord.findUnique({
      where: { dispatchId },
      include: {
        dispatch: {
          include: {
            call: true,
            patient: true,
            vitalSigns: true,
            actualHospital: true,
          },
        },
      },
    });

    if (!medicalRecord) {
      return next(new AppError('院前急救病历不存在', 404));
    }

    const updated = await prisma.medicalRecord.update({
      where: { dispatchId },
      data: {
        syncedToHospital: true,
        syncedAt: new Date(),
      },
      include: {
        dispatch: {
          include: { actualHospital: true },
        },
      },
    });

    if (medicalRecord.dispatch?.actualHospital?.staff) {
      medicalRecord.dispatch.actualHospital.staff
        .filter((s) => s.role === UserRole.DOCTOR || s.role === UserRole.HOSPITAL_STAFF)
        .forEach((staff) => {
          wsService.emitToUser(staff.id, 'notification:created', {
            type: 'MEDICAL_RECORD_SYNCED',
            medicalRecord: updated,
          });
        });
    }

    wsService.broadcastDispatchUpdate(dispatchId, {
      event: 'record_synced',
      medicalRecord: updated,
    });

    res.status(200).json({
      status: 'success',
      message: '院前急救电子病历已成功同步到院内系统',
      data: { medicalRecord: updated },
    });
  }
);

export const listMedicalRecords = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      hospitalId,
      dateFrom,
      dateTo,
      synced,
      fieldDiagnosis,
    } = req.query;

    const where: any = {};
    if (hospitalId) {
      where.dispatch = { actualHospitalId: hospitalId as string };
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }
    if (synced !== undefined) where.syncedToHospital = synced === 'true';
    if (fieldDiagnosis)
      where.fieldDiagnosis = { contains: fieldDiagnosis as string };

    const records = await prisma.medicalRecord.findMany({
      where,
      include: {
        dispatch: {
          include: {
            call: true,
            patient: true,
            vehicle: true,
            actualHospital: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.status(200).json({
      status: 'success',
      data: { records },
    });
  }
);
