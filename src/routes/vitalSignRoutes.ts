import { Router } from 'express';
import {
  uploadVitalSigns,
  listVitalSigns,
  listAlerts,
  acknowledgeAlert,
  resolveAlert,
} from '../controllers/vitalSignController';
import { protect, requireRoles } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(protect);

router.post(
  '/:dispatchId',
  requireRoles(UserRole.PARAMEDIC, UserRole.ADMIN),
  uploadVitalSigns
);
router.get(
  '/:dispatchId',
  requireRoles(
    UserRole.PARAMEDIC,
    UserRole.DISPATCHER,
    UserRole.DOCTOR,
    UserRole.HOSPITAL_STAFF,
    UserRole.ADMIN
  ),
  listVitalSigns
);

router.get(
  '/alerts/list',
  requireRoles(
    UserRole.DISPATCHER,
    UserRole.PARAMEDIC,
    UserRole.DOCTOR,
    UserRole.HOSPITAL_STAFF,
    UserRole.ADMIN
  ),
  listAlerts
);
router.patch(
  '/alerts/:id/acknowledge',
  requireRoles(
    UserRole.DISPATCHER,
    UserRole.PARAMEDIC,
    UserRole.DOCTOR,
    UserRole.ADMIN
  ),
  acknowledgeAlert
);
router.patch(
  '/alerts/:id/resolve',
  requireRoles(
    UserRole.DISPATCHER,
    UserRole.DOCTOR,
    UserRole.ADMIN
  ),
  resolveAlert
);

export default router;
