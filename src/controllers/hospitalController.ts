import { Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { calculateDistance } from '../utils/emergency';
import { wsService } from '../services/websocket';
import { UserRole, EmergencyLevel } from '../utils/enums';

export interface HospitalRecommendation {
  id: string;
  name: string;
  address: string;
  distance: number;
  estimatedTravelMinutes: number;
  erLoadLevel: number;
  erBedsAvailable: number;
  erDoctorsOnDuty: number;
  hasRequiredSpecialty: boolean;
  trafficFactor: number;
  score: number;
  specialties: string[];
  departments: { id: string; name: string; available: boolean }[];
}

const TRAFFIC_CONGESTION_FACTORS = [1.0, 1.2, 1.5, 2.0, 2.5];

function getTrafficFactor(hour: number): number {
  if (hour >= 7 && hour <= 9) return TRAFFIC_CONGESTION_FACTORS[4];
  if (hour >= 11 && hour <= 13) return TRAFFIC_CONGESTION_FACTORS[2];
  if (hour >= 17 && hour <= 19) return TRAFFIC_CONGESTION_FACTORS[3];
  if (hour >= 22 || hour <= 5) return TRAFFIC_CONGESTION_FACTORS[0];
  return TRAFFIC_CONGESTION_FACTORS[1];
}

function matchSpecialties(
  hospitalSpecialties: string[], symptoms: string[], chiefComplaint: string): boolean {
  const allText = (chiefComplaint + ' ' + symptoms.join(' ')).toLowerCase();
  
  const specialtyMappings: Record<string, string[]> = {
    cardiology: ['心', '胸痛', '胸闷', '心梗', '心脏', '心搏'],
    neurology: ['脑', '中风', '卒中', '昏迷', '偏瘫', '头痛', '癫痫'],
    emergency: ['外伤', '创伤', '车祸', '坠落', '骨折', '出血'],
    respiration: ['呼吸', '喘', '肺', '窒息', '哮喘'],
    gastroenterology: ['肚子', '腹痛', '呕吐', '胃肠', '消化'],
    pediatrics: ['小孩', '儿童', '婴儿'],
    obstetrics: ['孕妇', '分娩', '产科', '怀孕'],
    psychiatry: ['精神', '心理'],
    burn: ['烧伤', '烫伤'],
  };

  let requiredSpecialties: string[] = [];
  for (const [specialty, keywords] of Object.entries(specialtyMappings)) {
    for (const keyword of keywords) {
      if (allText.includes(keyword)) {
        requiredSpecialties.push(specialty);
        break;
      }
    }
  }

  if (requiredSpecialties.length === 0) return true;

  return requiredSpecialties.some((rs) =>
    hospitalSpecialties.some((hs) => hs.toLowerCase().includes(rs))
  );
}

export const recommendHospital = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { dispatchId } = req.params;
    const { latitude, longitude } = req.query;

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

    const targetLat = latitude
      ? parseFloat(latitude as string)
      : call?.locationLatitude ?? 0;
    const targetLon = longitude
      ? parseFloat(longitude as string)
      : call?.locationLongitude ?? 0;

    const hospitals = await prisma.hospital.findMany({
      where: { hasER: true },
    });

    const departments = await prisma.hospitalDepartment.findMany({
      where: { available: true },
    });

    const hospitalDepartmentsMap = new Map<string, typeof departments>();
    for (const dept of departments) {
      if (!hospitalDepartmentsMap.has(dept.hospitalId)) {
        hospitalDepartmentsMap.set(dept.hospitalId, []);
      }
      hospitalDepartmentsMap.get(dept.hospitalId)!.push(dept);
    }

    const currentHour = new Date().getHours();
    const trafficFactor = getTrafficFactor(currentHour);
    const avgSpeedKmh = 45;

    const recommendations: HospitalRecommendation[] = [];

    for (const hospital of hospitals) {
      const distance = calculateDistance(
        targetLat,
        targetLon,
        hospital.latitude,
        hospital.longitude
      );

      const hospitalSpecialties = JSON.parse(hospital.specialties || '[]');
      const callSymptoms = call ? JSON.parse(call.symptoms || '[]') : [];

      const estimatedTravelMinutes = (distance / avgSpeedKmh) * 60 * trafficFactor;
      const hasRequired = matchSpecialties(
        hospitalSpecialties,
        callSymptoms,
        call?.chiefComplaint || ''
      );

      let score = 0;
      score -= distance * 5;
      score -= estimatedTravelMinutes * 3;
      score -= hospital.erLoadLevel * 15;

      const availableBeds = hospital.erBedsTotal - hospital.erBedsOccupied;
      score += Math.max(0, availableBeds) * 2;
      score += hospital.erDoctorsOnDuty * 3;

      if (hasRequired) score += 30;

      if (dispatch.level === EmergencyLevel.CRITICAL) {
        score += 50;
        if (estimatedTravelMinutes < 10) score += 40;
        if (estimatedTravelMinutes < 15) score += 20;
        if (hospital.erLoadLevel < 0.5) score += 30;
      } else if (dispatch.level === EmergencyLevel.SEVERE) {
        score += 30;
        if (estimatedTravelMinutes < 15) score += 20;
      }

      const hospitalDepts = hospitalDepartmentsMap.get(hospital.id) || [];

      recommendations.push({
        id: hospital.id,
        name: hospital.name,
        address: hospital.address,
        distance,
        estimatedTravelMinutes,
        erLoadLevel: hospital.erLoadLevel,
        erBedsAvailable: availableBeds,
        erDoctorsOnDuty: hospital.erDoctorsOnDuty,
        hasRequiredSpecialty: hasRequired,
        trafficFactor,
        score,
        specialties: hospitalSpecialties,
        departments: hospitalDepts.map((d) => ({
          id: d.id,
          name: d.name,
          available: d.available,
        })),
      });
    }

    recommendations.sort((a, b) => b.score - a.score);

    res.status(200).json({
      status: 'success',
      data: {
        recommendations: recommendations.slice(0, 5),
        trafficInfo: {
          currentHour,
          trafficFactor,
          congestionLevel:
            trafficFactor <= 1.1
              ? '畅通'
              : trafficFactor <= 1.4
              ? '缓行'
              : trafficFactor <= 1.8
              ? '拥堵'
              : '严重拥堵',
        },
      },
    });
  }
);

export const confirmHospital = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { dispatchId } = req.params;
    const { hospitalId } = req.body;

    if (!hospitalId) {
      return next(new AppError('请选择医院', 400));
    }

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
      where: { dispatchId: dispatch.id },
    });

    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      return next(new AppError('医院不存在', 404));
    }

    const hospitalDepartments = await prisma.hospitalDepartment.findMany({
      where: { hospitalId },
    });
    const hospitalDoctors = await prisma.user.findMany({
      where: { hospitalId, role: { in: [UserRole.DOCTOR, UserRole.HOSPITAL_STAFF] }, isActive: true },
    });

    const updatedDispatch = await prisma.dispatch.update({
      where: { id: dispatchId },
      data: {
        recommendedHospitalId: hospitalId,
        actualHospitalId: hospitalId,
      },
    });

    const actualHospital = {
      ...hospital,
      specialties: JSON.parse(hospital.specialties || '[]'),
      departments: hospitalDepartments,
      staff: hospitalDoctors,
    };
    const recommendedHospital = actualHospital;

    const enrichedDispatch = {
      ...updatedDispatch,
      call: call
        ? { ...call, symptoms: JSON.parse(call.symptoms || '[]') }
        : null,
      patient,
      actualHospital,
      recommendedHospital,
    };

    const patientInfo = {
      dispatch: enrichedDispatch,
      patient,
      call,
      vitalSigns,
      eta: new Date(Date.now() + 15 * 60 * 1000),
    };

    wsService.emitToRoles(
      [UserRole.DOCTOR, UserRole.HOSPITAL_STAFF],
      'notification:created',
      {
        type: 'PATIENT_INCOMING',
        title: `患者即将送达通知`,
        content: `${call?.emergencyLevel || ''}级患者即将送达${hospital.name}`,
        patientInfo,
      }
    );

    hospitalDoctors.forEach((doctor) => {
      wsService.emitToUser(doctor.id, 'notification:created', {
        type: 'PATIENT_INCOMING',
        patientInfo,
      });
    });

    wsService.broadcastDispatchUpdate(dispatchId, {
      dispatch: enrichedDispatch,
      event: 'hospital_confirmed',
      hospital: actualHospital,
    });

    res.status(200).json({
      status: 'success',
      data: { dispatch: enrichedDispatch },
    });
  }
);

export const updateHospitalLoad = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { hospitalId } = req.params;
    const { erBedsOccupied, erDoctorsOnDuty, erLoadLevel } = req.body;

    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      return next(new AppError('医院不存在', 404));
    }

    const updateData: any = { lastLoadUpdate: new Date() };
    if (erBedsOccupied !== undefined) updateData.erBedsOccupied = erBedsOccupied;
    if (erDoctorsOnDuty !== undefined)
      updateData.erDoctorsOnDuty = erDoctorsOnDuty;
    if (erLoadLevel !== undefined) updateData.erLoadLevel = erLoadLevel;
    else if (
      erBedsOccupied !== undefined && hospital.erBedsTotal > 0) {
      updateData.erLoadLevel = Math.min(
        1,
        erBedsOccupied / hospital.erBedsTotal
      );
    }

    const updatedHospital = await prisma.hospital.update({
      where: { id: hospitalId },
      data: updateData,
    });

    wsService.emitToRoles(
      [UserRole.DISPATCHER, UserRole.PARAMEDIC],
      'hospital:load_updated',
      updatedHospital
    );

    res.status(200).json({
      status: 'success',
      data: { hospital: updatedHospital },
    });
  }
);

export const listHospitals = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { hasER } = req.query;

    const where: any = {};
    if (hasER !== undefined) where.hasER = hasER === 'true';

    const hospitals = await prisma.hospital.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    const allDepartments = await prisma.hospitalDepartment.findMany();
    const deptMap = new Map<string, typeof allDepartments>();
    for (const dept of allDepartments) {
      if (!deptMap.has(dept.hospitalId)) {
        deptMap.set(dept.hospitalId, []);
      }
      deptMap.get(dept.hospitalId)!.push(dept);
    }

    res.status(200).json({
      status: 'success',
      data: {
        hospitals: hospitals.map((h) => ({
          ...h,
          specialties: JSON.parse(h.specialties || '[]'),
          departments: deptMap.get(h.id) || [],
        })),
      },
    });
  }
);

export const getHospital = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const hospital = await prisma.hospital.findUnique({
      where: { id },
    });

    if (!hospital) {
      return next(new AppError('医院不存在', 404));
    }

    const departments = await prisma.hospitalDepartment.findMany({
      where: { hospitalId: id },
    });
    const staff = await prisma.user.findMany({
      where: { hospitalId: id },
      select: {
        id: true,
        fullName: true,
        department: true,
        role: true,
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        hospital: {
          ...hospital,
          specialties: JSON.parse(hospital.specialties || '[]'),
          departments,
          staff,
        },
      },
    });
  }
);
