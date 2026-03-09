import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthUser } from '../types/auth';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn('JWT_SECRET is not set; auth will fail at runtime.');
}

/**
 * JWT auth middleware.
 * Reads Bearer token from Authorization header, verifies with JWT_SECRET,
 * attaches decoded user (id, email) to req.user.
 * Returns 401 with clear error message if missing or invalid.
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authorization header missing or invalid. Use: Bearer <token>',
    });
    return;
  }

  const token = authHeader.slice(7);

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Token is missing.',
    });
    return;
  }

  if (!JWT_SECRET) {
    res.status(500).json({
      success: false,
      error: 'Server configuration error.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;

    if (!decoded.id || !decoded.email) {
      res.status(401).json({
        success: false,
        error: 'Token payload invalid.',
      });
      return;
    }

    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: 'Token is invalid or expired.',
    });
  }
}
