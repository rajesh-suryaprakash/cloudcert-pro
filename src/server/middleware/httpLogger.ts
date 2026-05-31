import pinoHttp from 'pino-http';
import { logger } from '../logger';
import type { Request } from 'express';

export const httpLogger = pinoHttp({
  logger,
  customLogLevel(_req, res, _err) {
    return res.statusCode >= 400 ? 'warn' : 'info';
  },
  customProps(req: Request) {
    return { correlationId: req.correlationId };
  },
  serializers: {
    req(req) {
      // Sanitize URL to prevent log injection via newline characters
      const sanitizedUrl = req.url.replace(/[\r\n]/g, '');
      return { method: req.method, url: sanitizedUrl };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
  },
});
