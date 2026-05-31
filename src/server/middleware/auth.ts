import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UnauthorizedError, ForbiddenError } from '../errors';
import { logger } from '../logger';

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  // Prefer httpOnly cookie; fall back to Authorization header for API clients
  const token: string | undefined = req.cookies?.token ?? req.headers.authorization?.split(' ')[1];

  if (!token) {
    return next(new UnauthorizedError('Unauthorized'));
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      id: string;
      email: string;
      role: string;
    };
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      logger.info({ correlationId: req.correlationId }, 'JWT expired');
      return next(new UnauthorizedError('Token expired'));
    }
    logger.warn({ correlationId: req.correlationId }, 'Invalid JWT token');
    next(new UnauthorizedError('Invalid token'));
  }
};

export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin') {
    return next(new ForbiddenError('Forbidden'));
  }
  next();
};
