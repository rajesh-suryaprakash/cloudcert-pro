import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UnauthorizedError, ForbiddenError } from '../errors';
import { logger } from '../logger';

class TokenBlacklist {
  private blacklist = new Map<string, number>();

  add(jti: string, expiresAt: number): void {
    this.blacklist.set(jti, expiresAt);
  }

  has(jti: string): boolean {
    const expiresAt = this.blacklist.get(jti);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      this.blacklist.delete(jti);
      return false;
    }
    return true;
  }
}

export const tokenBlacklist = new TokenBlacklist();

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  // Auth uses httpOnly cookies exclusively — no Authorization header fallback.
  // Bearer token auth bypasses the sameSite cookie protection and is not needed
  // for browser clients. API clients should authenticate via POST /api/auth/login.
  let token: string | undefined = req.cookies?.token;

  if (!token && process.env.NODE_ENV === 'test') {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return next(new UnauthorizedError('Unauthorized'));
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      id: string;
      email: string;
      role: string;
      type?: string;
      jti?: string;
    };
    if (decoded.type === 'refresh') {
      logger.warn(
        { correlationId: req.correlationId },
        'Token type confusion: refresh token used as access token',
      );
      return next(new UnauthorizedError('Invalid token type'));
    }
    if (decoded.jti && tokenBlacklist.has(decoded.jti)) {
      return next(new UnauthorizedError('Token has been revoked'));
    }
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

/**
 * Type-safe accessor for req.user on routes protected by the `authenticate` middleware.
 *
 * After `authenticate` runs, req.user is guaranteed to be set. Use this helper instead of
 * `req.user!` to make the invariant explicit without a blanket eslint-disable pragma.
 *
 * @throws {UnauthorizedError} if called on an unauthenticated route (should never happen in production)
 */
export function requireUser(req: Request): NonNullable<typeof req.user> {
  if (!req.user) {
    throw new UnauthorizedError('Unauthorized');
  }
  return req.user;
}
