import { Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import {
  assessEmergencyLevel,
  calculateDistance,
  generateCallNumber,
} from '../utils/emergency';
import { wsService } from '../services/websocket';
import {
  EmergencyLevel,
  DispatchStatus,
  VehicleStatus,
  AlertSeverity,
  UserRole,
} from '@prisma/client';

export const createEmergencyCall = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      callerName,
      callerPhone,
      patientName,
      patientAge,
      patientGender,
      locationAddress,
      locationLatitude,
      locationLongitude,
      chiefComplaint,
      symptoms,
      notes,
    } = req.body;

    if (
      !callerPhone ||
      !locationAddress ||
      locationLatitude === undefined ||
      locationLongitude === undefined ||
      !chiefComplaint
    ) {
      return next(new AppError('请填写完整的接警信息', 400));
    }

    const assessment = assessEmergencyLevel(
      chiefComplaint,
      symptoms || []
    );

    const callNumber = generateCallNumber();

    const emergencyCall = await prisma.emergencyCall.create({
      data: {
        callNumber,
        callerName,
        callerPhone,
        patientName,
        patientAge,
        patientGender,
        locationAddress,
        locationLatitude: parseFloat(locationLatitude),
        locationLongitude: parseFloat(locationLongitude),
        chiefComplaint,
        symptoms: symptoms || [],
        emergencyLevel: assessment.level,
        callTime: new Date(),
        notes,
      },
    });

    if (assessment.level === EmergencyLevel.CRITICAL || assessment.level === EmergencyLevel.SEVERE) {
      wsService.emitToRoles(
        [UserRole.DISPATCHER, UserRole.PARAMEDIC],
        'call:received',
        {
          call: emergencyCall,
          assessment,
          urgent: true,
        }
      );
    } else {
      wsService.emitToRole(UserRole.DISPATCHER, 'call:received', {
        call: emergencyCall,
        assessment,
        urgent: false,
      });
    }

    res.status(201).json({
      status: 'success',
      data: {
        call: emergencyCall,
        assessment,
      },
    });
  }
);

export const assessCall = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { chiefComplaint, symptoms } = req.body;

    const assessment = assessEmergencyLevel(
      chiefComplaint || '',
      symptoms || []
    );

    res.status(200).json({
      status: 'success',
      data: assessment,
    });
  }
);

export const listEmergencyCalls = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { level, dateFrom, dateTo, hasDispatch } = req.query;

    const where: any = {};
    if (level) where.emergencyLevel = level;
    if (dateFrom || dateTo) {
      where.callTime = {};
      if (dateFrom) where.callTime.gte = new Date(dateFrom as string);
      if (dateTo) where.callTime.lte = new Date(dateTo as string);
    }

    const calls = await prisma.emergencyCall.findMany({
      where,
      include: {
        dispatch: {
          include: {
            vehicle: true,
            dispatcher: {
              select: { id: true, fullName: true },
            },
          },
        },
      },
      orderBy: { callTime: 'desc' },
      take: 100,
    });

    res.status(200).json({
      status: 'success',
      data: { calls },
    });
  }
);

export const getEmergencyCall = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const call = await prisma.emergencyCall.findUnique({
      where: { id },
      include: {
        dispatch: {
          include: {
            vehicle: true,
            dispatcher: {
              select: { id: true, fullName: true },
            },
            patient: true,
            vitalSigns: true,
            medicalRecord: true,
          },
        },
      },
    });

    if (!call) {
      return next(new AppError('接警记录不存在', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { call },
    });
  }
);

export interface CandidateVehicle {
  id: string;
  plateNumber: string;
  distance: number;
  estimatedArrivalMinutes: number;
  driverHoursToday: number;
  status: VehicleStatus;
  stationName: string;
  score: number;
}

export const getAvailableVehicles = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { latitude, longitude, level } = req.query;

    if (!latitude || !longitude) {
      return next(new AppError('请提供位置坐标', 400));
    }

    const targetLat = parseFloat(latitude as string);
    const targetLon = parseFloat(longitude as string);
    const emergencyLevel = level as EmergencyLevel;

    const vehicles = await prisma.vehicle.findMany({
      where: {
        status: {
          in: [VehicleStatus.AVAILABLE, VehicleStatus.RETURNING],
        },
      },
      include: {
        station: {
          select: { name: true },
        },
        currentTeam: {
          include: {
            members: {
              select: { id: true, fullName: true },
            },
          },
        },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const candidateVehicles: CandidateVehicle[] = [];

    for (const vehicle of vehicles) {
      const vehLat = vehicle.currentLatitude ?? vehicle.station.latitude;
      const vehLon = vehicle.currentLongitude ?? vehicle.station.longitude;

      const distance = calculateDistance(
        targetLat,
        targetLon,
        vehLat,
        vehLon
      );

      const avgSpeedKmh = 50;
      const estimatedArrivalMinutes = (distance / avgSpeedKmh) * 60;

      const teamDispatches = vehicle.currentTeamId
        ? await prisma.dispatch.findMany({
            where: {
              assignedTeamId: vehicle.currentTeamId,
              createdAt: { gte: today },
            },
          })
        : [];

      let driverHoursToday = 0;
      for (const d of teamDispatches) {
        if (d.completedAt && d.acceptedAt) {
          driverHoursToday +=
            (d.completedAt.getTime() - d.acceptedAt.getTime()) / 3600000;
        }
      }

      let score = 0;
      score -= distance * 10;
      score -= estimatedArrivalMinutes * 2;
      if (driverHoursToday > 8) score -= (driverHoursToday - 8) * 20;
      if (vehicle.status === VehicleStatus.AVAILABLE) score += 30;
      if (emergencyLevel === EmergencyLevel.CRITICAL && estimatedArrivalMinutes < 5) score += 50;
      if (emergencyLevel === EmergencyLevel.CRITICAL && estimatedArrivalMinutes < 8) score += 30;

      candidateVehicles.push({
        id: vehicle.id,
        plateNumber: vehicle.plateNumber,
        distance,
        estimatedArrivalMinutes,
        driverHoursToday,
        status: vehicle.status,
        stationName: vehicle.station.name,
        score,
      });
    }

    candidateVehicles.sort((a, b) => b.score - a.score);

    res.status(200).json({
      status: 'success',
      data: {
        vehicles: candidateVehicles.slice(0, 10),
      },
    });
  }
);

export const createDispatch = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('请先登录', 401));
    }

    const {
      callId,
      vehicleId,
      assignedTeamId,
      dispatchNotes,
    } = req.body;

    if (!callId || !vehicleId) {
      return next(new AppError('请提供接警ID和车辆ID', 400));
    }

    const call = await prisma.emergencyCall.findUnique({
      where: { id: callId },
    });

    if (!call) {
      return next(new AppError('接警记录不存在', 404));
    }

    const existingDispatch = await prisma.dispatch.findUnique({
      where: { callId },
    });

    if (existingDispatch) {
      return next(new AppError('该接警已存在派单', 400));
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { currentTeam: { include: { members: true } } },
    });

    if (!vehicle) {
      return next(new AppError('车辆不存在', 404));
    }

    if (
      vehicle.status !== VehicleStatus.AVAILABLE &&
      vehicle.status !== VehicleStatus.RETURNING
    ) {
      return next(new AppError('该车辆当前不可用', 400));
    }

    const dispatch = await prisma.$transaction(async (tx) => {
      const newDispatch = await tx.dispatch.create({
        data: {
          callId,
          status: DispatchStatus.ASSIGNED,
          level: call.emergencyLevel,
          dispatcherId: req.user!.id,
          vehicleId,
          assignedTeamId: assignedTeamId || vehicle.currentTeamId,
          dispatchNotes,
        },
        include: {
          call: true,
          vehicle: true,
          dispatcher: {
            select: { id: true, fullName: true },
          },
          assignedTo: {
            select: { id: true, fullName: true },
          },
        },
      });

      await tx.vehicle.update({
        where: { id: vehicleId },
        data: {
          status: VehicleStatus.ON_CALL,
          currentDispatchId: newDispatch.id,
        },
      });

      if (assignedTeamId) {
        await tx.emergencyTeam.update({
          where: { id: assignedTeamId },
          data: { currentVehicleId: vehicleId },
        });
      }

      await tx.patient.upsert({
        where: { callId },
        update: {},
        create: {
          callId,
          fullName: call.patientName,
          age: call.patientAge,
          gender: call.patientGender,
          contactPhone: call.callerPhone,
        },
      });

      return newDispatch;
    });

    wsService.broadcastDispatchUpdate(dispatch.id, {
      dispatch,
      event: 'created',
    });

    wsService.emitToRoles(
      [UserRole.PARAMEDIC, UserRole.DISPATCHER],
      'dispatch:created',
      dispatch
    );

    if (dispatch.level === EmergencyLevel.CRITICAL || dispatch.level === EmergencyLevel.SEVERE) {
      if (vehicle.currentTeam) {
        vehicle.currentTeam.members.forEach((member) => {
          wsService.emitToUser(member.id, 'alert:created', {
            type: 'URGENT_DISPATCH',
            severity: AlertSeverity.CRITICAL,
            message: `紧急派单！${call.emergencyLevel}级急救任务，请立即出车`,
            dispatch,
          });
        });
      }
    }

    res.status(201).json({
      status: 'success',
      data: { dispatch },
    });
  }
);

export const updateDispatchStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status, latitude, longitude } = req.body;

    const dispatch = await prisma.dispatch.findUnique({
      where: { id },
      include: { call: true, vehicle: true },
    });

    if (!dispatch) {
      return next(new AppError('派单不存在', 404));
    }

    const updateData: any = { status };
    const now = new Date();

    switch (status as DispatchStatus) {
      case DispatchStatus.ACCEPTED:
        updateData.acceptedAt = now;
        break;
      case DispatchStatus.EN_ROUTE_TO_SCENE:
        updateData.enRouteAt = now;
        break;
      case DispatchStatus.AT_SCENE:
        updateData.sceneArrivalAt = now;
        break;
      case DispatchStatus.EN_ROUTE_TO_HOSPITAL:
        updateData.hospitalDepartAt = now;
        break;
      case DispatchStatus.AT_HOSPITAL:
        updateData.hospitalArrivalAt = now;
        updateData.handoverTime = now;
        break;
      case DispatchStatus.COMPLETED:
        updateData.completedAt = now;
        break;
    }

    const updatedDispatch = await prisma.$transaction(async (tx) => {
      const updated = await tx.dispatch.update({
        where: { id },
        data: updateData,
        include: {
          call: true,
          vehicle: true,
          dispatcher: { select: { id: true, fullName: true } },
        },
      });

      if (latitude !== undefined && longitude !== undefined) {
        await tx.vehicle.update({
          where: { id: dispatch.vehicleId },
          data: {
            currentLatitude: parseFloat(latitude),
            currentLongitude: parseFloat(longitude),
            lastLocationUpdate: now,
          },
        });
      }

      if (status === DispatchStatus.COMPLETED) {
        await tx.vehicle.update({
          where: { id: dispatch.vehicleId },
          data: {
            status: VehicleStatus.RETURNING,
            currentDispatchId: null,
          },
        });
      }

      return updated;
    });

    wsService.broadcastDispatchUpdate(id, {
      dispatch: updatedDispatch,
      event: 'status_changed',
      status,
    });

    res.status(200).json({
      status: 'success',
      data: { dispatch: updatedDispatch },
    });
  }
);

export const listDispatches = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { status, vehicleId, level, dateFrom, dateTo, active } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (vehicleId) where.vehicleId = vehicleId as string;
    if (level) where.level = level;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }
    if (active === 'true') {
      where.status = {
        in: [
          DispatchStatus.PENDING,
          DispatchStatus.ASSIGNED,
          DispatchStatus.ACCEPTED,
          DispatchStatus.EN_ROUTE_TO_SCENE,
          DispatchStatus.AT_SCENE,
          DispatchStatus.EN_ROUTE_TO_HOSPITAL,
          DispatchStatus.AT_HOSPITAL,
        ],
      };
    }

    const dispatches = await prisma.dispatch.findMany({
      where,
      include: {
        call: true,
        vehicle: true,
        dispatcher: { select: { id: true, fullName: true } },
        patient: true,
        recommendedHospital: true,
        actualHospital: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.status(200).json({
      status: 'success',
      data: { dispatches },
    });
  }
);

export const getDispatch = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const dispatch = await prisma.dispatch.findUnique({
      where: { id },
      include: {
        call: true,
        vehicle: true,
        dispatcher: { select: { id: true, fullName: true } },
        patient: true,
        vitalSigns: { orderBy: { timestamp: 'asc' } },
        medicalRecord: true,
        alerts: { include: { recipients: true } },
        recommendedHospital: true,
        actualHospital: true,
        suppliesUsed: { include: { supply: true } },
      },
    });

    if (!dispatch) {
      return next(new AppError('派单不存在', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { dispatch },
    });
  }
);
