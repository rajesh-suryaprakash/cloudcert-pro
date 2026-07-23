import express, { type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authenticate, tokenBlacklist } from '../middleware/auth';
import { loginLimiter, registerLimiter, forgotLimiter } from '../middleware/rateLimiter';
import { validate, loginSchema, registerSchema, resetPasswordSchema } from '../middleware/validate';
import { config } from '../config';
import { UserRepository } from '../repositories/UserRepository';
import { RefreshTokenRepository } from '../repositories/RefreshTokenRepository';
import { db } from '../db/connection';
import { nowMs } from '../utils/time';
import { ValidationError, UnauthorizedError } from '../errors';
import { sendPasswordResetEmail } from '../services/EmailService';

const userRepo = new UserRepository(db);
const refreshTokenRepo = new RefreshTokenRepository(db);

function generateAndSetTokens(
  res: Response,
  user: { id: string; email: string; role: string },
): void {
  // Access Token: 15 minutes TTL
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, type: 'access', jti: crypto.randomUUID() },
    config.jwtSecret,
    { expiresIn: '15m' },
  );

  // Refresh Token: 7 days TTL
  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh', jti: crypto.randomUUID() },
    config.jwtSecret,
    { expiresIn: '7d' },
  );

  // Save refresh token to database
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  refreshTokenRepo.create(user.id, refreshToken, expiresAt);

  // Set Access Token cookie (15 min maxAge)
  res.cookie('token', accessToken, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  });

  // Set Refresh Token cookie (7 days maxAge), path restricted to /api/auth/refresh
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

const router = express.Router();

router.post(
  '/auth/register',
  registerLimiter,
  validate(registerSchema),
  async (req, res, next: NextFunction) => {
    try {
      const { email, password, name } = req.body;

      const existing = userRepo.findByEmail(email);
      if (existing)
        throw new ValidationError('An account with this email already exists. Please log in.');

      const id = crypto.randomUUID();
      const hashedPassword = await bcrypt.hash(password, 10);
      const now = nowMs();

      userRepo.create({
        id,
        email,
        password: hashedPassword,
        name,
        role: 'user',
        createdAt: now,
        updatedAt: now,
      });

      generateAndSetTokens(res, { id, email, role: 'user' });
      res.json({ user: { id, email, name, role: 'user', xp: 0 } });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/auth/login',
  loginLimiter,
  validate(loginSchema),
  async (req, res, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const user = userRepo.findByEmail(email);

      // A dummy hash designed to match default work factors
      const dummyHash = '$2b$10$abcdefghijklmnopqrstuvwxABCDEFGHIJKLMNOPQRSTUV';

      const isValid = user ? await bcrypt.compare(password, user.password) : false;
      if (!user) {
        await bcrypt.compare('dummy_password', dummyHash);
      }

      if (!isValid) {
        throw new UnauthorizedError('Invalid email or password.');
      }

      generateAndSetTokens(res, { id: user.id, email: user.email, role: user.role });
      res.json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, xp: user.xp },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/auth/me', authenticate, (req: Request, res: Response) => {
  if (!req.user) return res.json({ user: null });
  const user = userRepo.findById(req.user.id);
  if (!user) return res.json({ user: null });
  const { id, email, name, role, xp } = user;
  res.json({ user: { id, email, name, role, xp } });
});

router.post('/auth/logout', (req: Request, res: Response) => {
  const token = req.cookies?.token;
  const refreshToken = req.cookies?.refreshToken;

  if (token) {
    try {
      const decoded = jwt.decode(token) as { jti?: string; exp?: number } | null;
      if (decoded?.jti) {
        const expiresAt = decoded.exp ? decoded.exp * 1000 : Date.now() + 15 * 60 * 1000;
        tokenBlacklist.add(decoded.jti, expiresAt);
      }
    } catch {}
  }

  if (refreshToken) {
    refreshTokenRepo.deleteByToken(refreshToken);
  }
  res.clearCookie('token', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
  });
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/api/auth/refresh',
  });
  res.json({ success: true });
});

router.post('/auth/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    let refreshToken = req.cookies?.refreshToken;
    // Fallback for tests if needed
    if (!refreshToken && process.env.NODE_ENV === 'test') {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        refreshToken = authHeader.substring(7);
      }
    }

    if (!refreshToken) {
      throw new UnauthorizedError('No refresh token provided');
    }

    let decoded: string | jwt.JwtPayload;
    try {
      decoded = jwt.verify(refreshToken, config.jwtSecret);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const payload = typeof decoded === 'object' && decoded !== null ? decoded as { type?: string; id?: string } : null;

    if (!payload || payload.type !== 'refresh' || !payload.id) {
      throw new UnauthorizedError('Invalid token type');
    }

    const storedToken = refreshTokenRepo.findByToken(refreshToken);
    if (!storedToken || storedToken.expiresAt < Date.now()) {
      if (storedToken) {
        refreshTokenRepo.deleteByToken(refreshToken);
      }
      throw new UnauthorizedError('Refresh token expired or revoked');
    }

    const user = userRepo.findById(payload.id);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Delete the old rotated refresh token
    refreshTokenRepo.deleteByToken(refreshToken);

    // Generate new rotated tokens and cookies
    generateAndSetTokens(res, { id: user.id, email: user.email, role: user.role });

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, xp: user.xp },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Generates a password reset token.
 * Returns a random 32-byte nonce (sent to the user) and its HMAC-SHA256 digest
 * (stored in the database). The raw nonce is never stored.
 */
export function generateResetToken(): { nonce: string; digest: string } {
  const nonce = crypto.randomBytes(32).toString('hex');
  const digest = crypto.createHmac('sha256', config.resetTokenSecret).update(nonce).digest('hex');
  return { nonce, digest };
}

/**
 * Verifies a submitted reset token against the stored HMAC digest.
 * Recomputes the HMAC of the submitted nonce and compares using timingSafeEqual
 * to prevent timing attacks.
 */
export function verifyResetToken(submitted: string, storedDigest: string): boolean {
  const submittedDigest = crypto
    .createHmac('sha256', config.resetTokenSecret)
    .update(submitted)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(submittedDigest, 'hex'),
    Buffer.from(storedDigest, 'hex'),
  );
}

/**
 * Pure function: given whether the user exists, returns the response body.
 * The response body is always the same generic message regardless of user existence.
 * Exported for property-based testing.
 */
export function buildForgotResponseBody(): { message: string } {
  return { message: 'If that email exists, a reset link has been sent.' };
}

export async function forgotPasswordResponse(
  email: string,
  appUrl: string,
): Promise<{ body: Record<string, unknown>; statusCode: number }> {
  const user = userRepo.findByEmail(email);
  const body = buildForgotResponseBody();

  if (!user) {
    return { body, statusCode: 200 };
  }

  const { nonce, digest } = generateResetToken();
  const resetExpire = nowMs() + 3600000; // 1 hour
  userRepo.setResetToken(user.id, digest, resetExpire);

  await sendPasswordResetEmail(email, nonce, appUrl);

  return { body, statusCode: 200 };
}

function validateAppUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Invalid protocol');
    }
    if (process.env.APP_URL) {
      const allowed = new URL(process.env.APP_URL);
      if (parsed.hostname !== allowed.hostname) {
        return process.env.APP_URL;
      }
    } else {
      const isLocal =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname.endsWith('.localhost');
      if (!isLocal) {
        throw new Error('Host header injection detected');
      }
    }
    return urlStr;
  } catch {
    return process.env.APP_URL ?? 'http://localhost:5173';
  }
}

router.post('/auth/forgot', forgotLimiter, async (req: Request, res: Response) => {
  const rawAppUrl = process.env.APP_URL ?? `${req.protocol}://${req.get('host')}`;
  const appUrl = validateAppUrl(rawAppUrl);
  const { statusCode, body } = await forgotPasswordResponse(req.body.email, appUrl);
  res.status(statusCode).json(body);
});

router.post(
  '/auth/reset',
  forgotLimiter,
  validate(resetPasswordSchema),
  async (req, res, next: NextFunction) => {
    try {
      const { email, code, password } = req.body;

      const candidate = userRepo.findByResetToken(email, nowMs());

      if (
        !candidate ||
        !candidate.resetPasswordToken ||
        !verifyResetToken(code, candidate.resetPasswordToken)
      ) {
        throw new ValidationError('Invalid or expired reset token');
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      userRepo.updatePassword(candidate.id, hashedPassword);
      userRepo.clearResetToken(candidate.id);

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
