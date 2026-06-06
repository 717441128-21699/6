import { Router } from 'express';
import {
  listVehicles,
  getVehicle,
  createVehicle,
  updateVehicleLocation,
  updateVehicleStatus,
  listStations,
  listTeams,
} from '../controllers/vehicleController';
import { protect, requireRoles } from '../middleware/auth';
import { UserRole } from '../utils/enums';

const router = Router();

router.use(protect);

router.get(
  '/stations',
  requireRoles(
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.PARAMEDIC
  ),
  listStations
);

router.get(
  '/teams',
  requireRoles(
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.PARAMEDIC
  ),
  listTeams
);

router.get(
  '/',
  requireRoles(
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.PARAMEDIC
  ),
  listVehicles
);

router.get(
  '/:id',
  requireRoles(
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.PARAMEDIC,
    UserRole.DOCTOR
  ),
  getVehicle
);

router.post(
  '/',
  requireRoles(UserRole.ADMIN),
  createVehicle
);

router.patch(
  '/:id/location',
  requireRoles(
    UserRole.PARAMEDIC,
    UserRole.ADMIN,
    UserRole.DISPATCHER
  ),
  updateVehicleLocation
);

router.patch(
  '/:id/status',
  requireRoles(
    UserRole.PARAMEDIC,
    UserRole.ADMIN,
    UserRole.DISPATCHER
  ),
  updateVehicleStatus
);

export default router;
