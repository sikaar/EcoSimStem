import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '../src/config/tuning';
import { createSim, runUntilDay, step } from '../src/engine/sim';

describe('createSim', () => {
  it('spawns the expected founding populations', () => {
    const sim = createSim(1, DEFAULT_TUNING);
    expect(sim.plants).toHaveLength(DEFAULT_TUNING.plants);
    expect(sim.rabbits).toHaveLength(26);
    expect(sim.predators).toHaveLength(DEFAULT_TUNING.predatorStart);
    expect(sim.day).toEqual({ day: 1, phase: 'dawn', phaseElapsed: 0 });
  });

  it('spawns founders at their species den, not a random point (§4.2 "creatures emerge from dens")', () => {
    const sim = createSim(1, DEFAULT_TUNING);
    const rabbitDens = sim.world.dens.filter((d) => d.species === 'rabbit');
    for (const rabbit of sim.rabbits) {
      const nearestDist = Math.min(...rabbitDens.map((d) => Math.hypot(d.x - rabbit.x, d.z - rabbit.z)));
      expect(nearestDist).toBeLessThan(3);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = createSim(7, DEFAULT_TUNING);
    const b = createSim(7, DEFAULT_TUNING);
    expect(a.rabbits).toEqual(b.rabbits);
    expect(a.predators).toEqual(b.predators);
    expect(a.plants).toEqual(b.plants);
    expect(a.world).toEqual(b.world);
  });
});

describe('step', () => {
  it('advances the day-phase clock and eventually reaches day 2', () => {
    const sim = createSim(1, DEFAULT_TUNING);
    const totalPhaseSeconds =
      2 /* dawn */ + DEFAULT_TUNING.dayLengthSec + DEFAULT_TUNING.duskLengthSec + 1.5; /* night */
    const steps = Math.ceil((totalPhaseSeconds + 5) * 60); // + margin, at 60Hz
    for (let i = 0; i < steps && sim.day.day < 2; i++) {
      step(sim, 1 / 60);
      if (sim.day.phase === 'draft') sim.day = { ...sim.day, phase: 'night', phaseElapsed: 0 };
    }
    expect(sim.day.day).toBe(2);
  });

  it('produces a day report at resolve with a non-negative survivor count', () => {
    const sim = createSim(1, DEFAULT_TUNING);
    runUntilDay(sim, 2, 1 / 60);
    expect(sim.lastDayReport).not.toBeNull();
    expect(sim.lastDayReport!.day).toBe(1);
    expect(sim.lastDayReport!.survived).toBeGreaterThanOrEqual(0);
  });

  it('is deterministic across two independent runs of the same seed for several days', () => {
    const simA = createSim(3, DEFAULT_TUNING);
    const simB = createSim(3, DEFAULT_TUNING);
    runUntilDay(simA, 4, 1 / 60);
    runUntilDay(simB, 4, 1 / 60);
    expect(simA.rabbits).toEqual(simB.rabbits);
    expect(simA.predators).toEqual(simB.predators);
    expect(simA.deathTally).toEqual(simB.deathTally);
  });
});

describe('runUntilDay', () => {
  it('reaches the target day and auto-completes any draft phase along the way', () => {
    const tuning = { ...DEFAULT_TUNING, draftIntervalDays: 1 }; // draft every day
    const sim = createSim(1, tuning);
    runUntilDay(sim, 3, 1 / 60);
    expect(sim.day.day).toBeGreaterThanOrEqual(3);
  });
});
