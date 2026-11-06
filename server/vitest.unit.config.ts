import { defineConfig } from 'vitest/config';

// DB-free tests only (no migrations, no database needed).
export default defineConfig({
  test: { include: [
      'tests/auth.test.ts',
      'tests/clock.test.ts',
      'tests/code-gates.test.ts',
      'tests/config.test.ts',
      'tests/contrast.test.ts',
      'tests/feedback-policy.test.ts',
      'tests/health.test.ts',
      'tests/milestone-status.test.ts',
      'tests/scope.test.ts',
      'tests/submission-policy.test.ts',
      'tests/secrets.test.ts',
      'tests/security.test.ts',
    ] },
});
