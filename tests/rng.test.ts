import { describe, expect, it } from 'vitest';
import { createRng, seedFromString } from '../src/engine/rng';

describe('rng', () => {
  it('is deterministic for a given numeric seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces values in [0, 1)', () => {
    const rng = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('diverges for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('derives a stable numeric seed from a string', () => {
    expect(seedFromString('daily-2026-08-13')).toBe(seedFromString('daily-2026-08-13'));
    expect(seedFromString('a')).not.toBe(seedFromString('b'));
  });

  it('range/int/pick/chance stay within bounds', () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i++) {
      const r = rng.range(3, 15);
      expect(r).toBeGreaterThanOrEqual(3);
      expect(r).toBeLessThan(15);
      const n = rng.int(1, 4);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(4);
      const picked = rng.pick([1, 2, 3] as const);
      expect([1, 2, 3]).toContain(picked);
      expect(typeof rng.chance(0.5)).toBe('boolean');
    }
  });
});
