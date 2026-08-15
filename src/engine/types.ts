export type DayPhase = 'dawn' | 'forage' | 'dusk' | 'resolve' | 'draft' | 'night';

export interface Tuning {
  // ---- day cycle ----
  dayLengthSec: number;
  duskLengthSec: number;
  draftIntervalDays: number;
  /** Multiplier on RETURN urgency, covering the gap between the
   * straight-line distance home the urgency is computed from and the
   * longer real path around lakes and obstacles (§6.2). Below the typical
   * path-inefficiency factor, creatures turn for home too late and die of
   * exposure at resolve. */
  returnSafetyMargin: number;

  // ---- energy (per-day pool) ----
  energyMax: number;
  moveCostK: number;
  senseCostK: number;
  idleCost: number;
  energyFromPlant: number;
  /** Energy a predator recovers per kill — its counterpart to
   * energyFromPlant. Predators have no other refill path, so this is what
   * makes a hunting day survivable. */
  energyFromKill: number;
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
  /** Hunger a predator must reach before it will chase prey. Without a
   * gate a satiated predator keeps hunting anything it can see, which
   * crops the prey population far past what it needs and then starves it
   * into a crash — the classic overshoot. */
  predatorHuntThreshold: number;
  /** Fraction of predatorSpeed used when patrolling or heading home rather
   * than actively chasing prey. Sprinting is what the speed² term makes
   * expensive (§5.2), so a predator that runs flat out all day cannot
   * balance its energy budget no matter how well it hunts. */
  predatorPatrolFactor: number;
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
