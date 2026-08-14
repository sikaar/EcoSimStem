import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng';
import { DEFAULT_TUNING } from '../src/config/tuning';
import { makePredator } from '../src/engine/entities/predator';
import { breedPredator, canPredatorBreed, huntRabbit, isWithinKillRange } from '../src/engine/systems/predation';

function predator(overrides: Partial<ReturnType<typeof makePredator>> = {}) {
  return { ...makePredator({ id: 1, x: 0, z: 0, rng: createRng(1), tuning: DEFAULT_TUNING }), ...overrides };
}

describe('isWithinKillRange', () => {
  it('is true within the contact radius and false outside it', () => {
    expect(isWithinKillRange({ x: 0, z: 0 }, { x: 0.3, z: 0 })).toBe(true);
    expect(isWithinKillRange({ x: 0, z: 0 }, { x: 5, z: 0 })).toBe(false);
  });
});

describe('huntRabbit', () => {
  it('does nothing out of range', () => {
    const p = predator();
    const result = huntRabbit(p, { x: 10, z: 10 }, DEFAULT_TUNING);
    expect(result.killed).toBe(false);
    expect(result.predator).toBe(p);
  });

  it('reduces hunger by predatorGain on a kill, clamped to [0, 1]', () => {
    const p = predator({ hunger: 0.5 });
    const result = huntRabbit(p, { x: 0.1, z: 0 }, DEFAULT_TUNING);
    expect(result.killed).toBe(true);
    expect(result.predator.hunger).toBeCloseTo(Math.max(0, 0.5 - DEFAULT_TUNING.predatorGain));
  });

  it('never drives hunger negative even on a very well-fed kill', () => {
    const p = predator({ hunger: 0.1 });
    const result = huntRabbit(p, { x: 0, z: 0 }, DEFAULT_TUNING);
    expect(result.predator.hunger).toBe(0);
  });
});

describe('canPredatorBreed', () => {
  const tuning = DEFAULT_TUNING;
  it('requires well-fed, past maturity, and off cooldown', () => {
    const base = { hunger: 0.1, ageDays: tuning.maturityDays + 1, cooldownDays: 0 };
    expect(canPredatorBreed(base, tuning)).toBe(true);
    expect(canPredatorBreed({ ...base, hunger: 0.9 }, tuning)).toBe(false);
    expect(canPredatorBreed({ ...base, ageDays: 1 }, tuning)).toBe(false);
    expect(canPredatorBreed({ ...base, cooldownDays: 2 }, tuning)).toBe(false);
  });
});

describe('breedPredator', () => {
  it('spawns a child near the parent and puts the parent on cooldown', () => {
    const parent = predator({ x: 5, z: -3, hunger: 0.1 });
    const rng = createRng(2);
    let nextId = 100;
    const { parent: updatedParent, child } = breedPredator(parent, () => nextId++, rng, DEFAULT_TUNING);
    expect(updatedParent.cooldownDays).toBeGreaterThan(0);
    expect(updatedParent.hunger).toBeGreaterThan(parent.hunger);
    expect(Math.abs(child.x - parent.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(child.z - parent.z)).toBeLessThanOrEqual(1);
    expect(child.id).toBe(100);
  });
});
