import type { Rng } from './rng';
import { GENE_RANGE, type Genes, type Tuning } from './types';

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function newGenes(rng: Rng, tuning: Tuning): Genes {
  return {
    sense: rng.range(tuning.senseMin, tuning.senseMax),
    speed: rng.range(tuning.speedMin, tuning.speedMax),
    urge: rng.range(tuning.urgeMin, tuning.urgeMax),
    gest: rng.range(tuning.gestMinDays, tuning.gestMaxDays),
    des: rng.range(0.2, 0.8),
  };
}

/** One-point-per-gene inheritance from two parents, with mutation clamped
 * to the hard trait-space bounds in GENE_RANGE (§5.3). */
export function inheritGenes(a: Genes, b: Genes, rng: Rng, tuning: Tuning): Genes {
  const keys = Object.keys(GENE_RANGE) as Array<keyof Genes>;
  const out = {} as Genes;
  for (const key of keys) {
    let value = rng.chance(0.5) ? a[key] : b[key];
    if (rng.chance(tuning.mutChance)) {
      const [lo, hi] = GENE_RANGE[key];
      value = clamp(value + rng.range(-1, 1) * (hi - lo) * tuning.mutStep, lo, hi);
    }
    out[key] = value;
  }
  return out;
}

/**
 * The gestation trade-off coupling (§0.3 item 3, §5.3): short gestation
 * yields more, weaker offspring via a maturity penalty. Without this
 * coupling gestation is a free parameter and the trade-off is fictional —
 * so this formula, not gestation alone, is what makes `gest` a real gene.
 */
export function maturityDaysFromGestation(gestDays: number, baseMaturityDays: number): number {
  return gestDays * 1.6 + baseMaturityDays * 0.5;
}

/** Short gestation -> more, weaker kits. Long gestation -> one robust kit. */
export function litterSizeFromGestation(gestDays: number, tuning: Pick<Tuning, 'gestMinDays' | 'gestMaxDays'>): number {
  const span = tuning.gestMaxDays - tuning.gestMinDays || 1;
  const t = clamp((gestDays - tuning.gestMinDays) / span, 0, 1);
  if (t < 1 / 3) return 3;
  if (t < 2 / 3) return 2;
  return 1;
}
