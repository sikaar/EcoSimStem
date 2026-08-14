import type { Tuning } from '../engine/types';

/**
 * Retuned from the §5.4 starting points against a real running simulation
 * (engine/sim.ts, PR7) — the §5.4 numbers verbatim produced near-total
 * extinction by day 1 (~29 of 30 starting creatures dead of energy
 * collapse). `balance.test.ts` is still the authority and these values
 * remain free to move; this is one documented pass, not a final answer.
 *
 * What changed from §5.4 and why, in the order each was found:
 * - energyMax 100 -> 280. The derivation note itself flags that a 100-pool
 *   lasts ~56s of a 75s+15s day under continuous movement — every moving
 *   creature was arithmetically certain to run dry before the day ended.
 * - senseMin/Max 5-10 -> 7-14. Founders often had no water in sense range
 *   at all (5 small lakes over a 56x56m map); wider sense made resource
 *   discovery survivable rather than luck-of-the-spawn.
 * - energyFromPlant 45 -> 90, plants 34 -> 50, regrowDays 1 -> 0.5. Once
 *   population growth via births kicked in, 34 plants regrowing once a
 *   day couldn't keep pace with a larger population's hunger.
 * - hungerPerDay 0.34 -> 0.28, thirstPerDay 0.4 -> 0.35. Both still clear
 *   invariant 3's >=2-day floor (now ~3.6 and ~2.9 days) with more buffer
 *   for a creature to actually reach a resource before the cap kills it.
 *
 * Two bugs, not tuning, were fixed alongside these (see the commit for
 * detail): hunger/thirst were incrementing once at dawn instead of
 * accruing continuously through the day, which left food/water urgency
 * flat all day; and the day-scaled mate-cooldown constants had carried
 * over their literal values from the prototype's *seconds*-scale model
 * (female cooldown = gest+5 *days* instead of gest+1) without rescaling.
 *
 * Known open item: predators still die out by day 2 in a full run even
 * though rabbits now sustain a full 20 days around them (see sim.test.ts).
 * Predator-specific balance (predatorSpeed/predatorSense/predatorGain)
 * needs its own pass — flagged here rather than silently left broken.
 */
export const DEFAULT_TUNING: Tuning = {
  // ---- day cycle ----
  dayLengthSec: 75,
  duskLengthSec: 15,
  draftIntervalDays: 2,

  // ---- energy (per-day pool) ----
  energyMax: 280,
  moveCostK: 0.33,
  senseCostK: 0.04,
  idleCost: 0.15,
  energyFromPlant: 90,
  energyCarryover: 0.25,

  // ---- condition (multi-day) ----
  hungerPerDay: 0.28,
  thirstPerDay: 0.35,
  conditionPenalty: 0.5,

  // ---- lifecycle (days) ----
  maturityDays: 4,
  lifeMinDays: 14,
  lifeMaxDays: 22,
  gestMinDays: 1,
  gestMaxDays: 4,

  // ---- world ----
  plants: 50,
  regrowDays: 0.5,
  rabbitDens: 6,
  predatorDens: 2,
  denRadius: 1.5,
  drinkRadius: 1.3,
  eatRadius: 0.6,

  // ---- inheritance ----
  mutChance: 0.13,
  mutStep: 0.09,
  senseMin: 7,
  senseMax: 14,
  speedMin: 1.4,
  speedMax: 2.6,
  urgeMin: 0.35,
  urgeMax: 0.8,

  // ---- predators ----
  predatorSpeed: 3.0,
  predatorSense: 11,
  predatorGain: 0.62,
  predatorBreedThreshold: 0.22,
  predatorStart: 4,

  // ---- caps ----
  capRabbits: 200,
  capPredators: 42,
};
