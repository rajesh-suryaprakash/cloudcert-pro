/**
 * Unit tests for useDocumentTitle utilities.
 */

import { describe, it, expect } from 'vitest';
import { buildTitle, APP_NAME } from './useDocumentTitle';

describe('buildTitle', () => {
  it('returns the app name when pageTitle is null', () => {
    expect(buildTitle(null)).toBe(APP_NAME);
  });

  it('returns the app name when pageTitle is undefined', () => {
    expect(buildTitle(undefined)).toBe(APP_NAME);
  });

  it('returns the app name when pageTitle is an empty string', () => {
    expect(buildTitle('')).toBe(APP_NAME);
  });

  it('returns the app name when pageTitle is only whitespace', () => {
    expect(buildTitle('   ')).toBe(APP_NAME);
  });

  it('returns the app name when pageTitle equals the app name (no duplication)', () => {
    expect(buildTitle(APP_NAME)).toBe(APP_NAME);
  });

  it('builds "Page | CloudCert Pro" for a normal page title', () => {
    expect(buildTitle('Dashboard')).toBe('Dashboard | CloudCert Pro');
  });

  it('builds "Page | CloudCert Pro" for Admin Portal', () => {
    expect(buildTitle('Admin Portal')).toBe('Admin Portal | CloudCert Pro');
  });

  it('builds "Page | CloudCert Pro" for Practice Exam', () => {
    expect(buildTitle('Practice Exam')).toBe('Practice Exam | CloudCert Pro');
  });

  it('trims leading/trailing whitespace from pageTitle', () => {
    expect(buildTitle('  Insights  ')).toBe('Insights | CloudCert Pro');
  });

  it('handles dynamic titles with cert names', () => {
    expect(buildTitle('GCP ACE — Practice')).toBe('GCP ACE — Practice | CloudCert Pro');
  });
});
