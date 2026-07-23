import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import nodemailer from 'nodemailer';
import { sendPasswordResetEmail } from './EmailService';
import { logger } from '../logger';

vi.mock('../logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe('EmailService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should log warning in development fallback when SMTP environment variables are missing', async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    await sendPasswordResetEmail('test@example.com', 'reset-token-123', 'http://localhost:3000');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@example.com',
        resetLink: expect.stringContaining('code=reset-token-123'),
      }),
      expect.stringContaining('[DEV] No SMTP configured'),
    );
  });

  it('should use nodemailer to send email when SMTP env vars are present', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'user@example.com';
    process.env.SMTP_PASS = 'password';
    process.env.SMTP_FROM = 'no-reply@example.com';

    const sendMailMock = vi.fn().mockResolvedValue({ messageId: '123' });
    const createTransportMock = vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail: sendMailMock,
    } as any);

    await sendPasswordResetEmail('test@example.com', 'reset-token-123', 'http://localhost:3000');

    expect(createTransportMock).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'user@example.com', pass: 'password' },
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'no-reply@example.com',
        to: 'test@example.com',
        subject: expect.stringContaining('Reset your password'),
        text: expect.stringContaining('http://localhost:3000/reset-password'),
      }),
    );

    expect(logger.info).toHaveBeenCalledWith(
      { email: 'test@example.com' },
      'Password reset email sent',
    );
  });
});
