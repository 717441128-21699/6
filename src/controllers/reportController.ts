import { Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import {
  DispatchStatus,
  EmergencyLevel,
} from '../utils/enums';
import ExcelJS from 'exceljs';

interface DispatchMetrics {
  responseTime: number;
  sceneTime: number;
  totalTransportTime: number;
  hospitalDecisionCorrect: boolean;
  onTimeDelivery: boolean;
}

function calculateDispatchMetrics(dispatch: any): DispatchMetrics {
  const callTime = dispatch.call?.callTime?.getTime();
  const acceptedAt = dispatch.acceptedAt?.getTime();
  const sceneArrivalAt = dispatch.sceneArrivalAt?.getTime();
  const hospitalDepartAt = dispatch.hospitalDepartAt?.getTime();
  const hospitalArrivalAt = dispatch.hospitalArrivalAt?.getTime();

  const responseTime =
    callTime && acceptedAt ? (acceptedAt - callTime) / 1000 / 60 : 0;

  const sceneTime =
    sceneArrivalAt && hospitalDepartAt
      ? (hospitalDepartAt - sceneArrivalAt) / 1000 / 60
      : 0;

  const totalTransportTime =
    hospitalDepartAt && hospitalArrivalAt
      ? (hospitalArrivalAt - hospitalDepartAt) / 1000 / 60
      : 0;

  const hospitalDecisionCorrect =
    dispatch.recommendedHospitalId &&
    dispatch.actualHospitalId &&
    dispatch.recommendedHospitalId === dispatch.actualHospitalId;

  const onTimeDelivery = totalTransportTime > 0 && totalTransportTime <= 30;

  return {
    responseTime,
    sceneTime,
    totalTransportTime,
    hospitalDecisionCorrect,
    onTimeDelivery,
  };
}

async function generateMonthlyReport(
  year: number,
  month: number,
  stationId?: string,
  teamId?: string
) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const where: any = {
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
    status: DispatchStatus.COMPLETED,
  };

  if (teamId) {
    where.assignedTeamId = teamId;
  }

  let dispatches = await prisma.dispatch.findMany({
    where,
  });

  if (stationId) {
    const vehiclesAtStation = await prisma.vehicle.findMany({
      where: { stationId },
      select: { id: true },
    });
    const vehicleIds = vehiclesAtStation.map((v) => v.id);
    dispatches = dispatches.filter((d) => vehicleIds.includes(d.vehicleId));
  }

  if (dispatches.length === 0) {
    return {
      reportMonth: `${year}-${String(month).padStart(2, '0')}`,
      stationId: stationId || null,
      teamId: teamId || null,
      totalCalls: 0,
      avgResponseTime: 0,
      avgSceneTime: 0,
      hospitalDecisionAccuracy: 0,
      criticalResponseWithinTarget: 0,
      onTimeDelivery: 0,
      data: JSON.stringify({}),
    };
  }

  const callsMap = new Map<string, any>();
  const vehiclesMap = new Map<string, any>();
  for (const d of dispatches) {
    if (d.callId && !callsMap.has(d.callId)) {
      const call = await prisma.emergencyCall.findUnique({ where: { id: d.callId } });
      if (call) callsMap.set(d.callId, call);
    }
    if (d.vehicleId && !vehiclesMap.has(d.vehicleId)) {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: d.vehicleId } });
      if (vehicle) vehiclesMap.set(d.vehicleId, vehicle);
    }
  }

  const enrichedDispatches = dispatches.map((d) => ({
    ...d,
    call: callsMap.get(d.callId),
    vehicle: vehiclesMap.get(d.vehicleId),
  }));

  const metrics = enrichedDispatches.map(calculateDispatchMetrics);

  const validResponseTimes = metrics.filter((m) => m.responseTime > 0);
  const validSceneTimes = metrics.filter((m) => m.sceneTime > 0);
  const validDecisions = metrics.filter((m) => m.hospitalDecisionCorrect);
  const validDeliveries = metrics.filter((m) => m.onTimeDelivery);

  const criticalDispatches = enrichedDispatches.filter(
    (d) => d.level === EmergencyLevel.CRITICAL
  );
  const criticalMetrics = criticalDispatches.map(calculateDispatchMetrics);
  const criticalOnTime = criticalMetrics.filter((m) => m.responseTime > 0 && m.responseTime <= 4);

  const avgResponseTime =
    validResponseTimes.length > 0
      ? validResponseTimes.reduce((sum, m) => sum + m.responseTime, 0) /
        validResponseTimes.length
      : 0;

  const avgSceneTime =
    validSceneTimes.length > 0
      ? validSceneTimes.reduce((sum, m) => sum + m.sceneTime, 0) /
        validSceneTimes.length
      : 0;

  const hospitalDecisionAccuracy =
    metrics.length > 0 ? (validDecisions.length / metrics.length) * 100 : 0;

  const criticalResponseWithinTarget =
    criticalDispatches.length > 0
      ? (criticalOnTime.length / criticalDispatches.length) * 100
      : 0;

  const onTimeDeliveryRate =
    metrics.length > 0 ? (validDeliveries.length / metrics.length) * 100 : 0;

  const levelBreakdown: Record<string, number> = {};
  Object.values(EmergencyLevel).forEach((level) => {
    levelBreakdown[level] = enrichedDispatches.filter((d) => d.level === level).length;
  });

  return {
    reportMonth: `${year}-${String(month).padStart(2, '0')}`,
    stationId: stationId || null,
    teamId: teamId || null,
    totalCalls: enrichedDispatches.length,
    avgResponseTime: parseFloat(avgResponseTime.toFixed(2)),
    avgSceneTime: parseFloat(avgSceneTime.toFixed(2)),
    hospitalDecisionAccuracy: parseFloat(hospitalDecisionAccuracy.toFixed(2)),
    criticalResponseWithinTarget: parseFloat(
      criticalResponseWithinTarget.toFixed(2)
    ),
    onTimeDelivery: parseFloat(onTimeDeliveryRate.toFixed(2)),
    data: JSON.stringify({
      levelBreakdown,
      criticalCalls: criticalDispatches.length,
      criticalOnTime: criticalOnTime.length,
      dispatches: enrichedDispatches.map((d, i) => ({
        id: d.id,
        callNumber: d.call?.callNumber,
        level: d.level,
        ...metrics[i],
      })),
    }),
  };
}

export const generateReport = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { year, month, stationId, teamId } = req.body;

    if (!year || !month) {
      return next(new AppError('请提供年份和月份', 400));
    }

    const reportData = await generateMonthlyReport(
      parseInt(year),
      parseInt(month),
      stationId as string | undefined,
      teamId as string | undefined
    );

    const report = await prisma.qualityReport.upsert({
      where: {
        reportMonth_stationId_teamId: {
          reportMonth: reportData.reportMonth,
          stationId: reportData.stationId,
          teamId: reportData.teamId,
        },
      },
      update: {
        totalCalls: reportData.totalCalls,
        avgResponseTime: reportData.avgResponseTime,
        avgSceneTime: reportData.avgSceneTime,
        hospitalDecisionAccuracy: reportData.hospitalDecisionAccuracy,
        criticalResponseWithinTarget: reportData.criticalResponseWithinTarget,
        onTimeDelivery: reportData.onTimeDelivery,
        data: reportData.data,
      },
      create: {
        reportMonth: reportData.reportMonth,
        stationId: reportData.stationId,
        teamId: reportData.teamId,
        totalCalls: reportData.totalCalls,
        avgResponseTime: reportData.avgResponseTime,
        avgSceneTime: reportData.avgSceneTime,
        hospitalDecisionAccuracy: reportData.hospitalDecisionAccuracy,
        criticalResponseWithinTarget: reportData.criticalResponseWithinTarget,
        onTimeDelivery: reportData.onTimeDelivery,
        data: reportData.data,
      },
    });

    const station = report.stationId
      ? await prisma.emergencyStation.findUnique({ where: { id: report.stationId } })
      : null;
    const team = report.teamId
      ? await prisma.emergencyTeam.findUnique({ where: { id: report.teamId } })
      : null;

    res.status(200).json({
      status: 'success',
      data: {
        report: {
          ...report,
          data: JSON.parse(report.data || '{}'),
          station,
          team,
        },
      },
    });
  }
);

export const getReport = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const report = await prisma.qualityReport.findUnique({
      where: { id },
    });

    if (!report) {
      return next(new AppError('报告不存在', 404));
    }

    const station = report.stationId
      ? await prisma.emergencyStation.findUnique({ where: { id: report.stationId } })
      : null;
    const team = report.teamId
      ? await prisma.emergencyTeam.findUnique({ where: { id: report.teamId } })
      : null;

    res.status(200).json({
      status: 'success',
      data: {
        report: {
          ...report,
          data: JSON.parse(report.data || '{}'),
          station,
          team,
        },
      },
    });
  }
);

export const listReports = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { stationId, teamId, reportMonth } = req.query;

    const where: any = {};
    if (stationId) where.stationId = stationId as string;
    if (teamId) where.teamId = teamId as string;
    if (reportMonth) where.reportMonth = reportMonth as string;

    const reports = await prisma.qualityReport.findMany({
      where,
      orderBy: { reportMonth: 'desc' },
      take: 50,
    });

    const enrichedReports = await Promise.all(
      reports.map(async (r) => {
        const station = r.stationId
          ? await prisma.emergencyStation.findUnique({ where: { id: r.stationId } })
          : null;
        const team = r.teamId
          ? await prisma.emergencyTeam.findUnique({ where: { id: r.teamId } })
          : null;
        return {
          ...r,
          data: JSON.parse(r.data || '{}'),
          station,
          team,
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: { reports: enrichedReports },
    });
  }
);

export const exportReportToExcel = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const report = await prisma.qualityReport.findUnique({
      where: { id },
    });

    if (!report) {
      return next(new AppError('报告不存在', 404));
    }

    const station = report.stationId
      ? await prisma.emergencyStation.findUnique({ where: { id: report.stationId } })
      : null;
    const team = report.teamId
      ? await prisma.emergencyTeam.findUnique({ where: { id: report.teamId } })
      : null;

    const enrichedReport = {
      ...report,
      data: JSON.parse(report.data || '{}'),
      station,
      team,
    };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '智慧急救调度系统';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('质量总览');

    summarySheet.columns = [
      { header: '指标', key: 'metric', width: 30 },
      { header: '数值', key: 'value', width: 20 },
    ];

    summarySheet.addRows([
      { metric: '报告月份', value: enrichedReport.reportMonth },
      { metric: '急救站', value: enrichedReport.station?.name || '全部' },
      { metric: '急救小组', value: enrichedReport.team?.name || '全部' },
      { metric: '总出车次数', value: enrichedReport.totalCalls },
      { metric: '平均响应时间(分钟)', value: enrichedReport.avgResponseTime },
      { metric: '平均现场处置时间(分钟)', value: enrichedReport.avgSceneTime },
      { metric: '医院决策准确率(%)', value: enrichedReport.hospitalDecisionAccuracy },
      {
        metric: '危重病例响应达标率(%)',
        value: enrichedReport.criticalResponseWithinTarget,
      },
      { metric: '准时送达率(%)', value: enrichedReport.onTimeDelivery },
      { metric: '报告生成时间', value: enrichedReport.generatedAt.toLocaleString() },
    ]);

    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    const data: any = enrichedReport.data as any;
    if (data?.dispatches && data.dispatches.length > 0) {
      const detailSheet = workbook.addWorksheet('出车明细');

      detailSheet.columns = [
        { header: '接警编号', key: 'callNumber', width: 20 },
        { header: '急救等级', key: 'level', width: 12 },
        { header: '响应时间(分钟)', key: 'responseTime', width: 16 },
        { header: '现场处置时间(分钟)', key: 'sceneTime', width: 18 },
        { header: '运输时间(分钟)', key: 'totalTransportTime', width: 16 },
        { header: '医院决策正确', key: 'hospitalDecisionCorrect', width: 14 },
        { header: '准时送达', key: 'onTimeDelivery', width: 12 },
      ];

      detailSheet.addRows(
        data.dispatches.map((d: any) => ({
          callNumber: d.callNumber,
          level: d.level,
          responseTime: d.responseTime.toFixed(2),
          sceneTime: d.sceneTime.toFixed(2),
          totalTransportTime: d.totalTransportTime.toFixed(2),
          hospitalDecisionCorrect: d.hospitalDecisionCorrect ? '是' : '否',
          onTimeDelivery: d.onTimeDelivery ? '是' : '否',
        }))
      );

      detailSheet.getRow(1).font = { bold: true };
      detailSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    }

    if (data?.levelBreakdown) {
      const breakdownSheet = workbook.addWorksheet('等级分布');

      breakdownSheet.columns = [
        { header: '急救等级', key: 'level', width: 20 },
        { header: '数量', key: 'count', width: 15 },
      ];

      const levelLabels: Record<string, string> = {
        CRITICAL: '危重',
        SEVERE: '严重',
        MODERATE: '中度',
        MINOR: '轻微',
      };

      breakdownSheet.addRows(
        Object.entries(data.levelBreakdown).map(([level, count]) => ({
          level: levelLabels[level] || level,
          count,
        }))
      );

      breakdownSheet.getRow(1).font = { bold: true };
      breakdownSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    }

    const fileName = `急救质量报告_${enrichedReport.reportMonth}_${
      enrichedReport.station?.name || '全部'
    }.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileName)}"`
    );

    await prisma.qualityReport.update({
      where: { id: report.id },
      data: { exportedAt: new Date() },
    });

    await workbook.xlsx.write(res);
    res.end();
  }
);

export const getStatisticsOverview = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { stationId, teamId, dateFrom, dateTo } = req.query;

    const where: any = {
      status: DispatchStatus.COMPLETED,
    };

    if (teamId) where.assignedTeamId = teamId as string;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }

    let totalCompletedQuery = prisma.dispatch.count({ where });
    if (stationId) {
      const vehiclesAtStation = await prisma.vehicle.findMany({
        where: { stationId: stationId as string },
        select: { id: true },
      });
      const vehicleIds = vehiclesAtStation.map((v) => v.id);
      totalCompletedQuery = prisma.dispatch.count({
        where: { ...where, vehicleId: { in: vehicleIds } },
      });
    }

    const totalCompleted = await totalCompletedQuery;

    const activeDispatches = await prisma.dispatch.count({
      where: {
        status: {
          in: [
            DispatchStatus.PENDING,
            DispatchStatus.ASSIGNED,
            DispatchStatus.ACCEPTED,
            DispatchStatus.EN_ROUTE_TO_SCENE,
            DispatchStatus.AT_SCENE,
            DispatchStatus.EN_ROUTE_TO_HOSPITAL,
            DispatchStatus.AT_HOSPITAL,
          ],
        },
      },
    });

    const availableVehicles = await prisma.vehicle.count({
      where: {
        status: {
          in: ['AVAILABLE', 'RETURNING'],
        },
      },
    });

    const activeAlerts = await prisma.alert.count({
      where: { status: 'PENDING' },
    });

    res.status(200).json({
      status: 'success',
      data: {
        overview: {
          totalCompleted,
          activeDispatches,
          availableVehicles,
          activeAlerts,
        },
      },
    });
  }
);
