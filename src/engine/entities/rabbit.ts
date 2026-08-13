import type { Rng } from '../rng';
import { newGenes } from '../genetics';
import type { Genes, Tuning } from '../types';

export interface Rabbit {
  id: number;
  species: 'rabbit';
  x: number;
  z: number;
  vx: number;
  vz: number;
  dir: number;
  male: boolean;
  genes: Genes;
  generation: number;
  ageDays: number;
  /** Overridden for offspring via genetics.maturityDaysFromGestation — the
   * gest→maturity trade-off coupling (§5.3, §0.3 item 3). */
  maturityDays: number;
  lifespanDays: number;
  hunger: number;
  thirst: number;
  energy: number;
  pregnantDaysLeft: number;
  carryGenes: Genes | null;
  cooldownDays: number;
}

export interface MakeRabbitParams {
  id: number;
  x: number;
  z: number;
  generation: number;
  genes?: Genes;
  /** If true, spawn as an already-mature adult (founding population); if
   * false, spawn as a newborn (age 0). */
  mature: boolean;
  rng: Rng;
  tuning: Tuning;
}

export function makeRabbit(params: MakeRabbitParams): Rabbit {
  const { id, x, z, generation, mature, rng, tuning } = params;
  const genes = params.genes ?? newGenes(rng, tuning);
  const maturityDays = tuning.maturityDays;
  return {
    id,
    species: 'rabbit',
    x,
    z,
    vx: 0,
    vz: 0,
    dir: rng.range(0, Math.PI * 2),
    male: rng.chance(0.5),
    genes,
    generation,
    ageDays: mature ? rng.range(maturityDays, maturityDays * 2) : 0,
    maturityDays,
    lifespanDays: rng.range(tuning.lifeMinDays, tuning.lifeMaxDays),
    hunger: rng.range(0, 0.25),
    thirst: rng.range(0, 0.25),
    energy: tuning.energyMax,
    pregnantDaysLeft: 0,
    carryGenes: null,
    cooldownDays: 0,
  };
}
