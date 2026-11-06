import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// TEST-39 / AC-39 (NFR-04): text and button colours meet WCAG AA 4.5:1.
const css = readFileSync(resolve(import.meta.dirname, '../../client/src/styles.css'), 'utf8');
const token = (name: string): string => {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})`));
  if (!match?.[1]) throw new Error(`Token --${name} not found`);
  return match[1];
};

function luminance(hex: string): number {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const pairs: Array<[string, string, string]> = [
  ['body text on page', 'text', 'page'],
  ['body text on card surface', 'text', 'surface'],
  ['link and brand on card surface', 'accent', 'surface'],
  ['link on page (status badge area)', 'accent', 'page'],
  ['button text on accent button', 'surface', 'accent'],
  ['button text on disabled (pending) button', 'surface', 'pending'],
  ['error text on card surface', 'error', 'surface'],
  ['status badge text on badge background', 'text', 'page'],
];

describe('colour contrast (NFR-04)', () => {
  it.each(pairs)('%s is at least 4.5:1', (_label, fg, bg) => {
    expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('computes the WCAG reference values', () => {
    expect(ratio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(ratio('#777777', '#ffffff')).toBeLessThan(4.5);
  });
});
