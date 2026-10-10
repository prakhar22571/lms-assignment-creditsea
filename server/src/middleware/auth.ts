import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '../models.js';

export interface AuthUser {
  id: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const secret = () => process.env.JWT_SECRET!;

export const signToken = (u: AuthUser) => jwt.sign({ role: u.role }, secret(), { subject: u.id, expiresIn: '1d' });

/** 401 when the token is missing or invalid. */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const p = jwt.verify(token, secret()) as jwt.JwtPayload;
    req.user = { id: p.sub!, role: p.role };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** 403 when authenticated but the role isn't in the allow-list. */
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (req.user && roles.includes(req.user.role)) return next();
    res.status(403).json({ error: 'Forbidden for your role' });
  };
