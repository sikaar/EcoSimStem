import type { Rng } from '../rng';
import { inheritGenes, litterSizeFromGestation, maturityDaysFromGestation } from '../genetics';
import { makeRabbit, type Rabbit } from '../entities/rabbit';
import type { Genes, Tuning } from '../types';

/**
 * Mating negotiation, gestation, and dawn births. Gestation and its
 * cooldowns are day-scaled in v2 (§0.1) — `gest` is now 1-4 days rather
 * than seconds — but the acceptance mechanic itself is unchanged from the
 * prototype: the male always decides accept/reject, weighted by his `des`
 * gene.
 */

export function canBreed(state: Pick<Rabbit, 'ageDays' | 'maturityDays' | 'pregnantDaysLeft' | 'cooldownDays'>): boolean {
  return state.ageDays >= state.maturityDays && state.pregnantDaysLeft <= 0 && state.cooldownDays <= 0;
}

const MALE_ACCEPT_BASE = 0.25;
const MALE_ACCEPT_DES_WEIGHT = 0.7;
// The prototype's male/female post-mate cooldowns (3s, gest+5s) were tuned
// for a continuous-time model where `gest` itself was in seconds. Now that
// gest is 1-4 *days*, reusing those literal numbers as day-counts would
// make a female infertile for gest+5 days after every litter (6-9 days —
// nearly half a 20-day run) purely from an unrescaled unit carry-over, not
// a deliberate balance choice. Rescaled down to a short day-count instead.
const MALE_POST_MATE_COOLDOWN_DAYS = 1;
/** Buffer added on top of gestation length so a female doesn't immediately
 * re-enter the mating pool the instant she gives birth. */
const FEMALE_POST_CONCEIVE_COOLDOWN_BUFFER_DAYS = 1;

export interface MateAttemptResult {
  accepted: boolean;
  male: Rabbit;
  female: Rabbit;
}

export function attemptMate(male: Rabbit, female: Rabbit, rng: Rng): MateAttemptResult {
  if (female.pregnantDaysLeft > 0 || female.cooldownDays > 0) {
    return { accepted: false, male, female };
  }
  const accepted = rng.chance(MALE_ACCEPT_BASE + male.genes.des * MALE_ACCEPT_DES_WEIGHT);
  if (!accepted) {
    return { accepted: false, male, female };
  }
  return {
    accepted: true,
    male: { ...male, cooldownDays: MALE_POST_MATE_COOLDOWN_DAYS },
    female: {
      ...female,
      pregnantDaysLeft: female.genes.gest,
      carryGenes: male.genes,
      cooldownDays: female.genes.gest + FEMALE_POST_CONCEIVE_COOLDOWN_BUFFER_DAYS,
    },
  };
}

/** One day of gestation passing — call once per day, not per dt. */
export function advanceGestation(pregnantDaysLeft: number): number {
  return Math.max(0, pregnantDaysLeft - 1);
}

export function gestationComplete(mother: Pick<Rabbit, 'pregnantDaysLeft' | 'carryGenes'>): boolean {
  return mother.pregnantDaysLeft <= 0 && mother.carryGenes !== null;
}

export interface BirthLitterParams {
  mother: Rabbit;
  fatherGenes: Genes;
  nextId: () => number;
  rng: Rng;
  tuning: Tuning;
}

/**
 * Births happen at dawn, in the den (§6.4) — the mother's field position is
 * never used as a spawn point, unlike the prototype. Litter size follows
 * the mother's own `gest` gene; each kit's genes and maturity are rolled
 * independently via the gestation-to-maturity coupling (§5.3, §0.3 item 3).
 */
export function birthLitter(params: BirthLitterParams): Rabbit[] {
  const { mother, fatherGenes, nextId, rng, tuning } = params;
  const litterSize = litterSizeFromGestation(mother.genes.gest, tuning);
  const kits: Rabbit[] = [];
  for (let i = 0; i < litterSize; i++) {
    const genes = inheritGenes(mother.genes, fatherGenes, rng, tuning);
    const kit = makeRabbit({
      id: nextId(),
      x: mother.x,
      z: mother.z,
      generation: mother.generation + 1,
      genes,
      mature: false,
      rng,
      tuning,
    });
    kit.maturityDays = maturityDaysFromGestation(genes.gest, tuning.maturityDays);
    kits.push(kit);
  }
  return kits;
}
