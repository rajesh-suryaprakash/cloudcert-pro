import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { requireUser } from './auth';
import { UnauthorizedError } from '../errors';

function makeReq(user?: Request['user']): Request {
  return { user } as unknown as Request;
}

describe('requireUser', () => {
  it('returns the user object when req.user is set', () => {
    const user = { id: 'user-1', email: 'a@b.com', role: 'learner' };
    const req = makeReq(user);
    expect(requireUser(req)).toBe(user);
  });

  it('throws UnauthorizedError when req.user is undefined', () => {
    const req = makeReq(undefined);
    expect(() => requireUser(req)).toThrow(UnauthorizedError);
  });

  it('thrown error has the correct message', () => {
    const req = makeReq(undefined);
    expect(() => requireUser(req)).toThrow('Unauthorized');
  });
});
