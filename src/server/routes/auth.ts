import express, { type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth';
import { loginLimiter, registerLimiter, forgotLimiter } from '../middleware/rateLimiter';
import { validate, loginSchema, registerSchema, resetPasswordSchema } from '../middleware/validate';
import { config } from '../config';
import { UserRepository } from '../repositories/UserRepository';
import { db } from '../db/connection';
import { nowMs } from '../utils/time';
import { ValidationError, UnauthorizedError } from '../errors';
import { sendPasswordResetEmail } from '../services/EmailService';

const userRepo = new UserRepository(db);

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

      const token = jwt.sign({ id, email, role: 'user' }, config.jwtSecret, { expiresIn: '7d' });
      res.cookie('token', token, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
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

      if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new UnauthorizedError('Invalid email or password.');
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        config.jwtSecret,
        {
          expiresIn: '7d',
        },
      );
      res.cookie('token', token, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
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

router.post('/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
  });
  res.json({ success: true });
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

router.post('/auth/forgot', forgotLimiter, async (req: Request, res: Response) => {
  const appUrl = process.env.APP_URL ?? `${req.protocol}://${req.get('host')}`;
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
