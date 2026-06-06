import { Router } from 'express';
import {
  createMedicalRecord,
  getMedicalRecord,
  updateMedicalRecord,
  syncToHospital,
  listMedicalRecords,
} from '../controllers/medicalRecordController';
import { protect, requireRoles } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(protect);

router.get(
  '/',
  requireRoles(
    UserRole.DOCTOR,
    UserRole.HOSPITAL_STAFF,
    UserRole.DISPATCHER,
    UserRole.ADMIN,
    UserRole.PARAMEDIC
  ),
  listMedicalRecords
);

router.post(
  '/:dispatchId',
  requireRoles(UserRole.PARAMEDIC, UserRole.ADMIN),
  createMedicalRecord
);

router.get(
  '/:dispatchId',
  requireRoles(
    UserRole.PARAMEDIC,
    UserRole.DOCTOR,
    UserRole.HOSPITAL_STAFF,
    UserRole.DISPATCHER,
    UserRole.ADMIN
  ),
  getMedicalRecord
);

router.patch(
  '/:dispatchId',
  requireRoles(UserRole.PARAMEDIC, UserRole.ADMIN),
  updateMedicalRecord
);

router.post(
  '/:dispatchId/sync',
  requireRoles(
    UserRole.PARAMEDIC,
    UserRole.DISPATCHER,
    UserRole.ADMIN
  ),
  syncToHospital
);

export default router;
