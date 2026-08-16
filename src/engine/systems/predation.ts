import type { Rng } from '../rng';
import type { Point } from '../world';
import { makePredator, type Predator } from '../entities/predator';
import { refillEnergyFromKill } from './energy';
import type { Tuning } from '../types';

/** Contact radius for a kill — ported from the prototype's fox/rabbit
 * distance-squared check (d^2 < 0.45, i.e. ~0.67m), which isn't
 * re-specified for v2. */
const KILL_RADIUS = 0.67;

export function isWithinKillRange(predator: Point, rabbit: Point): boolean {
  const r2 = KILL_RADIUS * KILL_RADIUS;
  return (predator.x - rabbit.x) ** 2 + (predator.z - rabbit.z) ** 2 < r2;
}

export interface HuntResult {
  predator: Predator;
  killed: boolean;
}

/** A successful hunt reduces hunger by predatorGain, mirroring the
 * prototype's `fox.hunger = clamp(fox.hunger - foxGain, 0, 1)`, and
 * restores the energy pool by energyFromKill — the predator's counterpart
 * to a rabbit eating a plant. The energy half was missing originally,
 * which left hunting unrewarded in energy terms and killed every predator
 * of collapse on day 1 regardless of how well it hunted. */
export function huntRabbit(
  predator: Predator,
  rabbitPos: Point,
  tuning: Pick<Tuning, 'predatorGain' | 'energyFromKill' | 'energyMax'>,
): HuntResult {
  if (!isWithinKillRange(predator, rabbitPos)) {
    return { predator, killed: false };
  }
  return {
    predator: {
      ...predator,
      hunger: Math.max(0, Math.min(1, predator.hunger - tuning.predatorGain)),
      energy: refillEnergyFromKill(predator.energy, tuning),
    },
    killed: true,
  };
}

/** Well fed (hunger below the breed threshold), past maturity, and off
 * cooldown — mirrors the prototype fox's breed condition. No separate
 * predator maturity constant exists in DEFAULT_TUNING, so this reuses the
 * shared `maturityDays`. */
export function canPredatorBreed(
  predator: Pick<Predator, 'hunger' | 'ageDays' | 'cooldownDays'>,
  tuning: Pick<Tuning, 'predatorBreedThreshold' | 'maturityDays'>,
): boolean {
  return (
    predator.hunger < tuning.predatorBreedThreshold &&
    predator.ageDays > tuning.maturityDays &&
    predator.cooldownDays <= 0
  );
}

const PREDATOR_BREED_COOLDOWN_DAYS = 3;

export interface BreedPredatorResult {
  parent: Predator;
  child: Predator;
}

/** Predators reproduce asexually by budding, same as the prototype's foxes
 * (no mate negotiation). Breeding costs hunger — the prototype reuses
 * `foxBreed` as both the threshold and the cost, which this carries over
 * as `predatorBreedThreshold` doing the same double duty. */
export function breedPredator(parent: Predator, nextId: () => number, rng: Rng, tuning: Tuning): BreedPredatorResult {
  const child = makePredator({
    id: nextId(),
    x: parent.x + rng.range(-1, 1),
    z: parent.z + rng.range(-1, 1),
    rng,
    tuning,
  });
  return {
    parent: {
      ...parent,
      cooldownDays: PREDATOR_BREED_COOLDOWN_DAYS,
      hunger: Math.min(1, parent.hunger + tuning.predatorBreedThreshold),
    },
    child,
  };
}
