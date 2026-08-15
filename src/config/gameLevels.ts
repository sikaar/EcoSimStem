import type { TuningSection } from './tuningFields';

/**
 * Game Mode's five levels, ported from the V1 prototype's LEVELS array and
 * adapted to this project's actual data: V1 tracked "consecutive
 * generations" and wall-clock seconds; our day-phase model's primary
 * visible unit is the day, so thresholds are expressed in days instead
 * (still comparable in spirit — V1's "5 consecutive generations" becomes
 * "5 consecutive days," etc.). maxGeneration is still tracked and used
 * directly where V1 used it (the sense-gene objective).
 *
 * Deliberately simpler than V1's side-objective system: V1 tracked several
 * bespoke one-off flags (_noParamChanged, _metabolismChanged,
 * _speedRisePct, _noThirst3Gen) purpose-built for single objectives. This
 * version's side objectives only read data the app already tracks
 * elsewhere (runTally, geneHistory, day, maxGeneration, liveTuning), so no
 * new tracking had to be invented per objective — a real reduction in
 * scope from V1, not an oversight.
 */
export interface GameLevelObjectiveContext {
  day: number;
  rabbitCount: number;
  predatorCount: number;
  maxGeneration: number;
  meanSense: number;
  predatorEverReleased: boolean;
  /** Consecutive days the *current* level's own primary condition has held
   * true — computed by gameStore, meaning per level (reset to 0 whenever a
   * new level starts), not a global streak. */
  consecutiveDaysMet: number;
  totalExposureDeaths: number;
  totalDehydrationDeaths: number;
  totalCollapseDeaths: number;
  predatorSpeed: number;
  mutChance: number;
  founderMeanSpeed: number | undefined;
  currentMeanSpeed: number | undefined;
}

export interface GameLevelSide {
  label: string;
  check: (ctx: GameLevelObjectiveContext) => boolean;
}

export interface GameLevel {
  num: number;
  name: string;
  desc: string;
  epBonus: number;
  /** Sections whose knobs become adjustable (still costs EP, just no
   * longer locked entirely) once this level is reached. */
  unlocks: TuningSection[];
  primaryLabel: string;
  primaryCheck: (ctx: GameLevelObjectiveContext) => boolean;
  primaryProgress: (ctx: GameLevelObjectiveContext) => { val: number; max: number; label2?: string };
  sides: GameLevelSide[];
  /** For levels whose primary objective is a consecutive-day streak (L2,
   * L4, L5): evaluated once per day by gameStore.tickDay to decide whether
   * today extends or resets consecutiveDaysMet. Null for levels whose
   * primary is a one-time state check (L1, L3) with no streak to track. */
  dailyConditionMet: ((ctx: GameLevelObjectiveContext) => boolean) | null;
}

export const GAME_LEVELS: readonly GameLevel[] = [
  {
    num: 1,
    name: 'First Winter',
    desc: 'The world is raw. You can only touch the food and water supply.',
    epBonus: 60,
    unlocks: ['environment'],
    primaryLabel: 'Reach 30 rabbits',
    primaryCheck: (ctx) => ctx.rabbitCount >= 30,
    primaryProgress: (ctx) => ({ val: ctx.rabbitCount, max: 30 }),
    sides: [
      { label: 'Reach 30 rabbits by day 5', check: (ctx) => ctx.rabbitCount >= 30 && ctx.day <= 5 },
      { label: 'Reach generation 3', check: (ctx) => ctx.maxGeneration >= 3 },
    ],
    dailyConditionMet: null,
  },
  {
    num: 2,
    name: 'Pressure',
    desc: 'Tighten or loosen the metabolic screws. Find the band where selection bites.',
    epBonus: 80,
    unlocks: ['rabbitMetabolism'],
    primaryLabel: 'Maintain ≥ 25 rabbits for 5 consecutive days',
    primaryCheck: (ctx) => ctx.consecutiveDaysMet >= 5,
    primaryProgress: (ctx) => ({ val: Math.min(ctx.consecutiveDaysMet, 5), max: 5 }),
    sides: [
      { label: 'Do it with zero exposure deaths so far', check: (ctx) => ctx.consecutiveDaysMet >= 5 && ctx.totalExposureDeaths === 0 },
      { label: 'Reach generation 6', check: (ctx) => ctx.maxGeneration >= 6 },
    ],
    dailyConditionMet: (ctx) => ctx.rabbitCount >= 25,
  },
  {
    num: 3,
    name: 'The Gene Pool',
    desc: 'The starting gene distribution is yours. Design the organism.',
    epBonus: 100,
    unlocks: ['rabbitGenes'],
    primaryLabel: 'Reach day 12 with average sense > 9m',
    primaryCheck: (ctx) => ctx.day >= 12 && ctx.meanSense > 9,
    primaryProgress: (ctx) => ({ val: Math.min(ctx.day, 12), max: 12, label2: `sense ${ctx.meanSense.toFixed(1)}m` }),
    sides: [
      {
        label: 'Reach day 12 with mean speed lower than the founders’',
        check: (ctx) =>
          ctx.day >= 12 && ctx.founderMeanSpeed !== undefined && ctx.currentMeanSpeed !== undefined && ctx.currentMeanSpeed < ctx.founderMeanSpeed,
      },
      { label: 'Zero dehydration deaths so far', check: (ctx) => ctx.day >= 12 && ctx.totalDehydrationDeaths === 0 },
    ],
    dailyConditionMet: null,
  },
  {
    num: 4,
    name: 'Predator',
    desc: 'Release predators. They change what counts as fit — breed early, or never breed at all.',
    epBonus: 120,
    unlocks: ['predator'],
    primaryLabel: 'Both populations survive 6 consecutive days after release',
    primaryCheck: (ctx) => ctx.predatorEverReleased && ctx.consecutiveDaysMet >= 6,
    primaryProgress: (ctx) => ({ val: ctx.predatorEverReleased ? Math.min(ctx.consecutiveDaysMet, 6) : 0, max: 6 }),
    sides: [
      {
        label: 'Coexistence with predator speed > 3.5',
        check: (ctx) => ctx.predatorEverReleased && ctx.consecutiveDaysMet >= 6 && ctx.predatorSpeed > 3.5,
      },
      { label: 'Reach generation 9', check: (ctx) => ctx.maxGeneration >= 9 },
    ],
    dailyConditionMet: (ctx) => ctx.predatorEverReleased && ctx.rabbitCount > 0 && ctx.predatorCount > 0,
  },
  {
    num: 5,
    name: 'Equilibrium',
    desc: 'Everything is unlocked. Find the stable configuration — or learn why there isn’t one.',
    epBonus: 200,
    unlocks: ['shared', 'restart', 'performance'],
    primaryLabel: 'Maintain coexistence for 15 consecutive days',
    primaryCheck: (ctx) => ctx.predatorEverReleased && ctx.consecutiveDaysMet >= 15,
    primaryProgress: (ctx) => ({ val: ctx.predatorEverReleased ? Math.min(ctx.consecutiveDaysMet, 15) : 0, max: 15 }),
    sides: [
      {
        label: 'Achieve it with mutation chance ≥ 30%',
        check: (ctx) => ctx.predatorEverReleased && ctx.consecutiveDaysMet >= 15 && ctx.mutChance >= 0.3,
      },
      {
        label: 'Fewer than 10 total energy-collapse deaths',
        check: (ctx) => ctx.predatorEverReleased && ctx.consecutiveDaysMet >= 15 && ctx.totalCollapseDeaths < 10,
      },
    ],
    dailyConditionMet: (ctx) => ctx.predatorEverReleased && ctx.rabbitCount > 0 && ctx.predatorCount > 0,
  },
];

export function unlockedSections(level: number): Set<TuningSection> {
  const set = new Set<TuningSection>();
  for (const lvl of GAME_LEVELS) {
    if (lvl.num > level) break;
    for (const section of lvl.unlocks) set.add(section);
  }
  return set;
}

/** Which level number first unlocks a given section — for the "Unlocked at
 * Level N" message a locked TuningPanel group shows. Undefined for a
 * section no level ever unlocks (shouldn't happen; every TuningSection is
 * covered by some level's `unlocks`, checked by gameLevels.test.ts). */
export function unlockLevelFor(section: TuningSection): number | undefined {
  return GAME_LEVELS.find((lvl) => lvl.unlocks.includes(section))?.num;
}
