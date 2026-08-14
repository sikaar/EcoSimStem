import type { Point } from '../world';
import { costPerMetre } from './energy';
import type { Tuning } from '../types';

/**
 * Drive arbitration with fallback (§6.2, §0.3 item 1 — load-bearing). An
 * earlier build without the fallback caused mass starvation: rabbits
 * walked past visible food while hunting for invisible water. Ranking
 * alone isn't enough — if the top drive has no visible target, arbitration
 * must fall through to the next one instead of committing to nothing.
 */

export type DriveKind = 'water' | 'food' | 'mate' | 'return';

export interface Drive {
  kind: DriveKind;
  urgency: number;
}

export type ArbitrationResult =
  | { action: 'flee'; from: Point }
  | { action: 'commit'; kind: DriveKind; target: Point }
  | { action: 'wander' };

export interface ArbitrateParams {
  selfPos: Point;
  sense: number;
  thirst: number;
  hunger: number;
  canBreed: boolean;
  urge: number;
  returnUrgency: number;
  /** Nearest predator's position, if any is known to perception this step. */
  nearestPredator: Point | null;
  /** Looks up a visible target for one drive kind within sense range, or
   * null if nothing qualifies is currently visible. Supplied by the caller
   * so drives.ts stays decoupled from population/world lookups. */
  findTarget: (kind: DriveKind) => Point | null;
}

const FLEE_SENSE_MULTIPLIER = 1.15;
const RETURN_OVERRIDE_THRESHOLD = 1.0;
/** 15% safety margin baked into the urgency itself (§6.2). */
const RETURN_SAFETY_MARGIN = 1.15;

export function arbitrate(params: ArbitrateParams): ArbitrationResult {
  const { selfPos, sense, thirst, hunger, canBreed, urge, returnUrgency, nearestPredator, findTarget } = params;

  if (nearestPredator) {
    const d = Math.hypot(nearestPredator.x - selfPos.x, nearestPredator.z - selfPos.z);
    if (d <= sense * FLEE_SENSE_MULTIPLIER) return { action: 'flee', from: nearestPredator };
  }

  if (returnUrgency >= RETURN_OVERRIDE_THRESHOLD) {
    const target = findTarget('return');
    if (target) return { action: 'commit', kind: 'return', target };
  }

  const drives: Drive[] = [
    { kind: 'water', urgency: thirst },
    { kind: 'food', urgency: hunger },
    { kind: 'mate', urgency: canBreed ? urge : -1 },
    { kind: 'return', urgency: returnUrgency },
  ];
  drives.sort((a, b) => b.urgency - a.urgency);

  for (const drive of drives) {
    if (drive.urgency < 0) continue;
    const target = findTarget(drive.kind);
    if (target) return { action: 'commit', kind: drive.kind, target };
  }

  return { action: 'wander' };
}

export interface ReturnUrgencyParams {
  distHome: number;
  speed: number;
  energy: number;
  secondsUntilNightfall: number;
  tuning: Pick<Tuning, 'moveCostK'>;
}

/**
 * The most interesting decision a creature makes (§6.2). Note what falls
 * out of it for free: a fast creature burns energy quicker, so its
 * energyRatio climbs sooner and it must turn for home earlier — speed buys
 * arrival time and costs foraging time, with no special-casing required.
 */
export function computeReturnUrgency(params: ReturnUrgencyParams): number {
  const { distHome, speed, energy, secondsUntilNightfall, tuning } = params;
  const energyNeeded = distHome * costPerMetre(tuning, speed);
  const timeNeeded = distHome / speed;
  const energyRatio = energyNeeded / Math.max(energy, 0.001);
  const timeRatio = timeNeeded / Math.max(secondsUntilNightfall, 0.001);
  return Math.max(energyRatio, timeRatio) * RETURN_SAFETY_MARGIN;
}
