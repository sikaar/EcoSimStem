export type DayPhase = 'dawn' | 'forage' | 'dusk' | 'resolve' | 'draft' | 'night';

export interface Tuning {
  // ---- day cycle ----
  dayLengthSec: number;
  duskLengthSec: number;
  draftIntervalDays: number;

  // ---- energy (per-day pool) ----
  energyMax: number;
  moveCostK: number;
  senseCostK: number;
  idleCost: number;
  energyFromPlant: number;
  energyCarryover: number;

  // ---- condition (multi-day) ----
  hungerPerDay: number;
  thirstPerDay: number;
  conditionPenalty: number;

  // ---- lifecycle (days) ----
  maturityDays: number;
  lifeMinDays: number;
  lifeMaxDays: number;
  gestMinDays: number;
  gestMaxDays: number;

  // ---- world ----
  plants: number;
  regrowDays: number;
  rabbitDens: number;
  predatorDens: number;
  denRadius: number;
  drinkRadius: number;
  eatRadius: number;

  // ---- inheritance ----
  mutChance: number;
  mutStep: number;
  senseMin: number;
  senseMax: number;
  speedMin: number;
  speedMax: number;
  urgeMin: number;
  urgeMax: number;

  // ---- predators ----
  predatorSpeed: number;
  predatorSense: number;
  predatorGain: number;
  predatorBreedThreshold: number;
  predatorStart: number;

  // ---- caps ----
  capRabbits: number;
  capPredators: number;
}

/** Trait space is 3D for now — the `size` gene is deferred (§0.1). */
export interface Genes {
  sense: number;
  speed: number;
  urge: number;
  gest: number;
  des: number;
}

export const GENE_RANGE: Record<keyof Genes, readonly [number, number]> = {
  sense: [3, 15],
  speed: [1.0, 4.2],
  urge: [0.12, 0.95],
  gest: [1, 4],
  des: [0, 1],
};
