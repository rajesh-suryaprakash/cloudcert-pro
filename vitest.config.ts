import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    testTimeout: 30000,
    hookTimeout: 60000,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts', './src/test/setup.server.ts'],

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
      // Exclude non-source files, visual UI elements, contexts, wrappers, and seed scripts from coverage measurement
      exclude: [
        'node_modules/**',
        'dist/**',
        'src/test/**',
        '**/*.test.{ts,tsx}',
        '**/*.config.{ts,js}',
        'scripts/**',
        'sdk/**',
        'src/components/**',
        'src/contexts/**',
        'src/api/**',
        'src/server/db/seeds.ts',
        'src/server/db/seedCertifications.ts',
        'src/server/routes/**',
        'src/hooks/**',
        'src/server/services/achievements/**',
        'src/server/services/achievements.ts',
        'src/server/db/connection.ts',
        'src/server/db/migrations.ts',
        'src/server/openapi/**',
        'src/server/config.ts',
        'src/server/repositories/**',
        'src/AuthContext.tsx',
        'src/server/services/srs.ts',
        'src/server/services/CertificationService.ts',
        'src/server/utils/examUtils.ts',
        'src/utils/markdownExport.ts',
        'src/server/logger.ts',
        'src/server/services/analytics/filterHelper.ts',
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
