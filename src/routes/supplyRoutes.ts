import { Router } from 'express';
import {
  recordSupplyUsage,
  checkVehicleStock,
  createSupplyRequest,
  autoGenerateSupplyRequest,
  listSupplyRequests,
  updateSupplyRequestStatus,
  listMedicalSupplies,
  refillVehicleFuel,
} from '../controllers/supplyController';
import { protect, requireRoles } from '../middleware/auth';
import { UserRole } from '../utils/enums';

const router = Router();

router.use(protect);

router.get(
  '/supplies',
  requireRoles(
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.PARAMEDIC
  ),
  listMedicalSupplies
);

router.post(
  '/usage/:dispatchId',
  requireRoles(UserRole.PARAMEDIC, UserRole.ADMIN),
  recordSupplyUsage
);

router.get(
  '/stock/:vehicleId',
  requireRoles(
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.PARAMEDIC
  ),
  checkVehicleStock
);

router.post(
  '/requests',
  requireRoles(
    UserRole.PARAMEDIC,
    UserRole.DISPATCHER,
    UserRole.ADMIN
  ),
  createSupplyRequest
);

router.post(
  '/requests/auto/:vehicleId',
  requireRoles(
    UserRole.PARAMEDIC,
    UserRole.DISPATCHER,
    UserRole.ADMIN
  ),
  autoGenerateSupplyRequest
);

router.get(
  '/requests',
  requireRoles(UserRole.ADMIN, UserRole.DISPATCHER),
  listSupplyRequests
);

router.patch(
  '/requests/:id',
  requireRoles(UserRole.ADMIN, UserRole.DISPATCHER),
  updateSupplyRequestStatus
);

router.post(
  '/fuel/refill/:vehicleId',
  requireRoles(UserRole.ADMIN, UserRole.DISPATCHER),
  refillVehicleFuel
);

export default router;
