import { defineConfig } from 'vitest/config';

// DB-free tests only (no migrations, no database needed).
export default defineConfig({
  test: { include: ['tests/auth.test.ts', 'tests/config.test.ts', 'tests/clock.test.ts', 'tests/health.test.ts'] },
});
