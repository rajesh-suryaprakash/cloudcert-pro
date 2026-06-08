import { describe, it, expect, afterEach, vi } from 'vitest';

describe('config', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  afterEach(() => {
    // Restore original env
    if (originalJwtSecret !== undefined) {
      process.env.JWT_SECRET = originalJwtSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
    // Clear module cache so config re-evaluates
    vi.resetModules();
  });

  it('throws when JWT_SECRET is not set', async () => {
    delete process.env.JWT_SECRET;
    vi.resetModules();
    const { config } = await import('./config');
    expect(() => config.jwtSecret).toThrow(
      'JWT_SECRET environment variable is required but not set',
    );
  });

  it('returns jwtSecret when JWT_SECRET is set', async () => {
    process.env.JWT_SECRET = 'test-secret-value-32-characters-long!!';
    vi.resetModules();
    const { config } = await import('./config');
    expect(config.jwtSecret).toBe('test-secret-value-32-characters-long!!');
  });

  it('throws when JWT_SECRET is too short', async () => {
    process.env.JWT_SECRET = 'short';
    vi.resetModules();
    const { config } = await import('./config');
    expect(() => config.jwtSecret).toThrow(
      'JWT_SECRET must be at least 32 characters for adequate HMAC-SHA256 security',
    );
  });
});
