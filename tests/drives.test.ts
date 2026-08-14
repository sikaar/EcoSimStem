import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '../src/config/tuning';
import { arbitrate, computeReturnUrgency } from '../src/engine/systems/drives';

const selfPos = { x: 0, z: 0 };

describe('arbitrate — fallback (§0.3 item 1, §6.2)', () => {
  it('falls through to the next drive when the top-urgency drive has no visible target', () => {
    // Thirst is highest but water is nowhere in sense range; food is visible.
    const result = arbitrate({
      selfPos,
      sense: 8,
      thirst: 0.9,
      hunger: 0.4,
      canBreed: false,
      urge: 0,
      returnUrgency: 0,
      nearestPredator: null,
      findTarget: (kind) => (kind === 'food' ? { x: 1, z: 1 } : null),
    });
    expect(result).toEqual({ action: 'commit', kind: 'food', target: { x: 1, z: 1 } });
  });

  it('wanders when nothing is visible for any drive', () => {
    const result = arbitrate({
      selfPos,
      sense: 8,
      thirst: 0.5,
      hunger: 0.5,
      canBreed: true,
      urge: 0.5,
      returnUrgency: 0,
      nearestPredator: null,
      findTarget: () => null,
    });
    expect(result).toEqual({ action: 'wander' });
  });

  it('ranks by urgency: higher hunger beats lower thirst when both are visible', () => {
    const result = arbitrate({
      selfPos,
      sense: 8,
      thirst: 0.2,
      hunger: 0.9,
      canBreed: false,
      urge: 0,
      returnUrgency: 0,
      nearestPredator: null,
      findTarget: () => ({ x: 5, z: 5 }),
    });
    expect(result).toEqual({ action: 'commit', kind: 'food', target: { x: 5, z: 5 } });
  });

  it('excludes mate when not able to breed, even with high urge', () => {
    const result = arbitrate({
      selfPos,
      sense: 8,
      thirst: 0,
      hunger: 0,
      canBreed: false,
      urge: 0.95,
      returnUrgency: 0,
      nearestPredator: null,
      findTarget: (kind) => (kind === 'mate' ? { x: 1, z: 1 } : null),
    });
    expect(result).toEqual({ action: 'wander' });
  });
});

describe('arbitrate — FLEE hard override', () => {
  it('flees a predator within sense x 1.15, overriding every other drive', () => {
    const result = arbitrate({
      selfPos,
      sense: 8,
      thirst: 1,
      hunger: 1,
      canBreed: true,
      urge: 1,
      returnUrgency: 2,
      nearestPredator: { x: 9, z: 0 }, // within 8 * 1.15 = 9.2
      findTarget: () => ({ x: 1, z: 1 }),
    });
    expect(result).toEqual({ action: 'flee', from: { x: 9, z: 0 } });
  });

  it('does not flee a predator just outside sense x 1.15', () => {
    const result = arbitrate({
      selfPos,
      sense: 8,
      thirst: 0,
      hunger: 0,
      canBreed: false,
      urge: 0,
      returnUrgency: 0,
      nearestPredator: { x: 9.3, z: 0 }, // outside 8 * 1.15 = 9.2
      findTarget: () => null,
    });
    expect(result.action).not.toBe('flee');
  });
});

describe('arbitrate — RETURN hard override', () => {
  it('commits to return when returnUrgency >= 1 and a den is visible', () => {
    const result = arbitrate({
      selfPos,
      sense: 8,
      thirst: 0.9,
      hunger: 0.9,
      canBreed: false,
      urge: 0,
      returnUrgency: 1.2,
      nearestPredator: null,
      findTarget: (kind) => (kind === 'return' ? { x: 0, z: -5 } : { x: 1, z: 1 }),
    });
    expect(result).toEqual({ action: 'commit', kind: 'return', target: { x: 0, z: -5 } });
  });

  it('falls back to the ranked list if the return target somehow resolves to nothing', () => {
    const result = arbitrate({
      selfPos,
      sense: 8,
      thirst: 0.9,
      hunger: 0.2,
      canBreed: false,
      urge: 0,
      returnUrgency: 1.2,
      nearestPredator: null,
      findTarget: (kind) => (kind === 'water' ? { x: 2, z: 2 } : null),
    });
    expect(result).toEqual({ action: 'commit', kind: 'water', target: { x: 2, z: 2 } });
  });
});

describe('computeReturnUrgency (§6.2)', () => {
  const base = { distHome: 10, speed: 2, energy: 50, secondsUntilNightfall: 20, tuning: DEFAULT_TUNING };

  it('matches the formula exactly for a known case', () => {
    const energyNeeded = 10 * (DEFAULT_TUNING.moveCostK * 2);
    const timeNeeded = 10 / 2;
    const expected = Math.max(energyNeeded / 50, timeNeeded / 20) * 1.15;
    expect(computeReturnUrgency(base)).toBeCloseTo(expected, 10);
  });

  it('rises with distance', () => {
    const near = computeReturnUrgency({ ...base, distHome: 5 });
    const far = computeReturnUrgency({ ...base, distHome: 20 });
    expect(far).toBeGreaterThan(near);
  });

  it('falls as energy rises', () => {
    const lowEnergy = computeReturnUrgency({ ...base, energy: 10 });
    const highEnergy = computeReturnUrgency({ ...base, energy: 90 });
    expect(highEnergy).toBeLessThan(lowEnergy);
  });

  it('a faster creature needs more energy to get home at the same distance — the energy side of the trade-off', () => {
    // Isolate the energy component by making nightfall a non-issue
    // (timeRatio ~ 0), so returnUrgency tracks energyRatio directly.
    const params = { ...base, secondsUntilNightfall: 1e6 };
    const slow = computeReturnUrgency({ ...params, speed: 1.4 });
    const fast = computeReturnUrgency({ ...params, speed: 3.5 });
    expect(fast).toBeGreaterThan(slow);
  });
});
