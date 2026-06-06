import { Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { wsService } from '../services/websocket';
import { VehicleStatus } from '@prisma/client';

export const listVehicles = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { status, stationId } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (stationId) where.stationId = stationId as string;

    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        station: { select: { id: true, name: true } },
        currentTeam: {
          include: {
            members: { select: { id: true, fullName: true, role: true } },
          },
        },
        currentDispatch: {
          include: { call: true },
        },
      },
      orderBy: { plateNumber: 'asc' },
    });

    res.status(200).json({
      status: 'success',
      data: { vehicles },
    });
  }
);

export const getVehicle = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        station: true,
        currentTeam: {
          include: {
            members: { select: { id: true, fullName: true, role: true, phone: true } },
          },
        },
        currentDispatch: {
          include: {
            call: true,
            patient: true,
            recommendedHospital: true,
          },
        },
      },
    });

    if (!vehicle) {
      return next(new AppError('车辆不存在', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { vehicle },
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
      include: { station: true },
    });

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
      data: { vehicle },
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
      include: { station: true },
    });

    wsService.broadcastVehicleUpdate(id, {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      status: updatedVehicle.status,
      vehicle: updatedVehicle,
    });

    res.status(200).json({
      status: 'success',
      data: { vehicle: updatedVehicle },
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
      include: { station: true },
    });

    wsService.broadcastVehicleUpdate(id, {
      status: updatedVehicle.status,
      vehicle: updatedVehicle,
    });

    res.status(200).json({
      status: 'success',
      data: { vehicle: updatedVehicle },
    });
  }
);

export const listStations = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const stations = await prisma.emergencyStation.findMany({
      include: {
        teams: {
          include: {
            members: { select: { id: true, fullName: true, role: true } },
          },
        },
        vehicles: true,
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      status: 'success',
      data: { stations },
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
      include: {
        station: { select: { id: true, name: true } },
        members: { select: { id: true, fullName: true, role: true, phone: true } },
        currentVehicle: { select: { id: true, plateNumber: true, status: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      status: 'success',
      data: { teams },
    });
  }
);
