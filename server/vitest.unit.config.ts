import { defineConfig } from 'vitest/config';

// DB-free tests only (no migrations, no database needed).
export default defineConfig({
  test: { include: ['tests/config.test.ts', 'tests/clock.test.ts', 'tests/health.test.ts'] },
});
