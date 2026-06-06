import { Router } from 'express';
import {
  recommendHospital,
  confirmHospital,
  updateHospitalLoad,
  listHospitals,
  getHospital,
} from '../controllers/hospitalController';
import { protect, requireRoles } from '../middleware/auth';
import { UserRole } from '../utils/enums';

const router = Router();

router.use(protect);

router.get(
  '/',
  requireRoles(
    UserRole.DISPATCHER,
    UserRole.ADMIN,
    UserRole.PARAMEDIC,
    UserRole.DOCTOR,
    UserRole.HOSPITAL_STAFF
  ),
  listHospitals
);

router.get(
  '/:id',
  requireRoles(
    UserRole.DISPATCHER,
    UserRole.ADMIN,
    UserRole.PARAMEDIC,
    UserRole.DOCTOR,
    UserRole.HOSPITAL_STAFF
  ),
  getHospital
);

router.get(
  '/recommend/:dispatchId',
  requireRoles(
    UserRole.DISPATCHER,
    UserRole.ADMIN,
    UserRole.PARAMEDIC
  ),
  recommendHospital
);

router.post(
  '/confirm/:dispatchId',
  requireRoles(
    UserRole.DISPATCHER,
    UserRole.ADMIN,
    UserRole.PARAMEDIC
  ),
  confirmHospital
);

router.patch(
  '/:hospitalId/load',
  requireRoles(
    UserRole.HOSPITAL_STAFF,
    UserRole.DOCTOR,
    UserRole.ADMIN
  ),
  updateHospitalLoad
);

export default router;
