// Set environment variables before importing configs, but do not override DB_PATH to memory
// to prevent test pollution of the shared module cache in Vitest.
process.env.JWT_SECRET = 'test_jwt_secret_must_be_at_least_32_chars_long';
process.env.RESET_TOKEN_SECRET = 'test_reset_token_secret_must_be_at_least_32_chars_long';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { db } from '../db/connection';
import authRoutes from './auth';
import { authenticate } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(authRoutes);

  app.get('/api/test-protected', authenticate, (req: Request, res: Response) => {
    res.json({ success: true, user: req.user });
  });

  app.use(errorHandler);
  return app;
}

describe.sequential('Refresh Token Rotation Integration Tests', () => {
  let app: express.Express;

  beforeEach(() => {
    // Clean up specifically our test user to ensure clean test state without polluting other tests
    db.prepare("DELETE FROM users WHERE email = 'test@example.com'").run();
    app = createApp();
  });

  afterEach(() => {
    db.prepare("DELETE FROM users WHERE email = 'test@example.com'").run();
  });

  it('register should issue access and refresh token cookies', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'test@example.com',
      password: 'Password123!',
      name: 'Test Rotation User',
    });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();

    const cookies = (res.headers['set-cookie'] || []) as any;
    const hasToken = cookies.some((c: string) => c.startsWith('token='));
    const hasRefreshToken = cookies.some((c: string) => c.startsWith('refreshToken='));

    expect(hasToken).toBe(true);
    expect(hasRefreshToken).toBe(true);
  });

  it('login should issue access and refresh token cookies', async () => {
    await request(app).post('/auth/register').send({
      email: 'test@example.com',
      password: 'Password123!',
      name: 'Test Rotation User',
    });

    const res = await request(app).post('/auth/login').send({
      email: 'test@example.com',
      password: 'Password123!',
    });

    expect(res.status).toBe(200);

    const cookies = (res.headers['set-cookie'] || []) as any;
    const hasToken = cookies.some((c: string) => c.startsWith('token='));
    const hasRefreshToken = cookies.some((c: string) => c.startsWith('refreshToken='));

    expect(hasToken).toBe(true);
    expect(hasRefreshToken).toBe(true);
  });

  it('refresh should rotate both access and refresh cookies and invalidate the old one', async () => {
    const regRes = await request(app).post('/auth/register').send({
      email: 'test@example.com',
      password: 'Password123!',
      name: 'Test Rotation User',
    });

    const regCookies = (regRes.headers['set-cookie'] || []) as any;
    const refreshTokenCookie = regCookies.find((c: string) => c.startsWith('refreshToken='));
    const rawCookie = refreshTokenCookie.split(';')[0];
    const refreshTokenVal = decodeURIComponent(rawCookie.split('=')[1]);

    const refreshRes = await request(app)
      .post('/auth/refresh')
      .set('Cookie', [`refreshToken=${refreshTokenVal}`]);

    expect(refreshRes.status).toBe(200);

    const newCookies = (refreshRes.headers['set-cookie'] || []) as any;
    const hasToken = newCookies.some((c: string) => c.startsWith('token='));
    const hasRefreshToken = newCookies.some((c: string) => c.startsWith('refreshToken='));

    expect(hasToken).toBe(true);
    expect(hasRefreshToken).toBe(true);

    // Old refresh token must be rotated/deleted and should fail
    const reuseRes = await request(app)
      .post('/auth/refresh')
      .set('Cookie', [`refreshToken=${refreshTokenVal}`]);

    expect(reuseRes.status).toBe(401);
  });

  it('logout should clear cookies and delete refresh token from db', async () => {
    const regRes = await request(app).post('/auth/register').send({
      email: 'test@example.com',
      password: 'Password123!',
      name: 'Test Rotation User',
    });

    const regCookies = (regRes.headers['set-cookie'] || []) as any;
    const refreshTokenCookie = regCookies.find((c: string) => c.startsWith('refreshToken='));
    const rawCookie = refreshTokenCookie.split(';')[0];
    const refreshTokenVal = decodeURIComponent(rawCookie.split('=')[1]);

    const logoutRes = await request(app)
      .post('/auth/logout')
      .set('Cookie', [`refreshToken=${refreshTokenVal}`]);

    expect(logoutRes.status).toBe(200);

    const logoutCookies = (logoutRes.headers['set-cookie'] || []) as any;
    const tokenCleared = logoutCookies.some((c: string) => c.includes('token=;'));
    const refreshTokenCleared = logoutCookies.some((c: string) => c.includes('refreshToken=;'));
    expect(tokenCleared).toBe(true);
    expect(refreshTokenCleared).toBe(true);

    const refreshRes = await request(app)
      .post('/auth/refresh')
      .set('Cookie', [`refreshToken=${refreshTokenVal}`]);

    expect(refreshRes.status).toBe(401);
  });

  it('authenticate middleware should reject refresh tokens (type confusion check)', async () => {
    const regRes = await request(app).post('/auth/register').send({
      email: 'test@example.com',
      password: 'Password123!',
      name: 'Test Rotation User',
    });

    const regCookies = (regRes.headers['set-cookie'] || []) as any;
    const refreshTokenCookie = regCookies.find((c: string) => c.startsWith('refreshToken='));
    const rawCookie = refreshTokenCookie.split(';')[0];
    const refreshTokenVal = decodeURIComponent(rawCookie.split('=')[1]);

    const accessRes = await request(app)
      .get('/api/test-protected')
      .set('Cookie', [`token=${refreshTokenVal}`]);

    expect(accessRes.status).toBe(401);
    expect(accessRes.body.error).toContain('Invalid token type');
  });
});
