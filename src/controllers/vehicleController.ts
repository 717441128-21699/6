import { Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { wsService } from '../services/websocket';
import { VehicleStatus } from '../utils/enums';

export const listVehicles = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { status, stationId } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (stationId) where.stationId = stationId as string;

    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: { plateNumber: 'asc' },
    });

    const enrichedVehicles = await Promise.all(
      vehicles.map(async (v) => {
        const station = v.stationId
          ? await prisma.emergencyStation.findUnique({ where: { id: v.stationId }, select: { id: true, name: true } })
          : null;
        const currentDispatch = v.currentDispatchId
          ? await prisma.dispatch.findUnique({ where: { id: v.currentDispatchId } })
          : null;
        const call = currentDispatch?.callId
          ? await prisma.emergencyCall.findUnique({ where: { id: currentDispatch.callId } })
          : null;
        return {
          ...v,
          station,
          currentTeam: null,
          currentDispatch: currentDispatch
            ? {
                ...currentDispatch,
                call: call
                  ? { ...call, symptoms: JSON.parse(call.symptoms || '[]') }
                  : null,
              }
            : null,
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: { vehicles: enrichedVehicles },
    });
  }
);

export const getVehicle = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      return next(new AppError('车辆不存在', 404));
    }

    const station = vehicle.stationId
      ? await prisma.emergencyStation.findUnique({ where: { id: vehicle.stationId } })
      : null;
    const currentDispatch = vehicle.currentDispatchId
      ? await prisma.dispatch.findUnique({ where: { id: vehicle.currentDispatchId } })
      : null;
    const call = currentDispatch?.callId
      ? await prisma.emergencyCall.findUnique({ where: { id: currentDispatch.callId } })
      : null;
    const patient = currentDispatch?.id
      ? await prisma.patient.findUnique({ where: { dispatchId: currentDispatch.id } })
      : null;
    const recommendedHospital = currentDispatch?.recommendedHospitalId
      ? await prisma.hospital.findUnique({ where: { id: currentDispatch.recommendedHospitalId } })
      : null;

    const enrichedVehicle = {
      ...vehicle,
      station,
      currentTeam: null,
      currentDispatch: currentDispatch
        ? {
            ...currentDispatch,
            call: call
              ? { ...call, symptoms: JSON.parse(call.symptoms || '[]') }
              : null,
            patient,
            recommendedHospital: recommendedHospital
              ? { ...recommendedHospital, specialties: JSON.parse(recommendedHospital.specialties || '[]') }
              : null,
          }
        : null,
    };

    res.status(200).json({
      status: 'success',
      data: { vehicle: enrichedVehicle },
    });
  }
);

export const createVehicle = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { plateNumber, vehicleType, stationId } = req.body;

    if (!plateNumber || !vehicleType || !stationId) {
      return next(new AppError('请填写必填字段', 400));
    }

    const existing = await prisma.vehicle.findUnique({
      where: { plateNumber },
    });

    if (existing) {
      return next(new AppError('车牌号已存在', 400));
    }

    const station = await prisma.emergencyStation.findUnique({
      where: { id: stationId },
    });

    if (!station) {
      return next(new AppError('急救站不存在', 400));
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        plateNumber,
        vehicleType,
        stationId,
        currentLatitude: station.latitude,
        currentLongitude: station.longitude,
      },
    });

    const enrichedVehicle = { ...vehicle, station };

    const supplies = await prisma.medicalSupply.findMany();
    if (supplies.length > 0) {
      await prisma.vehicleSupply.createMany({
        data: supplies.map((s) => ({
          vehicleId: vehicle.id,
          supplyId: s.id,
          quantity: s.defaultQuantityPerVehicle,
          lastRefilledAt: new Date(),
        })),
      });
    }

    res.status(201).json({
      status: 'success',
      data: { vehicle: enrichedVehicle },
    });
  }
);

export const updateVehicleLocation = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { latitude, longitude, status } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return next(new AppError('请提供经纬度', 400));
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      return next(new AppError('车辆不存在', 404));
    }

    const updateData: any = {
      currentLatitude: parseFloat(latitude),
      currentLongitude: parseFloat(longitude),
      lastLocationUpdate: new Date(),
    };

    if (status) {
      updateData.status = status;
    }

    const updatedVehicle = await prisma.vehicle.update({
      where: { id },
      data: updateData,
    });

    const station = updatedVehicle.stationId
      ? await prisma.emergencyStation.findUnique({ where: { id: updatedVehicle.stationId } })
      : null;

    const enrichedVehicle = { ...updatedVehicle, station };

    wsService.broadcastVehicleUpdate(id, {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      status: enrichedVehicle.status,
      vehicle: enrichedVehicle,
    });

    res.status(200).json({
      status: 'success',
      data: { vehicle: enrichedVehicle },
    });
  }
);

export const updateVehicleStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return next(new AppError('请提供状态', 400));
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      return next(new AppError('车辆不存在', 404));
    }

    const updatedVehicle = await prisma.vehicle.update({
      where: { id },
      data: { status: status as VehicleStatus },
    });

    const station = updatedVehicle.stationId
      ? await prisma.emergencyStation.findUnique({ where: { id: updatedVehicle.stationId } })
      : null;

    const enrichedVehicle = { ...updatedVehicle, station };

    wsService.broadcastVehicleUpdate(id, {
      status: enrichedVehicle.status,
      vehicle: enrichedVehicle,
    });

    res.status(200).json({
      status: 'success',
      data: { vehicle: enrichedVehicle },
    });
  }
);

export const listStations = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const stations = await prisma.emergencyStation.findMany({
      orderBy: { name: 'asc' },
    });

    const enrichedStations = await Promise.all(
      stations.map(async (s) => {
        const teams = await prisma.emergencyTeam.findMany({
          where: { stationId: s.id },
        });
        const vehicles = await prisma.vehicle.findMany({
          where: { stationId: s.id },
        });
        return {
          ...s,
          teams: teams.map((t) => ({ ...t, members: [], currentVehicle: null })),
          vehicles,
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: { stations: enrichedStations },
    });
  }
);

export const listTeams = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { stationId } = req.query;

    const where: any = {};
    if (stationId) where.stationId = stationId as string;

    const teams = await prisma.emergencyTeam.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    const enrichedTeams = await Promise.all(
      teams.map(async (t) => {
        const station = t.stationId
          ? await prisma.emergencyStation.findUnique({ where: { id: t.stationId }, select: { id: true, name: true } })
          : null;
        const members = await prisma.user.findMany({
          where: { teamId: t.id },
          select: { id: true, fullName: true, role: true, phone: true },
        });
        const currentVehicle = null;
        return {
          ...t,
          station,
          members,
          currentVehicle,
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: { teams: enrichedTeams },
    });
  }
);
