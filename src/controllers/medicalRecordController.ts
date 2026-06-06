import { Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { wsService } from '../services/websocket';
import { UserRole } from '../utils/enums';

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
    });

    if (!dispatch) {
      return next(new AppError('派单不存在', 404));
    }

    const call = dispatch.callId
      ? await prisma.emergencyCall.findUnique({ where: { id: dispatch.callId } })
      : null;
    const patient = dispatch.id
      ? await prisma.patient.findUnique({ where: { dispatchId: dispatch.id } })
      : null;
    const vitalSigns = await prisma.vitalSign.findMany({
      where: { dispatchId },
      orderBy: { timestamp: 'asc' },
    });
    const vehicle = dispatch.vehicleId
      ? await prisma.vehicle.findUnique({ where: { id: dispatch.vehicleId } })
      : null;
    const actualHospital = dispatch.actualHospitalId
      ? await prisma.hospital.findUnique({ where: { id: dispatch.actualHospitalId } })
      : null;

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

    const vs = vitalSigns;
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
        patientId: patient?.id,
        chiefComplaint: chiefComplaint || call?.chiefComplaint || '',
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
    });

    const enrichedRecord = {
      ...medicalRecord,
      dispatch: {
        ...dispatch,
        call: call
          ? { ...call, symptoms: JSON.parse(call.symptoms || '[]') }
          : null,
        patient,
        vehicle,
        actualHospital: actualHospital
          ? { ...actualHospital, specialties: JSON.parse(actualHospital.specialties || '[]') }
          : null,
      },
    };

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
          content: `患者${patient?.fullName || '未知'}的院前急救电子病历已生成`,
          medicalRecord: enrichedRecord,
        });
      });
    }

    wsService.broadcastDispatchUpdate(dispatchId, {
      event: 'medical_record_created',
      medicalRecord: enrichedRecord,
    });

    res.status(201).json({
      status: 'success',
      data: { medicalRecord: enrichedRecord },
    });
  }
);

export const getMedicalRecord = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { dispatchId } = req.params;

    const medicalRecord = await prisma.medicalRecord.findUnique({
      where: { dispatchId },
    });

    if (!medicalRecord) {
      return next(new AppError('院前急救病历不存在', 404));
    }

    const dispatch = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
    });
    const call = dispatch?.callId
      ? await prisma.emergencyCall.findUnique({ where: { id: dispatch.callId } })
      : null;
    const patient = dispatch?.id
      ? await prisma.patient.findUnique({ where: { dispatchId: dispatch.id } })
      : null;
    const vehicle = dispatch?.vehicleId
      ? await prisma.vehicle.findUnique({ where: { id: dispatch.vehicleId } })
      : null;
    const vitalSigns = await prisma.vitalSign.findMany({
      where: { dispatchId },
      orderBy: { timestamp: 'asc' },
    });
    const actualHospital = dispatch?.actualHospitalId
      ? await prisma.hospital.findUnique({ where: { id: dispatch.actualHospitalId } })
      : null;

    const enrichedRecord = {
      ...medicalRecord,
      dispatch: dispatch
        ? {
            ...dispatch,
            call: call
              ? { ...call, symptoms: JSON.parse(call.symptoms || '[]') }
              : null,
            patient,
            vehicle,
            vitalSigns,
            actualHospital: actualHospital
              ? { ...actualHospital, specialties: JSON.parse(actualHospital.specialties || '[]') }
              : null,
          }
        : null,
    };

    res.status(200).json({
      status: 'success',
      data: { medicalRecord: enrichedRecord },
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
    });

    const dispatch = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
    });
    const call = dispatch?.callId
      ? await prisma.emergencyCall.findUnique({ where: { id: dispatch.callId } })
      : null;
    const patient = dispatch?.id
      ? await prisma.patient.findUnique({ where: { dispatchId: dispatch.id } })
      : null;
    const actualHospital = dispatch?.actualHospitalId
      ? await prisma.hospital.findUnique({ where: { id: dispatch.actualHospitalId } })
      : null;

    const enrichedRecord = {
      ...medicalRecord,
      dispatch: dispatch
        ? {
            ...dispatch,
            call: call
              ? { ...call, symptoms: JSON.parse(call.symptoms || '[]') }
              : null,
            patient,
            actualHospital: actualHospital
              ? { ...actualHospital, specialties: JSON.parse(actualHospital.specialties || '[]') }
              : null,
          }
        : null,
    };

    res.status(200).json({
      status: 'success',
      data: { medicalRecord: enrichedRecord },
    });
  }
);

export const syncToHospital = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { dispatchId } = req.params;

    const medicalRecord = await prisma.medicalRecord.findUnique({
      where: { dispatchId },
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
    });

    const dispatch = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
    });
    const call = dispatch?.callId
      ? await prisma.emergencyCall.findUnique({ where: { id: dispatch.callId } })
      : null;
    const patient = dispatch?.id
      ? await prisma.patient.findUnique({ where: { dispatchId: dispatch.id } })
      : null;
    const vitalSigns = await prisma.vitalSign.findMany({
      where: { dispatchId },
    });
    const actualHospital = dispatch?.actualHospitalId
      ? await prisma.hospital.findUnique({ where: { id: dispatch.actualHospitalId } })
      : null;
    const hospitalDoctors = dispatch?.actualHospitalId
      ? await prisma.user.findMany({
          where: {
            hospitalId: dispatch.actualHospitalId,
            role: { in: [UserRole.DOCTOR, UserRole.HOSPITAL_STAFF] },
            isActive: true,
          },
        })
      : [];

    const enrichedUpdated = {
      ...updated,
      dispatch: dispatch
        ? {
            ...dispatch,
            call: call
              ? { ...call, symptoms: JSON.parse(call.symptoms || '[]') }
              : null,
            patient,
            vitalSigns,
            actualHospital: actualHospital
              ? {
                  ...actualHospital,
                  specialties: JSON.parse(actualHospital.specialties || '[]'),
                  staff: hospitalDoctors,
                }
              : null,
          }
        : null,
    };

    if (enrichedUpdated.dispatch?.actualHospital?.staff) {
      enrichedUpdated.dispatch.actualHospital.staff
        .filter((s: any) => s.role === UserRole.DOCTOR || s.role === UserRole.HOSPITAL_STAFF)
        .forEach((staff: any) => {
          wsService.emitToUser(staff.id, 'notification:created', {
            type: 'MEDICAL_RECORD_SYNCED',
            medicalRecord: enrichedUpdated,
          });
        });
    }

    wsService.broadcastDispatchUpdate(dispatchId, {
      event: 'record_synced',
      medicalRecord: enrichedUpdated,
    });

    res.status(200).json({
      status: 'success',
      message: '院前急救电子病历已成功同步到院内系统',
      data: { medicalRecord: enrichedUpdated },
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
      const dispatchesWithHospital = await prisma.dispatch.findMany({
        where: { actualHospitalId: hospitalId as string },
        select: { id: true },
      });
      where.dispatchId = { in: dispatchesWithHospital.map((d) => d.id) };
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
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const enrichedRecords = await Promise.all(
      records.map(async (r) => {
        const dispatch = r.dispatchId
          ? await prisma.dispatch.findUnique({ where: { id: r.dispatchId } })
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
        const actualHospital = dispatch?.actualHospitalId
          ? await prisma.hospital.findUnique({ where: { id: dispatch.actualHospitalId } })
          : null;
        return {
          ...r,
          dispatch: dispatch
            ? {
                ...dispatch,
                call: call
                  ? { ...call, symptoms: JSON.parse(call.symptoms || '[]') }
                  : null,
                patient,
                vehicle,
                actualHospital: actualHospital
                  ? { ...actualHospital, specialties: JSON.parse(actualHospital.specialties || '[]') }
                  : null,
              }
            : null,
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: { records: enrichedRecords },
    });
  }
);
