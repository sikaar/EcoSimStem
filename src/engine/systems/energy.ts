import type { Tuning } from '../types';

/**
 * Per-day energy pool — the foraging budget (§6.5). Separate from hunger and
 * thirst, not a replacement for them: condition throttles tomorrow's energy
 * rather than draining today's directly.
 *
 *   dawnEnergy = energyMax * (1 - conditionPenalty * max(hunger, thirst)) + carriedSurplus
 *   drain/sec  = moveCostK * speed^2  (when moving)
 *              + senseCostK * sense   (always)
 *              + idleCost             (always)
 *   refill     = energyFromPlant on eating
 *   zero       -> collapse -> death
 */

export function dawnEnergy(
  tuning: Pick<Tuning, 'energyMax' | 'conditionPenalty'>,
  hunger: number,
  thirst: number,
  carriedSurplus: number,
): number {
  return tuning.energyMax * (1 - tuning.conditionPenalty * Math.max(hunger, thirst)) + carriedSurplus;
}

export function energyDrainPerSecond(
  tuning: Pick<Tuning, 'moveCostK' | 'senseCostK' | 'idleCost'>,
  speed: number,
  sense: number,
  moving: boolean,
): number {
  const moveCost = moving ? tuning.moveCostK * speed * speed : 0;
  return moveCost + tuning.senseCostK * sense + tuning.idleCost;
}

/** Movement-only energy cost per metre travelled, derived from the
 * speed^2 drain-per-second term (moveCostK*speed^2 / speed = moveCostK*speed).
 * Used by the RETURN drive's urgency calculation (§6.2) — a fast creature's
 * per-metre cost is higher, so its energyRatio climbs sooner and it must
 * turn for home earlier. That fall-out is the point of the superlinear cost. */
export function costPerMetre(tuning: Pick<Tuning, 'moveCostK'>, speed: number): number {
  return tuning.moveCostK * speed;
}

export function applyEnergyDrain(energy: number, drainPerSecond: number, dt: number): number {
  return Math.max(0, energy - drainPerSecond * dt);
}

export function refillEnergy(energy: number, tuning: Pick<Tuning, 'energyFromPlant' | 'energyMax'>): number {
  return Math.min(tuning.energyMax, energy + tuning.energyFromPlant);
}

/** Fraction of a surplus (unspent energy at day's end) carried into
 * tomorrow's dawn pool (§6.4). */
export function carriedSurplus(tuning: Pick<Tuning, 'energyCarryover'>, endOfDayEnergy: number): number {
  return tuning.energyCarryover * Math.max(endOfDayEnergy, 0);
}

export function hasCollapsed(energy: number): boolean {
  return energy <= 0;
}
