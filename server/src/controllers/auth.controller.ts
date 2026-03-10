import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, ValidationChain } from 'express-validator';
import { PrismaClient, Prisma } from '@prisma/client';
import { AuthUser } from '../types/auth';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET!;
const SALT_ROUNDS = 12;
const JWT_EXPIRES_IN = '7d';

/** User object returned in API responses (no password). */
interface UserResponse {
  id: string;
  email: string;
  name: string;
  plan: string;
  portfolioAmount: number | null;
  createdAt: Date;
}

function toUserResponse(user: {
  id: string;
  email: string;
  name: string;
  plan: string;
  portfolioAmount?: Prisma.Decimal | null;
  createdAt: Date;
}): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    portfolioAmount: user.portfolioAmount != null ? Number(user.portfolioAmount) : null,
    createdAt: user.createdAt,
  };
}

function signToken(payload: AuthUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Register: validate body, check duplicate email, hash password, create user, return JWT + user.
 */
export const registerValidations: ValidationChain[] = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
];

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name } = req.body as { email: string; password: string; name: string };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({
        success: false,
        error: 'An account with this email already exists.',
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email,
        name: name.trim(),
        password: hashedPassword,
        plan: 'free',
      },
    });

    const token = signToken({ id: user.id, email: user.email });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: toUserResponse(user),
      },
    });
  } catch (err) {
    console.error('register error', err);
    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.',
    });
  }
}

/**
 * Login: validate email + password, find user, compare password, return JWT + user.
 * Generic message on not found or wrong password for security.
 */
export const loginValidations: ValidationChain[] = [
  body('email').notEmpty().withMessage('Email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
      return;
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
      return;
    }

    const token = signToken({ id: user.id, email: user.email });

    res.json({
      success: true,
      data: {
        token,
        user: toUserResponse(user),
      },
    });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.',
    });
  }
}

/**
 * Me: protected route; return current user from DB (fresh fetch).
 */
export async function me(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated.',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, plan: true, portfolioAmount: true, createdAt: true },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found.',
      });
      return;
    }

    res.json({
      success: true,
      data: { user: toUserResponse(user) },
    });
  } catch (err) {
    console.error('me error', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile.',
    });
  }
}

/**
 * PATCH /api/auth/profile – update name, email, and/or password.
 * Auth required. Name min 2 chars; email valid and unique; password change requires currentPassword + newPassword.
 */
export const updateProfileValidations: ValidationChain[] = [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('portfolioAmount').optional().custom((v) => v === null || v === '' || (typeof v === 'number' && v >= 0)).withMessage('Portfolio amount must be a non-negative number'),
  body('currentPassword').optional().notEmpty().withMessage('Current password is required to change password'),
  body('newPassword').optional().isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
];

export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated.' });
      return;
    }
    const userId = req.user.id;
    const b = req.body as {
      name?: string;
      email?: string;
      portfolioAmount?: number | string | null;
      currentPassword?: string;
      newPassword?: string;
    };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(401).json({ success: false, error: 'User not found.' });
      return;
    }

    const updates: { name?: string; email?: string; password?: string; portfolioAmount?: Prisma.Decimal | null } = {};

    if (b.name !== undefined) {
      const name = String(b.name).trim();
      if (name.length < 2) {
        res.status(400).json({ success: false, error: 'Name must be at least 2 characters.' });
        return;
      }
      updates.name = name;
    }

    if (b.email !== undefined) {
      const email = String(b.email).trim().toLowerCase();
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== userId) {
        res.status(409).json({ success: false, error: 'An account with this email already exists.' });
        return;
      }
      updates.email = email;
    }

    if (b.newPassword !== undefined && String(b.newPassword).trim()) {
      const currentPassword = b.currentPassword;
      if (!currentPassword) {
        res.status(400).json({ success: false, error: 'Current password is required to change password.' });
        return;
      }
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) {
        res.status(401).json({ success: false, error: 'Current password is incorrect.' });
        return;
      }
      updates.password = await bcrypt.hash(String(b.newPassword).trim(), SALT_ROUNDS);
    }

    if (b.portfolioAmount !== undefined) {
      if (b.portfolioAmount === null || b.portfolioAmount === '') {
        updates.portfolioAmount = null;
      } else {
        const num = typeof b.portfolioAmount === 'number' ? b.portfolioAmount : Number(b.portfolioAmount);
        if (!Number.isFinite(num) || num < 0) {
          res.status(400).json({ success: false, error: 'Portfolio amount must be a non-negative number.' });
          return;
        }
        updates.portfolioAmount = new Prisma.Decimal(num);
      }
    }

    if (Object.keys(updates).length === 0) {
      res.json({
        success: true,
        data: { user: toUserResponse(user) },
      });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updates,
    });

    res.json({
      success: true,
      data: { user: toUserResponse(updated) },
    });
  } catch (err) {
    console.error('updateProfile error', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile.',
    });
  }
}

/**
 * DELETE /api/auth/account – require password, delete all user data and user.
 */
export const deleteAccountValidations: ValidationChain[] = [
  body('password').notEmpty().withMessage('Password confirmation is required'),
];

export async function deleteAccount(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated.' });
      return;
    }
    const userId = req.user.id;
    const password = (req.body as { password?: string }).password;

    if (!password) {
      res.status(400).json({ success: false, error: 'Password confirmation is required.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(401).json({ success: false, error: 'User not found.' });
      return;
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      res.status(401).json({ success: false, error: 'Invalid password.' });
      return;
    }

    await prisma.user.delete({ where: { id: userId } });

    res.status(200).json({
      success: true,
      data: { message: 'Account deleted.' },
    });
  } catch (err) {
    console.error('deleteAccount error', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account.',
    });
  }
}
