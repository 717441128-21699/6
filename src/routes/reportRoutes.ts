import { Router } from 'express';
import {
  generateReport,
  getReport,
  listReports,
  exportReportToExcel,
  getStatisticsOverview,
} from '../controllers/reportController';
import { protect, requireRoles } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(protect);

router.get(
  '/overview',
  requireRoles(
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.PARAMEDIC,
    UserRole.DOCTOR
  ),
  getStatisticsOverview
);

router.post(
  '/generate',
  requireRoles(UserRole.ADMIN, UserRole.DISPATCHER),
  generateReport
);

router.get(
  '/',
  requireRoles(UserRole.ADMIN, UserRole.DISPATCHER),
  listReports
);

router.get(
  '/:id',
  requireRoles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DOCTOR),
  getReport
);

router.get(
  '/:id/export',
  requireRoles(UserRole.ADMIN, UserRole.DISPATCHER),
  exportReportToExcel
);

export default router;
