import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? '';
const apiEnv = { ...process.env, DATABASE_URL: testDatabaseUrl, PORT: '3000', NODE_ENV: 'development' } as Record<string, string>;

// End-to-end journeys run against the separate test database with the real API and client.
// They use the locally installed Chrome (set E2E_CHANNEL to use another channel).
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    channel: process.env.E2E_CHANNEL ?? 'chrome',
    viewport: { width: 1000, height: 760 },
  },
  webServer: [
    { command: 'npm run dev -w server', url: 'http://localhost:3000/api/health', env: apiEnv, reuseExistingServer: false, timeout: 60_000 },
    { command: 'npm run dev -w client', url: 'http://localhost:5173', env: apiEnv, reuseExistingServer: false, timeout: 60_000 },
  ],
});
