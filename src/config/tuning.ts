import type { Tuning } from '../engine/types';

/**
 * Starting points derived from the day-cycle/energy/superlinear-cost redesign
 * (handover §5.4) — NOT playtested. `balance.test.ts` (§13) is the authority;
 * these values are free to move until the four invariants in §5.5 hold.
 */
export const DEFAULT_TUNING: Tuning = {
  // ---- day cycle ----
  dayLengthSec: 75,
  duskLengthSec: 15,
  draftIntervalDays: 2,

  // ---- energy (per-day pool) ----
  energyMax: 100,
  moveCostK: 0.33,
  senseCostK: 0.04,
  idleCost: 0.15,
  energyFromPlant: 45,
  energyCarryover: 0.25,

  // ---- condition (multi-day) ----
  hungerPerDay: 0.34,
  thirstPerDay: 0.4,
  conditionPenalty: 0.5,

  // ---- lifecycle (days) ----
  maturityDays: 4,
  lifeMinDays: 14,
  lifeMaxDays: 22,
  gestMinDays: 1,
  gestMaxDays: 4,

  // ---- world ----
  plants: 34,
  regrowDays: 1,
  rabbitDens: 6,
  predatorDens: 2,
  denRadius: 1.5,
  drinkRadius: 1.3,
  eatRadius: 0.6,

  // ---- inheritance ----
  mutChance: 0.13,
  mutStep: 0.09,
  senseMin: 5,
  senseMax: 10,
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
