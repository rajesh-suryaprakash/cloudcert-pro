import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    logger.warn({ correlationId: req.correlationId, err }, err.message);
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  logger.error({ correlationId: req.correlationId, err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
};
