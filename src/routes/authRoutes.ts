import { Router } from 'express';
import {
  login,
  register,
  getCurrentUser,
  listUsers,
} from '../controllers/authController';
import { protect, requireRoles } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

router.post('/login', login);
router.post(
  '/register',
  protect,
  requireRoles(UserRole.ADMIN),
  register
);
router.get('/me', protect, getCurrentUser);
router.get(
  '/users',
  protect,
  requireRoles(UserRole.ADMIN, UserRole.DISPATCHER),
  listUsers
);

export default router;
