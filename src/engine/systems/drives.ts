import type { Point } from '../world';
import { costPerMetre } from './energy';
import type { Tuning } from '../types';

/**
 * Drive arbitration with fallback (§6.2, §0.3 item 1 — load-bearing). An
 * earlier build without the fallback caused mass starvation: rabbits
 * walked past visible food while hunting for invisible water. Ranking
 * alone isn't enough — if the top drive has no visible target, arbitration
 * must fall through to the next one instead of committing to nothing.
 *
 * RETURN is deliberately NOT one of the ranked drives. It is a hard
 * override only, checked once above the ranking. Including it in the
 * fallback list looks harmless — it sorts last at low urgency — but
 * `findTarget('return')` is the one lookup that *always* succeeds (the den
 * is known regardless of sense), so it would swallow every fall-through
 * and `wander` could never be reached. That bug parked any rabbit with no
 * visible water or food on top of its den until it starved, which is what
 * collapsed the population on default tuning.
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
/**
 * A need this small counts as already met, and chasing it pins the
 * creature on top of the resource that satisfies it. A rabbit standing at
 * the shore has its thirst reset to 0 every tick, then re-accrues a
 * fraction of a percent, then targets the water it is already standing
 * in — a stable loop that parks it at the bank for the whole day while
 * hunger quietly kills it. (Exactly zero is not a sufficient threshold:
 * thirst accrues continuously, so it is never exactly zero for more than
 * one tick.) At the default ~0.005/s thirst rate this frees the creature
 * ~10s after drinking, which is also roughly when seeking water again
 * starts to be worth the trip.
 */
const MIN_DRIVE_URGENCY = 0.05;

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
  ];
  drives.sort((a, b) => b.urgency - a.urgency);

  for (const drive of drives) {
    if (drive.urgency < MIN_DRIVE_URGENCY) continue;
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
  tuning: Pick<Tuning, 'moveCostK' | 'returnSafetyMargin'>;
}

/**
 * The most interesting decision a creature makes (§6.2). Note what falls
 * out of it for free: a fast creature burns energy quicker, so its
 * energyRatio climbs sooner and it must turn for home earlier — speed buys
 * arrival time and costs foraging time, with no special-casing required.
 *
 * Both ratios are computed against the straight-line distance home, which
 * is always optimistic: the real path detours around lakes and obstacles.
 * `returnSafetyMargin` is what covers that gap, so it has to exceed the
 * typical path-inefficiency factor, not just add a token buffer. At the
 * original 1.15 a rabbit 16m out turned for home with 1.2s of slack in a
 * 15s dusk, and any detour at all made it late — exposure was the single
 * largest cause of death.
 */
export function computeReturnUrgency(params: ReturnUrgencyParams): number {
  const { distHome, speed, energy, secondsUntilNightfall, tuning } = params;
  const energyNeeded = distHome * costPerMetre(tuning, speed);
  const timeNeeded = distHome / speed;
  const energyRatio = energyNeeded / Math.max(energy, 0.001);
  const timeRatio = timeNeeded / Math.max(secondsUntilNightfall, 0.001);
  return Math.max(energyRatio, timeRatio) * tuning.returnSafetyMargin;
}
