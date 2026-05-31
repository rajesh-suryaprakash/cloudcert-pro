import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export function correlationId(req: Request, _res: Response, next: NextFunction): void {
  req.correlationId = (req.headers['x-correlation-id'] as string) ?? randomUUID();
  next();
}
