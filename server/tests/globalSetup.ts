import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Applies migrations to the separate test database before any test runs.
// Refuses to run against anything whose database name does not end in _test.
export default function setup(): void {
  const url = process.env.TEST_DATABASE_URL ?? '';
  const dbName = url ? new URL(url).pathname.replace(/^\//, '') : '';
  if (!dbName.endsWith('_test')) {
    throw new Error('Refusing to run tests: TEST_DATABASE_URL must point to a database whose name ends in _test.');
  }
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
