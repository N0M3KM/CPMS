export interface Clock {
  now(): Date;
}

export interface FixedClock extends Clock {
  advance(ms: number): void;
}

export const systemClock: Clock = { now: () => new Date() };

// Deterministic clock for deadline and status tests. Hands out copies of the instant.
export function fixedClock(start: Date): FixedClock {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advance: (ms: number) => {
      current += ms;
    },
  };
}
