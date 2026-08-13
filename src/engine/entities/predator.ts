import type { Rng } from '../rng';
import type { Tuning } from '../types';

/**
 * Predator stats (speed, sense, hunger gain, breed threshold) are tuning
 * globals applied to every individual, not per-creature genes — carried
 * over deliberately from the prototype (§16 defect #4). Per-individual
 * predator genes are a Phase 5 concern (predator ladder / evolution) and
 * would need the sliders to set a range instead of a fixed value.
 */
export interface Predator {
  id: number;
  species: 'predator';
  x: number;
  z: number;
  vx: number;
  vz: number;
  dir: number;
  ageDays: number;
  lifespanDays: number;
  hunger: number;
  energy: number;
  cooldownDays: number;
}

export interface MakePredatorParams {
  id: number;
  x: number;
  z: number;
  rng: Rng;
  tuning: Tuning;
}

export function makePredator(params: MakePredatorParams): Predator {
  const { id, x, z, rng, tuning } = params;
  return {
    id,
    species: 'predator',
    x,
    z,
    vx: 0,
    vz: 0,
    dir: rng.range(0, Math.PI * 2),
    ageDays: 0,
    lifespanDays: rng.range(tuning.lifeMinDays, tuning.lifeMaxDays),
    hunger: rng.range(0.1, 0.4),
    energy: tuning.energyMax,
    cooldownDays: 0,
  };
}
