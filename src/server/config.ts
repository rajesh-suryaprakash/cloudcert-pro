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

export const config = {
  get jwtSecret(): string {
    return getJwtSecret();
  },
  get resetTokenSecret(): string {
    return getResetTokenSecret();
  },
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: getPort(),
} as const;
