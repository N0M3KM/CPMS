import { describe, expect, it } from 'vitest';
import { fixedClock, systemClock } from '../src/platform/clock.js';

describe('clock', () => {
  it('systemClock returns the current time', () => {
    const before = Date.now();
    const now = systemClock.now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  it('fixedClock returns a fixed instant and can be advanced', () => {
    const clock = fixedClock(new Date('2026-11-08T12:00:00Z'));
    expect(clock.now().toISOString()).toBe('2026-11-08T12:00:00.000Z');
    clock.advance(1000);
    expect(clock.now().toISOString()).toBe('2026-11-08T12:00:01.000Z');
  });

  it('fixedClock hands out copies so callers cannot mutate it', () => {
    const clock = fixedClock(new Date('2026-11-08T12:00:00Z'));
    clock.now().setFullYear(1999);
    expect(clock.now().getUTCFullYear()).toBe(2026);
  });
});
