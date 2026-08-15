import { describe, expect, it } from 'vitest';
import { computeKnobCost, getTuningField } from '../src/config/tuningFields';
import { GAME_LEVELS, unlockedSections } from '../src/config/gameLevels';

describe('computeKnobCost', () => {
  it('is free-tier zero regardless of delta', () => {
    const field = getTuningField('capRabbits')!;
    expect(field.tier).toBe('free');
    expect(computeKnobCost(field, 20, 400)).toBe(0);
  });

  it('scales up with a larger delta', () => {
    const field = getTuningField('predatorSpeed')!; // terminal
    const small = computeKnobCost(field, 3, 3.1);
    const large = computeKnobCost(field, 1, 6);
    expect(large).toBeGreaterThan(small);
  });

  it('immediate tier grows roughly with the square of the delta fraction', () => {
    const field = getTuningField('hungerPerDay')!; // immediate
    const quarterSpan = computeKnobCost(field, field.min, field.min + (field.max - field.min) / 4);
    const halfSpan = computeKnobCost(field, field.min, field.min + (field.max - field.min) / 2);
    // Quadratic: doubling the fraction should roughly quadruple the (cost - baseline).
    const baseline = computeKnobCost(field, field.min, field.min);
    expect(halfSpan - baseline).toBeGreaterThan((quarterSpan - baseline) * 3);
  });
});

describe('unlockedSections', () => {
  it('level 1 only unlocks environment', () => {
    const sections = unlockedSections(1);
    expect(sections.has('environment')).toBe(true);
    expect(sections.has('predator')).toBe(false);
    expect(sections.has('shared')).toBe(false);
  });

  it('unlocks accumulate across levels rather than replacing', () => {
    const atLevel4 = unlockedSections(4);
    expect(atLevel4.has('environment')).toBe(true); // from level 1
    expect(atLevel4.has('rabbitMetabolism')).toBe(true); // from level 2
    expect(atLevel4.has('predator')).toBe(true); // from level 4
    expect(atLevel4.has('shared')).toBe(false); // level 5 only
  });

  it('level 5 unlocks everything', () => {
    const sections = unlockedSections(5);
    for (const level of GAME_LEVELS) {
      for (const section of level.unlocks) {
        expect(sections.has(section)).toBe(true);
      }
    }
  });
});

describe('GAME_LEVELS data integrity', () => {
  it('is numbered 1..5 in order', () => {
    expect(GAME_LEVELS.map((l) => l.num)).toEqual([1, 2, 3, 4, 5]);
  });

  it('every level has exactly two side objectives', () => {
    for (const level of GAME_LEVELS) expect(level.sides).toHaveLength(2);
  });
});
