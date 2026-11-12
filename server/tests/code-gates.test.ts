import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

function files(dir: string, ext: RegExp, skip = /node_modules|dist|\.git/): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (skip.test(full)) return [];
    return statSync(full).isDirectory() ? files(full, ext, skip) : ext.test(name) ? [full] : [];
  });
}

const serverSources = files(join(root, 'server/src'), /\.ts$/);
const clientSources = files(join(root, 'client/src'), /\.(ts|tsx)$/);

function offenders(list: string[], pattern: RegExp): string[] {
  return list.filter((f) => pattern.test(readFileSync(f, 'utf8'))).map((f) => f.replace(root, ''));
}

describe('code gates (SEC-02, SEC-04, SEC-11, SEC-12)', () => {
  it('runs no shell commands (SEC-12)', () => {
    expect(offenders(serverSources, /child_process|\bexecSync\b|\bspawnSync\b|\bexecFile\b|\bspawn\(|\bexec\(/)).toEqual([]);
  });
  it('builds no raw SQL from strings (SEC-02)', () => {
    expect(offenders(serverSources, /\$queryRawUnsafe|\$executeRawUnsafe/)).toEqual([]);
  });
  it('makes no server-side outbound requests (SEC-04)', () => {
    expect(offenders(serverSources, /\bfetch\(|axios|http\.request|https\.request|node:https?'/)).toEqual([]);
  });
  // The single file read in the server is the client's index.html, read once at startup in
  // platform/static.ts. Everything else must not read files or load modules at all.
  const STATIC_MODULE = '/server/src/platform/static.ts';
  const FS_READ = /\breadFile(Sync)?\(|sendFile\(|createReadStream\(|import\(\s*(req|[a-z]+\.)|require\(\s*req/;
  it('reads no files and loads no modules from request-derived paths (SEC-11)', () => {
    expect(offenders(serverSources, FS_READ).filter((f) => f !== STATIC_MODULE)).toEqual([]);
  });
  it('limits file reads in static.ts to the fixed index.html read at startup (SEC-11)', () => {
    const source = readFileSync(join(root, 'server/src/platform/static.ts'), 'utf8');
    const reads = source.split('\n').filter((l) => /\b(readFileSync|readFile|sendFile|createReadStream)\(/.test(l)).map((l) => l.trim());
    expect(reads).toEqual(["const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');"]);
    expect(source).not.toMatch(/sendFile|createReadStream|\breq\.(params|query|body|url|originalUrl)\b/);
  });
  it('never evaluates strings as code', () => {
    expect(offenders(serverSources, /\beval\(|new Function\(/)).toEqual([]);
  });
  it('renders no raw HTML in the client (SEC-01)', () => {
    expect(offenders(clientSources, /dangerouslySetInnerHTML|\.innerHTML\s*=/)).toEqual([]);
  });
});
