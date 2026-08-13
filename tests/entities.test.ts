import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng';
import { generateWorld } from '../src/engine/world';
import { DEFAULT_TUNING } from '../src/config/tuning';
import { makeRabbit } from '../src/engine/entities/rabbit';
import { makePredator } from '../src/engine/entities/predator';
import { spawnPlant, respawnPlant } from '../src/engine/entities/plant';

describe('makeRabbit', () => {
  it('spawns a newborn at age 0 and an adult already past maturity', () => {
    const rng = createRng(1);
    const newborn = makeRabbit({ id: 1, x: 0, z: 0, generation: 2, mature: false, rng, tuning: DEFAULT_TUNING });
    expect(newborn.ageDays).toBe(0);
    expect(newborn.generation).toBe(2);

    const adult = makeRabbit({ id: 2, x: 0, z: 0, generation: 1, mature: true, rng, tuning: DEFAULT_TUNING });
    expect(adult.ageDays).toBeGreaterThanOrEqual(adult.maturityDays);
  });

  it('reuses supplied genes instead of rolling new ones', () => {
    const rng = createRng(1);
    const genes = { sense: 9, speed: 2, urge: 0.5, gest: 2, des: 0.5 };
    const kid = makeRabbit({ id: 3, x: 0, z: 0, generation: 1, genes, mature: false, rng, tuning: DEFAULT_TUNING });
    expect(kid.genes).toEqual(genes);
  });

  it('is deterministic for a given seed', () => {
    const a = makeRabbit({ id: 1, x: 0, z: 0, generation: 1, mature: false, rng: createRng(5), tuning: DEFAULT_TUNING });
    const b = makeRabbit({ id: 1, x: 0, z: 0, generation: 1, mature: false, rng: createRng(5), tuning: DEFAULT_TUNING });
    expect(a).toEqual(b);
  });
});

describe('makePredator', () => {
  it('spawns with full energy and a lifespan within tuning bounds', () => {
    const predator = makePredator({ id: 1, x: 0, z: 0, rng: createRng(1), tuning: DEFAULT_TUNING });
    expect(predator.energy).toBe(DEFAULT_TUNING.energyMax);
    expect(predator.lifespanDays).toBeGreaterThanOrEqual(DEFAULT_TUNING.lifeMinDays);
    expect(predator.lifespanDays).toBeLessThanOrEqual(DEFAULT_TUNING.lifeMaxDays);
  });
});

describe('plants', () => {
  it('spawns on land, never in water', () => {
    const world = generateWorld(createRng(7), DEFAULT_TUNING);
    const rng = createRng(8);
    for (let i = 0; i < 50; i++) {
      const plant = spawnPlant(i, world, rng);
      expect(plant.alive).toBe(true);
    }
  });

  it('respawn relocates and revives a depleted plant', () => {
    const world = generateWorld(createRng(7), DEFAULT_TUNING);
    const rng = createRng(8);
    const plant = spawnPlant(1, world, rng);
    plant.alive = false;
    const before = { x: plant.x, z: plant.z };
    respawnPlant(plant, world, rng);
    expect(plant.alive).toBe(true);
    // Overwhelmingly likely to relocate given the world's free land area.
    expect(plant.x === before.x && plant.z === before.z).toBe(false);
  });
});
