import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';
const level = process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info');

export const logger = pino({
  level,
  redact: {
    paths: [
      'password',
      'token',
      'authorization',
      'cookie',
      'secret',
      '*.password',
      '*.token',
      '*.authorization',
      '*.cookie',
      '*.secret',
      '**.password',
      '**.token',
      '**.authorization',
      '**.cookie',
      '**.secret',
    ],
    censor: '[REDACTED]',
  },
  transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
});
