import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  register,
  registerValidations,
  login,
  loginValidations,
  me,
  updateProfile,
  updateProfileValidations,
  deleteAccount,
  deleteAccountValidations,
} from '../controllers/auth.controller';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(authLimiter);

/** POST /api/auth/register – create account, return JWT + user */
router.post('/register', validate(registerValidations), register);

/** POST /api/auth/login – authenticate, return JWT + user */
router.post('/login', validate(loginValidations), login);

/** GET /api/auth/me – current user (protected) */
router.get('/me', authMiddleware, me);

/** PATCH /api/auth/profile – update name, email, and/or password (protected) */
router.patch('/profile', authMiddleware, validate(updateProfileValidations), updateProfile);

/** DELETE /api/auth/account – delete account and all data (protected) */
router.delete('/account', authMiddleware, validate(deleteAccountValidations), deleteAccount);

export default router;
