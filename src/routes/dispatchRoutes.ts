import { Router } from 'express';
import {
  createEmergencyCall,
  assessCall,
  listEmergencyCalls,
  getEmergencyCall,
  createDispatch,
  getAvailableVehicles,
  updateDispatchStatus,
  listDispatches,
  getDispatch,
} from '../controllers/dispatchController';
import { protect, requireRoles } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

router.post('/calls/assess', assessCall);

router.use(protect);

router.post(
  '/calls',
  requireRoles(UserRole.DISPATCHER, UserRole.ADMIN),
  createEmergencyCall
);
router.get(
  '/calls',
  requireRoles(
    UserRole.DISPATCHER,
    UserRole.ADMIN,
    UserRole.PARAMEDIC
  ),
  listEmergencyCalls
);
router.get(
  '/calls/:id',
  requireRoles(
    UserRole.DISPATCHER,
    UserRole.ADMIN,
    UserRole.PARAMEDIC,
    UserRole.DOCTOR
  ),
  getEmergencyCall
);

router.get(
  '/vehicles/available',
  requireRoles(UserRole.DISPATCHER, UserRole.ADMIN),
  getAvailableVehicles
);

router.post(
  '/dispatches',
  requireRoles(UserRole.DISPATCHER, UserRole.ADMIN),
  createDispatch
);
router.get(
  '/dispatches',
  requireRoles(
    UserRole.DISPATCHER,
    UserRole.ADMIN,
    UserRole.PARAMEDIC,
    UserRole.DOCTOR,
    UserRole.HOSPITAL_STAFF
  ),
  listDispatches
);
router.get(
  '/dispatches/:id',
  requireRoles(
    UserRole.DISPATCHER,
    UserRole.ADMIN,
    UserRole.PARAMEDIC,
    UserRole.DOCTOR,
    UserRole.HOSPITAL_STAFF
  ),
  getDispatch
);
router.patch(
  '/dispatches/:id/status',
  requireRoles(
    UserRole.DISPATCHER,
    UserRole.ADMIN,
    UserRole.PARAMEDIC
  ),
  updateDispatchStatus
);

export default router;
