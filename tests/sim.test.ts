import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '../src/config/tuning';
import { createSim, runUntilDay, spawnPredators, spawnRabbits, step } from '../src/engine/sim';

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

  it('reports mean genes matching the surviving rabbit population (§8.2, §9.2)', () => {
    const sim = createSim(1, DEFAULT_TUNING);
    runUntilDay(sim, 2, 1 / 60);
    const report = sim.lastDayReport!;
    const geneKeys = ['sense', 'speed', 'urge', 'gest', 'des'] as const;
    const reportKeys = ['meanSense', 'meanSpeed', 'meanUrge', 'meanGest', 'meanDes'] as const;
    if (sim.rabbits.length === 0) {
      for (const key of reportKeys) expect(report[key]).toBe(0);
    } else {
      for (let i = 0; i < geneKeys.length; i++) {
        const geneKey = geneKeys[i]!;
        const reportKey = reportKeys[i]!;
        const expected = sim.rabbits.reduce((s, r) => s + r.genes[geneKey], 0) / sim.rabbits.length;
        expect(report[reportKey]).toBeCloseTo(expected);
      }
    }
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

describe('no creature gets permanently stuck (§6.3)', () => {
  it('no rabbit stays put for a whole forage phase', () => {
    // Two separate defects produced permanently frozen creatures, and
    // neither was visible to any unit test: `return` sitting in the drive
    // fallback list made rabbits commit to a den they were already
    // standing on, and wanderTarget only swept the half-circle ahead, so
    // a creature facing a shoreline got its own position back as a target
    // forever. Both showed up in play as rabbits stuck near their burrow.
    const sim = createSim(12345, DEFAULT_TUNING);
    const dt = 1 / 60;
    const prev = new Map<number, { x: number; z: number }>();
    const streak = new Map<number, number>();
    let worstStreak = 0;

    // ~10 days, sampling twice a second during the active phases.
    for (let i = 0; i < 60 * 60 * 20 && sim.day.day <= 10; i++) {
      step(sim, dt);
      if (sim.day.phase === 'draft') sim.day = { ...sim.day, phase: 'night', phaseElapsed: 0 };
      if (sim.day.phase !== 'forage' || i % 30 !== 0) continue;
      for (const r of sim.rabbits) {
        const p = prev.get(r.id);
        const next = p && Math.hypot(r.x - p.x, r.z - p.z) < 0.02 ? (streak.get(r.id) ?? 0) + 1 : 0;
        streak.set(r.id, next);
        worstStreak = Math.max(worstStreak, next);
        prev.set(r.id, { x: r.x, z: r.z });
      }
    }

    // 40 samples = ~20s of never moving. Denning creatures legitimately
    // hold still, but not during forage, and not for that long.
    expect(worstStreak).toBeLessThan(40);
  }, 120_000);
});

describe('spawnRabbits / spawnPredators', () => {
  it('injects mature rabbits into an already-running sim, at rabbit dens', () => {
    const sim = createSim(1, DEFAULT_TUNING);
    const before = sim.rabbits.length;
    const spawned = spawnRabbits(sim, 5);
    expect(spawned).toBe(5);
    expect(sim.rabbits).toHaveLength(before + 5);
    const rabbitDens = sim.world.dens.filter((d) => d.species === 'rabbit');
    for (const rabbit of sim.rabbits.slice(-5)) {
      const nearestDist = Math.min(...rabbitDens.map((d) => Math.hypot(d.x - rabbit.x, d.z - rabbit.z)));
      expect(nearestDist).toBeLessThan(3);
    }
  });

  it('injects predators into an already-running sim, at predator dens — the "release" path for a run that started with none', () => {
    const tuning = { ...DEFAULT_TUNING, predatorStart: 0 };
    const sim = createSim(1, tuning);
    expect(sim.predators).toHaveLength(0);
    const spawned = spawnPredators(sim, 4);
    expect(spawned).toBe(4);
    expect(sim.predators).toHaveLength(4);
    const predatorDens = sim.world.dens.filter((d) => d.species === 'predator');
    for (const predator of sim.predators) {
      const nearestDist = Math.min(...predatorDens.map((d) => Math.hypot(d.x - predator.x, d.z - predator.z)));
      expect(nearestDist).toBeLessThan(3);
    }
  });

  it('never spawns past the population cap', () => {
    const tuning = { ...DEFAULT_TUNING, capRabbits: 30, capPredators: 2 };
    const sim = createSim(1, tuning); // 26 rabbits, 4 predators at creation (predatorStart isn't cap-checked)
    const rabbitsSpawned = spawnRabbits(sim, 20);
    expect(sim.rabbits.length).toBeLessThanOrEqual(30);
    expect(rabbitsSpawned).toBe(sim.rabbits.length - 26);

    const predatorsBefore = sim.predators.length; // already >= capPredators from creation-time predatorStart
    const predatorsSpawned = spawnPredators(sim, 20);
    expect(predatorsSpawned).toBe(0);
    expect(sim.predators.length).toBe(predatorsBefore);
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
