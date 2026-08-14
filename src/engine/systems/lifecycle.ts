import { hasCollapsed } from './energy';
import { isDehydrated, isStarved } from './condition';
import { distanceToNearestOwnDen, type Den, type DenSpecies, type Point, type World } from '../world';

/**
 * Death causes and day resolution (§6.4). Exposure is the day cycle's
 * signature failure mode — a creature outside a den when `resolve` fires —
 * and must be tracked distinctly from the vital-stat causes so players see
 * it named in the day report (§8.2).
 */
export type DeathCause = 'exposure' | 'collapse' | 'starvation' | 'dehydration' | 'age' | 'predation';

export interface VitalStats {
  ageDays: number;
  lifespanDays: number;
  energy: number;
  hunger?: number;
  thirst?: number;
}

/** Checks the causes that can strike at any point during the day, not just
 * at `resolve` — collapse (zero energy) and the hunger/thirst caps can be
 * reached mid-forage; age is checked continuously too. Predators have no
 * hunger/thirst pool (§16 item 4 follow-on: they only starve via energy
 * collapse, not a separate hunger cap), so those fields are optional. */
export function checkVitalDeathCause(stats: VitalStats): DeathCause | null {
  if (hasCollapsed(stats.energy)) return 'collapse';
  if (stats.hunger !== undefined && isStarved(stats.hunger)) return 'starvation';
  if (stats.thirst !== undefined && isDehydrated(stats.thirst)) return 'dehydration';
  if (stats.ageDays >= stats.lifespanDays) return 'age';
  return null;
}

export type FieldResolution = { survived: true } | { survived: false; cause: 'exposure' };

/** At `resolve`: creatures inside a den survive, creatures still in the
 * field die of exposure (§6.4). This only decides the den-vs-field
 * outcome — a creature that already hit a vital death cause during forage
 * should have been removed then, not carried to this check. */
export function resolveFieldSurvival(
  pos: Point,
  species: DenSpecies,
  dens: readonly Den[],
  denRadius: number,
): FieldResolution {
  const home = distanceToNearestOwnDen(pos, dens, species) <= denRadius;
  return home ? { survived: true } : { survived: false, cause: 'exposure' };
}

/** Tracks the deepest generation reached so far — mirrors the prototype's
 * `stats.gen = Math.max(stats.gen, kid.gen)`, used to detect new-generation
 * events (§9.4 event log, "a mutation pushed sense to..."). */
export function trackGeneration(currentMaxGeneration: number, candidateGeneration: number): number {
  return Math.max(currentMaxGeneration, candidateGeneration);
}

export interface DayReport {
  day: number;
  born: number;
  survived: number;
  deaths: Record<DeathCause, number>;
  /** Mean genes among surviving rabbits at the moment of resolve — the
   * legible trend line the day report exists to surface (§8.2, §8.6:
   * "your rabbits got faster, there are fewer of them"). 0 if nobody
   * survived to report on. */
  meanSense: number;
  meanSpeed: number;
}

export function emptyDeathTally(): Record<DeathCause, number> {
  return { exposure: 0, collapse: 0, starvation: 0, dehydration: 0, age: 0, predation: 0 };
}
