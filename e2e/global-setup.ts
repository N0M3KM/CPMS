import { execFileSync } from 'node:child_process';

// Resets the _test database and loads the synthetic seed before the journeys run.
export default function globalSetup(): void {
  const url = process.env.TEST_DATABASE_URL ?? '';
  if (!url) throw new Error('TEST_DATABASE_URL is required for the end-to-end journeys');
  execFileSync('npx', ['tsx', 'e2e/prepare.ts'], { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
}
