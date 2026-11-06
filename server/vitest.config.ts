import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envFile = resolve(__dirname, '../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? '';

export default defineConfig({
  test: {
    globalSetup: ['./tests/globalSetup.ts'],
    // Integration tests share one database, so run files one at a time.
    fileParallelism: false,
    env: { DATABASE_URL: testDatabaseUrl },
    testTimeout: 20000,
  },
});
