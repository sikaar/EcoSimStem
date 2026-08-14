import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '../src/config/tuning';
import { applyDailyHunger, applyDailyThirst, isDehydrated, isStarved } from '../src/engine/systems/condition';

describe('condition — multi-day hunger/thirst (§6.5)', () => {
  it('accrues additively per day', () => {
    expect(applyDailyHunger(0, DEFAULT_TUNING)).toBeCloseTo(DEFAULT_TUNING.hungerPerDay);
    expect(applyDailyThirst(0, DEFAULT_TUNING)).toBeCloseTo(DEFAULT_TUNING.thirstPerDay);
  });

  it('kills only once the 0..1 cap is reached', () => {
    expect(isStarved(0.99)).toBe(false);
    expect(isStarved(1)).toBe(true);
    expect(isDehydrated(0.99)).toBe(false);
    expect(isDehydrated(1)).toBe(true);
  });

  it('takes at least 2 full days to starve or dehydrate from zero (§5.5 invariant 3)', () => {
    const daysToStarve = 1 / DEFAULT_TUNING.hungerPerDay;
    const daysToDehydrate = 1 / DEFAULT_TUNING.thirstPerDay;
    expect(daysToStarve).toBeGreaterThanOrEqual(2);
    expect(daysToDehydrate).toBeGreaterThanOrEqual(2);
  });
});
