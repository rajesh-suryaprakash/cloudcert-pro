import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    testTimeout: 120000,
    hookTimeout: 30000,
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',

    // ── Test reporters ─────────────────────────────────────────────────────────
    // In CI (process.env.CI is set by GitHub Actions automatically):
    //   - junit  → test-results/junit.xml   — consumed by dorny/test-reporter for
    //              GitHub PR check annotations and job summary
    //   - json   → test-results/results.json — machine-readable results for
    //              dashboards / further processing
    //   - html   → test-results/index.html  — interactive static HTML report
    //              (served by @vitest/ui, downloadable as CI artifact)
    // Locally: only the default console reporter runs to keep dev noise-free.
    reporters: process.env.CI ? ['default', 'junit', 'json', 'html'] : ['default'],
    outputFile: {
      junit: 'test-results/junit.xml',
      json: 'test-results/results.json',
      html: 'test-results/index.html',
    },

    // ── Coverage ───────────────────────────────────────────────────────────────
    coverage: {
      provider: 'v8',
      // text    — console table (always useful)
      // lcov    — standard format consumed by Codecov / Coveralls
      // html    — browseable report (uploaded as CI artifact)
      // json    — Codecov JSON alternative
      // clover  — compatible with additional CI coverage tools
      reporter: ['text', 'lcov', 'html', 'json', 'clover'],
      // Exclude non-source files from coverage measurement
      exclude: [
        'node_modules/**',
        'dist/**',
        'src/test/**',
        '**/*.test.{ts,tsx}',
        '**/*.config.{ts,js}',
        'scripts/**',
        'sdk/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
