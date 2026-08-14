import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng';
import { DEFAULT_TUNING } from '../src/config/tuning';
import { generateWorld } from '../src/engine/world';
import { checkVitalDeathCause, emptyDeathTally, resolveFieldSurvival, trackGeneration } from '../src/engine/systems/lifecycle';

describe('checkVitalDeathCause', () => {
  const alive = { ageDays: 5, lifespanDays: 20, energy: 50, hunger: 0.2, thirst: 0.2 };

  it('returns null when nothing is fatal', () => {
    expect(checkVitalDeathCause(alive)).toBeNull();
  });

  it('detects collapse at zero energy, checked before other causes', () => {
    expect(checkVitalDeathCause({ ...alive, energy: 0 })).toBe('collapse');
  });

  it('detects starvation at hunger >= 1', () => {
    expect(checkVitalDeathCause({ ...alive, hunger: 1 })).toBe('starvation');
  });

  it('detects dehydration at thirst >= 1', () => {
    expect(checkVitalDeathCause({ ...alive, thirst: 1 })).toBe('dehydration');
  });

  it('detects age-out once ageDays reaches lifespanDays', () => {
    expect(checkVitalDeathCause({ ...alive, ageDays: 20 })).toBe('age');
  });

  it('skips hunger/thirst checks for predators, which have no condition pool', () => {
    expect(checkVitalDeathCause({ ageDays: 5, lifespanDays: 20, energy: 50 })).toBeNull();
  });
});

describe('resolveFieldSurvival — den vs. exposure at day resolve (§6.4)', () => {
  it('survives when within denRadius of an own-species den', () => {
    const world = generateWorld(createRng(1), DEFAULT_TUNING);
    const den = world.dens.find((d) => d.species === 'rabbit')!;
    const result = resolveFieldSurvival(den, 'rabbit', world.dens, DEFAULT_TUNING.denRadius);
    expect(result).toEqual({ survived: true });
  });

  it('dies of exposure when out in the field at resolve', () => {
    const world = generateWorld(createRng(1), DEFAULT_TUNING);
    const farPoint = { x: 1000, z: 1000 }; // nowhere near any den
    const result = resolveFieldSurvival(farPoint, 'rabbit', world.dens, DEFAULT_TUNING.denRadius);
    expect(result).toEqual({ survived: false, cause: 'exposure' });
  });

  it('a predator standing at a rabbit den is still exposed — dens are species-specific', () => {
    const world = generateWorld(createRng(1), DEFAULT_TUNING);
    const rabbitDen = world.dens.find((d) => d.species === 'rabbit')!;
    const result = resolveFieldSurvival(rabbitDen, 'predator', world.dens, DEFAULT_TUNING.denRadius);
    expect(result.survived).toBe(false);
  });
});

describe('trackGeneration', () => {
  it('keeps the highest generation seen so far', () => {
    expect(trackGeneration(3, 5)).toBe(5);
    expect(trackGeneration(5, 2)).toBe(5);
    expect(trackGeneration(0, 0)).toBe(0);
  });
});

describe('emptyDeathTally', () => {
  it('has a zeroed slot for every death cause', () => {
    const tally = emptyDeathTally();
    expect(tally).toEqual({ exposure: 0, collapse: 0, starvation: 0, dehydration: 0, age: 0, predation: 0 });
  });
});
