import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng';
import { DEFAULT_TUNING } from '../src/config/tuning';
import { GENE_RANGE } from '../src/engine/types';
import { inheritGenes, litterSizeFromGestation, maturityDaysFromGestation, newGenes } from '../src/engine/genetics';

describe('newGenes', () => {
  it('samples within the tuning-configured founding ranges', () => {
    const rng = createRng(1);
    for (let i = 0; i < 500; i++) {
      const g = newGenes(rng, DEFAULT_TUNING);
      expect(g.sense).toBeGreaterThanOrEqual(DEFAULT_TUNING.senseMin);
      expect(g.sense).toBeLessThan(DEFAULT_TUNING.senseMax);
      expect(g.speed).toBeGreaterThanOrEqual(DEFAULT_TUNING.speedMin);
      expect(g.speed).toBeLessThan(DEFAULT_TUNING.speedMax);
      expect(g.urge).toBeGreaterThanOrEqual(DEFAULT_TUNING.urgeMin);
      expect(g.urge).toBeLessThan(DEFAULT_TUNING.urgeMax);
      expect(g.gest).toBeGreaterThanOrEqual(DEFAULT_TUNING.gestMinDays);
      expect(g.gest).toBeLessThan(DEFAULT_TUNING.gestMaxDays);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(newGenes(createRng(9), DEFAULT_TUNING)).toEqual(newGenes(createRng(9), DEFAULT_TUNING));
  });
});

describe('inheritGenes', () => {
  it('picks each gene from one parent when mutation never fires', () => {
    const rng = createRng(2);
    const tuning = { ...DEFAULT_TUNING, mutChance: 0 };
    const a = newGenes(createRng(10), tuning);
    const b = newGenes(createRng(20), tuning);
    const kid = inheritGenes(a, b, rng, tuning);
    for (const key of Object.keys(GENE_RANGE) as Array<keyof typeof a>) {
      expect([a[key], b[key]]).toContain(kid[key]);
    }
  });

  it('keeps mutated genes within the hard trait-space clamp (§5.3)', () => {
    const rng = createRng(3);
    const tuning = { ...DEFAULT_TUNING, mutChance: 1, mutStep: 5 }; // force + exaggerate mutation
    const a = newGenes(createRng(11), DEFAULT_TUNING);
    const b = newGenes(createRng(12), DEFAULT_TUNING);
    for (let i = 0; i < 500; i++) {
      const kid = inheritGenes(a, b, rng, tuning);
      for (const key of Object.keys(GENE_RANGE) as Array<keyof typeof a>) {
        const [lo, hi] = GENE_RANGE[key];
        expect(kid[key]).toBeGreaterThanOrEqual(lo);
        expect(kid[key]).toBeLessThanOrEqual(hi);
      }
    }
  });
});

describe('gestation -> maturity coupling (§5.3, §0.3 item 3)', () => {
  it('matches the derived formula exactly', () => {
    expect(maturityDaysFromGestation(1, 4)).toBeCloseTo(1 * 1.6 + 4 * 0.5);
    expect(maturityDaysFromGestation(4, 4)).toBeCloseTo(4 * 1.6 + 4 * 0.5);
  });

  it('rewards short gestation with faster maturity than long gestation', () => {
    const short = maturityDaysFromGestation(DEFAULT_TUNING.gestMinDays, DEFAULT_TUNING.maturityDays);
    const long = maturityDaysFromGestation(DEFAULT_TUNING.gestMaxDays, DEFAULT_TUNING.maturityDays);
    expect(short).toBeLessThan(long);
  });

  it('gives short gestation a bigger litter than long gestation — the trade-off must be real, not free', () => {
    const shortLitter = litterSizeFromGestation(DEFAULT_TUNING.gestMinDays, DEFAULT_TUNING);
    const longLitter = litterSizeFromGestation(DEFAULT_TUNING.gestMaxDays, DEFAULT_TUNING);
    expect(shortLitter).toBeGreaterThan(longLitter);
  });
});
