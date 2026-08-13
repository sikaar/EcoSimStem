import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng';
import { DEFAULT_TUNING } from '../src/config/tuning';
import {
  distanceToNearestOwnDen,
  generateWorld,
  isHome,
  isInWater,
  landPoint,
  nearestWaterPoint,
} from '../src/engine/world';

describe('world generation', () => {
  it('is deterministic for a given seed', () => {
    const a = generateWorld(createRng(42), DEFAULT_TUNING);
    const b = generateWorld(createRng(42), DEFAULT_TUNING);
    expect(a.obstacles).toEqual(b.obstacles);
    expect(a.dens).toEqual(b.dens);
  });

  it('places every lake centre in water and the map corner on land', () => {
    const world = generateWorld(createRng(1), DEFAULT_TUNING);
    for (const lake of world.lakes) {
      expect(isInWater(world, lake.x, lake.z)).toBe(true);
    }
    expect(isInWater(world, world.half - 0.1, world.half - 0.1)).toBe(false);
  });

  it('never returns a land point inside water', () => {
    const rng = createRng(3);
    const world = generateWorld(createRng(3), DEFAULT_TUNING);
    for (let i = 0; i < 200; i++) {
      const p = landPoint(world, rng, 1.6);
      expect(isInWater(world, p.x, p.z)).toBe(false);
    }
  });

  it('projects the nearest drinkable point just outside some lake boundary', () => {
    const world = generateWorld(createRng(5), DEFAULT_TUNING);
    const lake = world.lakes[0]!;
    // Approach from well outside the lake so the projection has a clear target.
    const approachX = lake.x + lake.rx + 10;
    const p = nearestWaterPoint(world, approachX, lake.z, 30);
    expect(p).not.toBeNull();
    expect(isInWater(world, p!.x, p!.z)).toBe(false);
    // The result should hug the boundary of whichever lake is actually
    // closest to the approach point, not necessarily lake[0].
    const distToNearestLakeCentre = Math.min(
      ...world.lakes.map((l) => Math.hypot(p!.x - l.x, p!.z - l.z)),
    );
    expect(distToNearestLakeCentre).toBeLessThan(Math.max(lake.rx, lake.rz) + 1);
  });

  it('returns null when no lake is within range', () => {
    const world = generateWorld(createRng(5), DEFAULT_TUNING);
    expect(nearestWaterPoint(world, 0, 0, 0.001)).toBeNull();
  });

  it('places the configured number of dens per species', () => {
    const world = generateWorld(createRng(9), DEFAULT_TUNING);
    const rabbitDens = world.dens.filter((d) => d.species === 'rabbit');
    const predatorDens = world.dens.filter((d) => d.species === 'predator');
    expect(rabbitDens).toHaveLength(DEFAULT_TUNING.rabbitDens);
    expect(predatorDens).toHaveLength(DEFAULT_TUNING.predatorDens);
  });

  it('keeps rabbit dens at least 8m apart and clear of water', () => {
    const world = generateWorld(createRng(11), DEFAULT_TUNING);
    const rabbitDens = world.dens.filter((d) => d.species === 'rabbit');
    for (const den of rabbitDens) {
      expect(isInWater(world, den.x, den.z, 3)).toBe(false);
    }
    for (let i = 0; i < rabbitDens.length; i++) {
      for (let j = i + 1; j < rabbitDens.length; j++) {
        const d = Math.hypot(rabbitDens[i]!.x - rabbitDens[j]!.x, rabbitDens[i]!.z - rabbitDens[j]!.z);
        expect(d).toBeGreaterThanOrEqual(8 - 1e-6);
      }
    }
  });

  it('computes distance to nearest own den and home status per species', () => {
    const world = generateWorld(createRng(13), DEFAULT_TUNING);
    const rabbitDen = world.dens.find((d) => d.species === 'rabbit')!;
    expect(distanceToNearestOwnDen(rabbitDen, world.dens, 'rabbit')).toBeCloseTo(0);
    expect(isHome(rabbitDen, world.dens, 'rabbit', DEFAULT_TUNING.denRadius)).toBe(true);
    // A rabbit den is not a predator's home even at distance 0.
    expect(isHome(rabbitDen, world.dens, 'predator', DEFAULT_TUNING.denRadius)).toBe(false);
  });
});
