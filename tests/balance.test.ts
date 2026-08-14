import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '../src/config/tuning';
import { HALF } from '../src/engine/world';
import { dawnEnergy, energyDrainPerSecond } from '../src/engine/systems/energy';

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
 * simulation result — it needs 20 days of births, deaths, and inheritance
 * actually running. It's marked `test.todo` until dayLoop.ts/lifecycle.ts
 * exist to run it, rather than faking coverage with a shallow proxy.
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

describe.todo('balance invariant 4 — selection still bites (§5.5.4)', () => {
  // Over 20 days at defaults, mean `sense` must rise measurably. Requires
  // a running day-cycle simulation with reproduction and inheritance
  // (dayLoop.ts + lifecycle.ts + reproduction.ts) — not yet built. Wire
  // this up as: run 20 seeded days at DEFAULT_TUNING, compare mean
  // population `sense` at day 0 vs day 20, assert a measurable rise.
});
