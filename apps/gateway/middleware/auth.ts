import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@ai-interviewer/shared';
import { AppError } from '../errors/AppError';

export interface JwtPayload {
  id: string;
  email: string;
  plan: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export const authenticateToken = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(new AppError('UNAUTHORIZED', 'Missing token', 401));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    (req as AuthRequest).user = decoded;
    next();
  } catch {
    return next(new AppError('FORBIDDEN', 'Invalid or expired token', 403));
  }
};
