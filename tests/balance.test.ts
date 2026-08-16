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

describe('balance invariant 5 — a predator can survive a day by hunting', () => {
  // Added after predators were found dying of energy collapse on day 1 of
  // every single run, well fed, having made 8 kills: a kill restored
  // hunger but not energy, so nothing could refill the pool. These two
  // assertions pin both halves of the intended design.
  const dayLength = DEFAULT_TUNING.dayLengthSec + DEFAULT_TUNING.duskLengthSec;
  const dayCost =
    energyDrainPerSecond(DEFAULT_TUNING, DEFAULT_TUNING.predatorSpeed, DEFAULT_TUNING.predatorSense, true) * dayLength;

  it('cannot coast through a whole day on the pool alone — hunting is mandatory', () => {
    expect(dayCost).toBeGreaterThan(DEFAULT_TUNING.energyMax);
  });

  it('but a modest two kills covers the day, so competent hunting is survivable', () => {
    expect(DEFAULT_TUNING.energyMax + 2 * DEFAULT_TUNING.energyFromKill).toBeGreaterThan(dayCost);
  });
});

describe('balance invariant 6 — the default world is self-sustaining', () => {
  // The regression that motivates this: with `return` wrongly in the drive
  // fallback list, rabbits parked on their dens and the population fell
  // from 26 to 1 by day 13 with zero predators and 50 plants untouched.
  // Nothing in the suite failed. This is the guard for that class of bug.
  it('rabbits are still alive at day 20 on every seed, predators aside', () => {
    const seeds = [12345, 999, 4242, 77, 31337];
    const tuning = { ...DEFAULT_TUNING, predatorStart: 0 };
    for (const seed of seeds) {
      const sim = createSim(seed, tuning);
      runUntilDay(sim, 21, 1 / 60);
      expect(sim.rabbits.length, `seed ${seed} went extinct`).toBeGreaterThan(0);
    }
  }, 300_000);
});

describe('balance invariant 4 — selection still bites (§5.5.4)', () => {
  it('surviving 20-day populations show measurably higher mean sense than the founders', () => {
    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    // Selection is a statistical claim about a stochastic process, so this
    // is phrased as one. Drift in a population of a few dozen, with
    // mutation on every birth, will carry an individual seed the "wrong"
    // way now and then — currently one seed in five — and demanding that
    // every single run rise would be asserting something the model does
    // not actually claim. What must hold is that the pressure is real and
    // pointed the right way: the average rises, and most runs rise.
    const seeds = [1, 2, 3, 42, 12345];
    const deltas: number[] = [];
    for (const seed of seeds) {
      const sim = createSim(seed, DEFAULT_TUNING);
      const startSense = mean(sim.rabbits.map((r) => r.genes.sense));
      runUntilDay(sim, 21, 1 / 60);
      expect(sim.rabbits.length, `seed ${seed} went extinct`).toBeGreaterThan(0);
      deltas.push(mean(sim.rabbits.map((r) => r.genes.sense)) - startSense);
    }
    const rose = deltas.filter((d) => d > 0).length;
    expect(mean(deltas), `mean sense drift ${mean(deltas).toFixed(2)} should be positive`).toBeGreaterThan(0);
    expect(rose, `sense rose in only ${rose}/${seeds.length} seeds`).toBeGreaterThan(seeds.length / 2);
  }, 120_000);
});
