import { Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { generateSupplyRequestNumber } from '../utils/emergency';
import { wsService } from '../services/websocket';
import { SupplyRequestStatus, UserRole } from '@prisma/client';

export const recordSupplyUsage = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('请先登录', 401));
    }

    const { dispatchId } = req.params;
    const { supplies, fuelUsed } = req.body;

    const dispatch = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
      include: { vehicle: true },
    });

    if (!dispatch) {
      return next(new AppError('派单不存在', 404));
    }

    if (!supplies && fuelUsed === undefined) {
      return next(new AppError('请提供消耗物资或油料数据', 400));
    }

    const result = await prisma.$transaction(async (tx) => {
      const usageRecords: any[] = [];

      if (supplies && Array.isArray(supplies)) {
        for (const item of supplies) {
          const { supplyId, quantityUsed, notes } = item;

          if (!supplyId || !quantityUsed) continue;

          const vehicleSupply = await tx.vehicleSupply.findUnique({
            where: {
              vehicleId_supplyId: {
                vehicleId: dispatch.vehicleId,
                supplyId,
              },
            },
          });

          if (!vehicleSupply) {
            throw new AppError(`车辆未配备该物资 (ID: ${supplyId})`, 400);
          }

          if (vehicleSupply.quantity < quantityUsed) {
            throw new AppError(
              `物资库存不足，当前库存: ${vehicleSupply.quantity}，申请消耗: ${quantityUsed}`,
              400
            );
          }

          const record = await tx.dispatchSupplyUsage.create({
            data: {
              dispatchId,
              supplyId,
              quantityUsed,
              notes,
            },
            include: { supply: true },
          });

          await tx.vehicleSupply.update({
            where: {
              vehicleId_supplyId: {
                vehicleId: dispatch.vehicleId,
                supplyId,
              },
            },
            data: {
              quantity: { decrement: quantityUsed },
            },
          });

          usageRecords.push(record);
        }
      }

      if (fuelUsed !== undefined && fuelUsed > 0) {
        await tx.vehicle.update({
          where: { id: dispatch.vehicleId },
          data: {
            fuelLevel: {
              decrement: Math.min(fuelUsed, dispatch.vehicle.fuelLevel),
            },
          },
        });
      }

      const vehicleSupplies = await tx.vehicleSupply.findMany({
        where: { vehicleId: dispatch.vehicleId },
        include: { supply: true },
      });

      const lowStockItems = vehicleSupplies.filter(
        (vs) => vs.quantity < vs.supply.safetyStock
      );

      return { usageRecords, lowStockItems };
    });

    if (result.lowStockItems.length > 0) {
      wsService.emitToRoles(
        [UserRole.ADMIN, UserRole.DISPATCHER],
        'notification:created',
        {
          type: 'LOW_SUPPLY_STOCK',
          title: '物资库存预警',
          content: `车辆 ${dispatch.vehicle.plateNumber} 有${result.lowStockItems.length}种物资低于安全线`,
          lowStockItems: result.lowStockItems,
          vehicleId: dispatch.vehicleId,
        }
      );
    }

    res.status(201).json({
      status: 'success',
      data: {
        usageRecords: result.usageRecords,
        lowStockWarning: result.lowStockItems.length > 0,
        lowStockItems: result.lowStockItems,
      },
    });
  }
);

export const checkVehicleStock = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { vehicleId } = req.params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        station: { select: { name: true } },
      },
    });

    if (!vehicle) {
      return next(new AppError('车辆不存在', 404));
    }

    const supplies = await prisma.vehicleSupply.findMany({
      where: { vehicleId },
      include: { supply: true },
      orderBy: { updatedAt: 'desc' },
    });

    const lowStockItems = supplies.filter(
      (vs) => vs.quantity < vs.supply.safetyStock
    );

    res.status(200).json({
      status: 'success',
      data: {
        vehicle: {
          id: vehicle.id,
          plateNumber: vehicle.plateNumber,
          fuelLevel: vehicle.fuelLevel,
          station: vehicle.station,
        },
        supplies,
        lowStockItems,
        fuelWarning: vehicle.fuelLevel < 30,
      },
    });
  }
);

export const createSupplyRequest = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('请先登录', 401));
    }

    const { vehicleId, items, notes, priority } = req.body;

    if (!vehicleId || !items || !Array.isArray(items) || items.length === 0) {
      return next(new AppError('请提供车辆ID和申请物资清单', 400));
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      return next(new AppError('车辆不存在', 404));
    }

    const supplyRequest = await prisma.$transaction(async (tx) => {
      const request = await tx.supplyRequest.create({
        data: {
          requestNumber: generateSupplyRequestNumber(),
          vehicleId,
          requestedById: req.user!.id,
          status: SupplyRequestStatus.PENDING,
          priority: priority || 'NORMAL',
          notes,
        },
      });

      const requestItems = await Promise.all(
        items.map((item: any) =>
          tx.supplyRequestItem.create({
            data: {
              requestId: request.id,
              supplyId: item.supplyId,
              requestedQuantity: item.requestedQuantity,
            },
            include: { supply: true },
          })
        )
      );

      return { ...request, items: requestItems };
    });

    wsService.emitToRoles(
      [UserRole.ADMIN, UserRole.DISPATCHER],
      'notification:created',
      {
        type: 'SUPPLY_REQUEST_CREATED',
        title: '物资补充申请已创建',
        content: `车辆 ${vehicle.plateNumber} 提交了物资补充申请`,
        supplyRequest,
      }
    );

    res.status(201).json({
      status: 'success',
      data: { supplyRequest },
    });
  }
);

export const autoGenerateSupplyRequest = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { vehicleId } = req.params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      return next(new AppError('车辆不存在', 404));
    }

    const vehicleSupplies = await prisma.vehicleSupply.findMany({
      where: { vehicleId },
      include: { supply: true },
    });

    const lowStockItems = vehicleSupplies.filter(
      (vs) => vs.quantity < vs.supply.safetyStock
    );

    if (lowStockItems.length === 0 && vehicle.fuelLevel >= 30) {
      return res.status(200).json({
        status: 'success',
        message: '所有物资库存充足，无需补充申请',
        data: { supplyRequest: null },
      });
    }

    const items = lowStockItems.map((vs) => ({
      supplyId: vs.supplyId,
      requestedQuantity: Math.max(
        vs.supply.defaultQuantityPerVehicle,
        vs.supply.safetyStock * 2 - vs.quantity
      ),
    }));

    const supplyRequest = await prisma.$transaction(async (tx) => {
      const request = await tx.supplyRequest.create({
        data: {
          requestNumber: generateSupplyRequestNumber(),
          vehicleId,
          requestedById: 'system',
          status: SupplyRequestStatus.PENDING,
          priority: lowStockItems.some(
            (vs) => vs.quantity < vs.supply.safetyStock * 0.3
          )
            ? 'URGENT'
            : 'NORMAL',
          notes: `系统自动生成 - 低于安全线物资: ${lowStockItems.length}种${
            vehicle.fuelLevel < 30 ? '，油量低于30%' : ''
          }`,
        },
      });

      if (items.length > 0) {
        await tx.supplyRequestItem.createMany({
          data: items.map((i) => ({
            requestId: request.id,
            supplyId: i.supplyId,
            requestedQuantity: i.requestedQuantity,
          })),
        });
      }

      return tx.supplyRequest.findUnique({
        where: { id: request.id },
        include: { items: { include: { supply: true } }, vehicle: true },
      });
    });

    wsService.emitToRoles(
      [UserRole.ADMIN, UserRole.DISPATCHER],
      'notification:created',
      {
        type: 'AUTO_SUPPLY_REQUEST',
        title: '系统自动生成物资补充申请',
        content: `车辆 ${vehicle.plateNumber} 物资不足`,
        supplyRequest,
      }
    );

    res.status(201).json({
      status: 'success',
      message: '已自动生成物资补充申请',
      data: { supplyRequest },
    });
  }
);

export const listSupplyRequests = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { status, vehicleId, priority } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (vehicleId) where.vehicleId = vehicleId as string;
    if (priority) where.priority = priority;

    const requests = await prisma.supplyRequest.findMany({
      where,
      include: {
        vehicle: true,
        requestedBy: { select: { id: true, fullName: true } },
        items: { include: { supply: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.status(200).json({
      status: 'success',
      data: { requests },
    });
  }
);

export const updateSupplyRequestStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('请先登录', 401));
    }

    const { id } = req.params;
    const { status, items } = req.body;

    const request = await prisma.supplyRequest.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!request) {
      return next(new AppError('申请不存在', 404));
    }

    const now = new Date();
    const updateData: any = { status };

    if (
      status === SupplyRequestStatus.APPROVED ||
      status === SupplyRequestStatus.REJECTED
    ) {
      updateData.approvedById = req.user.id;
      updateData.approvedAt = now;
    }

    if (status === SupplyRequestStatus.FULFILLED) {
      updateData.fulfilledAt = now;
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const updated = await tx.supplyRequest.update({
        where: { id },
        data: updateData,
        include: {
          items: { include: { supply: true } },
          vehicle: true,
        },
      });

      if (status === SupplyRequestStatus.FULFILLED && items) {
        for (const item of items) {
          const fulfillQty = item.fulfilledQuantity || 0;
          if (fulfillQty > 0) {
            await tx.vehicleSupply.upsert({
              where: {
                vehicleId_supplyId: {
                  vehicleId: request.vehicleId,
                  supplyId: item.supplyId,
                },
              },
              update: {
                quantity: { increment: fulfillQty },
                lastRefilledAt: now,
              },
              create: {
                vehicleId: request.vehicleId,
                supplyId: item.supplyId,
                quantity: fulfillQty,
                lastRefilledAt: now,
              },
            });

            await tx.supplyRequestItem.update({
              where: { id: item.id },
              data: { fulfilledQuantity: fulfillQty },
            });
          }
        }
      }

      return updated;
    });

    wsService.emitToRoles(
      [UserRole.ADMIN, UserRole.DISPATCHER, UserRole.PARAMEDIC],
      'notification:created',
      {
        type: 'SUPPLY_REQUEST_UPDATED',
        title: `物资申请已${
          status === SupplyRequestStatus.APPROVED
            ? '批准'
            : status === SupplyRequestStatus.REJECTED
            ? '驳回'
            : '完成'
        }`,
        supplyRequest: updatedRequest,
      }
    );

    res.status(200).json({
      status: 'success',
      data: { supplyRequest: updatedRequest },
    });
  }
);

export const listMedicalSupplies = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { category } = req.query;

    const where: any = {};
    if (category) where.category = category;

    const supplies = await prisma.medicalSupply.findMany({
      where,
      orderBy: { category: 'asc' },
    });

    res.status(200).json({
      status: 'success',
      data: { supplies },
    });
  }
);

export const refillVehicleFuel = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { vehicleId } = req.params;
    const { fuelAmount } = req.body;

    if (!fuelAmount || fuelAmount <= 0) {
      return next(new AppError('请提供有效的加油量', 400));
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      return next(new AppError('车辆不存在', 404));
    }

    const updatedVehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        fuelLevel: {
          set: Math.min(100, vehicle.fuelLevel + fuelAmount),
        },
      },
    });

    res.status(200).json({
      status: 'success',
      data: { vehicle: updatedVehicle },
    });
  }
);
