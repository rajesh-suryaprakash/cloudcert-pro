import nodemailer from 'nodemailer';
import { logger } from '../logger';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

function getSmtpConfig(): SmtpConfig | null {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return {
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: SMTP_PORT === '465',
    user: SMTP_USER,
    pass: SMTP_PASS,
    from: SMTP_FROM ?? SMTP_USER,
  };
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetToken: string,
  appUrl: string,
): Promise<void> {
  const resetLink = `${appUrl}/reset-password?email=${encodeURIComponent(toEmail)}&code=${resetToken}`;
  const smtp = getSmtpConfig();

  if (!smtp) {
    // Dev fallback — no SMTP configured
    logger.warn(
      { email: toEmail, resetLink },
      '[DEV] No SMTP configured. Password reset link logged here.',
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  await transporter.sendMail({
    from: smtp.from,
    to: toEmail,
    subject: 'CloudCert Pro — Reset your password',
    text: `You requested a password reset.\n\nClick the link below to set a new password (valid for 1 hour):\n\n${resetLink}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `
      <p>You requested a password reset.</p>
      <p>Click the link below to set a new password (valid for 1 hour):</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `,
  });

  logger.info({ email: toEmail }, 'Password reset email sent');
}
