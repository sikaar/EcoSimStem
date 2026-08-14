import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '../src/config/tuning';
import { HALF } from '../src/engine/world';
import { dawnEnergy, energyDrainPerSecond } from '../src/engine/systems/energy';
import { createSim, runUntilDay } from '../src/engine/sim';

/**
 * The four balance invariants from §5.5 — the real authority on tuning.
 * "Do not treat [DEFAULT_TUNING] as authoritative. Treat balance.test.ts
 * as the authority: it encodes the invariants that must hold, and the
 * constants are free to move until they satisfy it." (§0.2)
 *
 * Invariants 1-3 are checked analytically here, against the same
 * closed-form formulas §5.4's own derivation notes use to justify the
 * starting constants — no running simulation is needed for them, and
 * writing them now (rather than after the full day-cycle/lifecycle loop
 * lands) turns a tuning change into an immediate test failure instead of
 * a discovery made at the end of Phase 1.
 *
 * Invariant 4 ("selection still bites") is inherently a longitudinal
 * simulation result and now runs for real via engine/sim.ts (PR7).
 */

const median = (lo: number, hi: number): number => (lo + hi) / 2;
const WORLD_AREA = (2 * HALF) ** 2;

describe('balance invariant 1 — search-to-day ratio (§5.5.1)', () => {
  it('expected time to find food stays under 40% of the day for a median creature', () => {
    const sense = median(DEFAULT_TUNING.senseMin, DEFAULT_TUNING.senseMax);
    const speed = median(DEFAULT_TUNING.speedMin, DEFAULT_TUNING.speedMax);
    const sweep = 2 * (sense + DEFAULT_TUNING.eatRadius) * speed; // m^2/s
    const expectedSearchTime = WORLD_AREA / (sweep * DEFAULT_TUNING.plants);
    expect(expectedSearchTime).toBeLessThanOrEqual(0.4 * DEFAULT_TUNING.dayLengthSec);
  });
});

describe('balance invariant 2 — round-trip feasibility (§5.5.2)', () => {
  it('a median creature can reach food and return home within its dawn energy pool', () => {
    const sense = median(DEFAULT_TUNING.senseMin, DEFAULT_TUNING.senseMax);
    const speed = median(DEFAULT_TUNING.speedMin, DEFAULT_TUNING.speedMax);

    // Expected nearest-food distance via the standard Poisson-process
    // nearest-neighbour estimate: 0.5 * sqrt(area / pointCount).
    const expectedNearestFoodDist = 0.5 * Math.sqrt(WORLD_AREA / DEFAULT_TUNING.plants);
    const roundTripDist = 2 * expectedNearestFoodDist;
    const roundTripTime = roundTripDist / speed;
    const roundTripEnergyCost = roundTripTime * energyDrainPerSecond(DEFAULT_TUNING, speed, sense, true);

    const freshDawnEnergy = dawnEnergy(DEFAULT_TUNING, 0, 0, 0);
    expect(roundTripEnergyCost).toBeLessThanOrEqual(freshDawnEnergy);
  });
});

describe('balance invariant 3 — condition is multi-day (§5.5.3)', () => {
  it('a creature survives at least 2 consecutive bad days before hunger or thirst kills', () => {
    expect(1 / DEFAULT_TUNING.hungerPerDay).toBeGreaterThanOrEqual(2);
    expect(1 / DEFAULT_TUNING.thirstPerDay).toBeGreaterThanOrEqual(2);
  });
});

describe('balance invariant 4 — selection still bites (§5.5.4)', () => {
  it('surviving 20-day populations show measurably higher mean sense than the founders', () => {
    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    // Current tuning survives most, not all, seeded 20-day runs — an
    // honest floor, not a claim of universal stability (see the "known
    // open item" note in config/tuning.ts on predator balance in
    // particular). Every seed that *does* survive must show the rise;
    // tighten survivedCount's threshold toward seeds.length as future
    // tuning passes improve overall survivability.
    const seeds = [1, 2, 3, 42, 12345];
    let survived = 0;
    for (const seed of seeds) {
      const sim = createSim(seed, DEFAULT_TUNING);
      const startSense = mean(sim.rabbits.map((r) => r.genes.sense));
      runUntilDay(sim, 21, 1 / 60);
      if (sim.rabbits.length === 0) continue;
      survived++;
      const endSense = mean(sim.rabbits.map((r) => r.genes.sense));
      expect(endSense).toBeGreaterThan(startSense);
    }
    expect(survived).toBeGreaterThanOrEqual(Math.ceil(seeds.length / 2));
  }, 60_000);
});
