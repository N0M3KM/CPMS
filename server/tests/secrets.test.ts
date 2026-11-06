import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const SKIP = /node_modules|\/dist\/|\/\.git\/|package-lock\.json|\/coverage\//;
const envPath = join(root, '.env');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (SKIP.test(full + '/')) return [];
    if (statSync(full).isDirectory()) return walk(full);
    return /^\.env($|\.)/.test(name) && name !== '.env.example' ? [] : [full];
  });
}

const sources = walk(root).filter((f) => !/\.(png|jpg|ico|woff2?)$/.test(f));

describe('secrets exposure (SEC-20)', () => {
  it('contains no private keys or cloud access keys', () => {
    const pattern = /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}/;
    expect(sources.filter((f) => pattern.test(readFileSync(f, 'utf8'))).map((f) => f.replace(root, ''))).toEqual([]);
  });

  it.skipIf(!existsSync(envPath))('does not contain any secret value from the local .env', () => {
    const secretKeys = /PASSWORD|SECRET|DATABASE_URL/;
    const values = readFileSync(envPath, 'utf8')
      .split('\n')
      .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
      .filter((m): m is RegExpMatchArray => !!m && secretKeys.test(m[1] ?? ''))
      .map((m) => m[2] ?? '')
      .filter((v) => v.length >= 8);
    const leaked = sources.filter((f) => {
      const text = readFileSync(f, 'utf8');
      return values.some((v) => text.includes(v));
    });
    expect(leaked.map((f) => f.replace(root, ''))).toEqual([]);
  });

  it('keeps .env ignored and only a placeholder example committed', () => {
    const ignore = readFileSync(join(root, '.gitignore'), 'utf8');
    expect(ignore).toMatch(/^\.env$/m);
    expect(readFileSync(join(root, '.env.example'), 'utf8')).toMatch(/change-me/);
  });
});
