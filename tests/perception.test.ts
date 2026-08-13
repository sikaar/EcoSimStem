import { describe, expect, it } from 'vitest';
import { SpatialHash } from '../src/engine/systems/perception';

describe('SpatialHash', () => {
  it('finds entries within radius and excludes ones outside it', () => {
    const hash = new SpatialHash(15);
    hash.rebuild([
      { id: 1, x: 0, z: 0 },
      { id: 2, x: 5, z: 0 },
      { id: 3, x: 40, z: 40 }, // several cells away
    ]);
    const found = hash.queryRadius(0, 0, 10).map((e) => e.id);
    expect(found.sort()).toEqual([1, 2]);
  });

  it('3x3 neighbourhood query is a superset of the exact radius query', () => {
    const hash = new SpatialHash(15);
    const entries = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      x: ((i * 37) % 90) - 45,
      z: ((i * 53) % 90) - 45,
    }));
    hash.rebuild(entries);
    const exact = new Set(hash.queryRadius(2, 2, 12).map((e) => e.id));
    const neighborhood = new Set(hash.queryNeighborhood(2, 2).map((e) => e.id));
    for (const id of exact) expect(neighborhood.has(id)).toBe(true);
  });

  it('rebuild clears stale entries from a previous step', () => {
    const hash = new SpatialHash(15);
    hash.rebuild([{ id: 1, x: 0, z: 0 }]);
    hash.rebuild([{ id: 2, x: 0, z: 0 }]);
    const ids = hash.queryNeighborhood(0, 0).map((e) => e.id);
    expect(ids).toEqual([2]);
  });

  it('handles an empty hash without error', () => {
    const hash = new SpatialHash(15);
    expect(hash.queryRadius(0, 0, 5)).toEqual([]);
  });
});
