/**
 * Seeded PRNG (mulberry32). One instance is owned and threaded explicitly by
 * the engine (§7) — never a module-level singleton reachable from render or UI.
 */
export type Rng = {
  next(): number;
  range(a: number, b: number): number;
  int(a: number, b: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
};

export function seedFromString(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;

  function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
    pick: (items) => {
      const i = Math.floor(next() * items.length);
      const item = items[i];
      if (item === undefined) throw new Error('pick from empty array');
      return item;
    },
    chance: (p) => next() < p,
  };
}
