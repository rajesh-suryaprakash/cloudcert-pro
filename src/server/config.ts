const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required but not set');
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters for adequate HMAC-SHA256 security');
  }
  return secret;
};

const getResetTokenSecret = (): string => {
  const secret = process.env.RESET_TOKEN_SECRET;
  if (!secret) {
    throw new Error('RESET_TOKEN_SECRET environment variable is required but not set');
  }
  if (secret.length < 32) {
    throw new Error('RESET_TOKEN_SECRET must be at least 32 characters');
  }
  return secret;
};

const getPort = (): number => {
  const p = Number(process.env.PORT ?? 3000);
  if (isNaN(p) || p < 1 || p > 65535) {
    throw new Error('PORT must be a valid port number (1–65535)');
  }
  return p;
};

const getMaxPauseCount = (): number => {
  const count = Number(process.env.MAX_PAUSE_COUNT ?? 3);
  if (isNaN(count) || count < 0) {
    return 3;
  }
  return count;
};

const getMaxTotalPauseMs = (): number => {
  const ms = Number(process.env.MAX_TOTAL_PAUSE_MS ?? 30 * 60 * 1000);
  if (isNaN(ms) || ms < 0) {
    return 30 * 60 * 1000;
  }
  return ms;
};

export const config = {
  get jwtSecret(): string {
    return getJwtSecret();
  },
  get resetTokenSecret(): string {
    return getResetTokenSecret();
  },
  get maxPauseCount(): number {
    return getMaxPauseCount();
  },
  get maxTotalPauseMs(): number {
    return getMaxTotalPauseMs();
  },
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: getPort(),
} as const;
