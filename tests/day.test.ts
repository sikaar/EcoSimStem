import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '../src/config/tuning';
import { advanceDayPhase, completeDraft, createDayState, secondsUntilNightfall } from '../src/engine/day';

const tuning = DEFAULT_TUNING;

function runUntilPhase(state: ReturnType<typeof createDayState>, phase: string, stepSec = 0.5, maxSteps = 100000) {
  let s = state;
  let steps = 0;
  while (s.phase !== phase && steps++ < maxSteps) {
    s = advanceDayPhase(s, stepSec, tuning);
    if (s.phase === 'draft') break; // draft needs explicit completion
  }
  return s;
}

describe('day-phase state machine (§4.2)', () => {
  it('progresses dawn -> forage -> dusk -> resolve in order', () => {
    let state = createDayState(1);
    expect(state.phase).toBe('dawn');

    state = runUntilPhase(state, 'forage');
    expect(state.phase).toBe('forage');

    state = runUntilPhase(state, 'dusk');
    expect(state.phase).toBe('dusk');

    state = runUntilPhase(state, 'resolve');
    expect(state.phase).toBe('resolve');
  });

  it('goes resolve -> draft on a draft-interval day, and requires explicit completion', () => {
    const t = { ...tuning, draftIntervalDays: 2 };
    let state = createDayState(2); // day 2 is a draft day (2 % 2 === 0)
    for (let i = 0; i < 100000 && state.phase !== 'resolve'; i++) {
      state = advanceDayPhase(state, 0.5, t);
    }
    state = advanceDayPhase(state, 0.001, t); // resolve -> draft (instant)
    expect(state.phase).toBe('draft');

    // Draft never auto-advances no matter how much time passes.
    const stillDraft = advanceDayPhase(state, 1e9, t);
    expect(stillDraft.phase).toBe('draft');

    const afterPick = completeDraft(state);
    expect(afterPick.phase).toBe('night');
  });

  it('goes resolve -> night directly on a non-draft-interval day', () => {
    const t = { ...tuning, draftIntervalDays: 2 };
    let state = createDayState(1); // day 1 is not a draft day
    for (let i = 0; i < 100000 && state.phase !== 'resolve'; i++) {
      state = advanceDayPhase(state, 0.5, t);
    }
    state = advanceDayPhase(state, 0.001, t);
    expect(state.phase).toBe('night');
  });

  it('increments the day counter only on night -> dawn', () => {
    let state = createDayState(1);
    for (let i = 0; i < 200000 && !(state.phase === 'dawn' && state.day === 2); i++) {
      state = advanceDayPhase(state, 0.5, { ...tuning, draftIntervalDays: 1000 });
      if (state.phase === 'draft') state = completeDraft(state);
    }
    expect(state.day).toBe(2);
    expect(state.phase).toBe('dawn');
  });

  it('completeDraft is a no-op outside the draft phase', () => {
    const state = createDayState(1);
    expect(completeDraft(state)).toEqual(state);
  });
});

describe('secondsUntilNightfall (§6.2)', () => {
  it('counts down through forage and into dusk as one continuous window', () => {
    const midForage = { day: 1, phase: 'forage' as const, phaseElapsed: tuning.dayLengthSec / 2 };
    expect(secondsUntilNightfall(midForage, tuning)).toBeCloseTo(tuning.dayLengthSec / 2 + tuning.duskLengthSec);

    const endOfForage = { day: 1, phase: 'forage' as const, phaseElapsed: tuning.dayLengthSec };
    expect(secondsUntilNightfall(endOfForage, tuning)).toBeCloseTo(tuning.duskLengthSec);

    const midDusk = { day: 1, phase: 'dusk' as const, phaseElapsed: tuning.duskLengthSec / 2 };
    expect(secondsUntilNightfall(midDusk, tuning)).toBeCloseTo(tuning.duskLengthSec / 2);

    const endOfDusk = { day: 1, phase: 'dusk' as const, phaseElapsed: tuning.duskLengthSec };
    expect(secondsUntilNightfall(endOfDusk, tuning)).toBeCloseTo(0);
  });

  it('never goes negative even past the nominal end of a phase', () => {
    const overrun = { day: 1, phase: 'dusk' as const, phaseElapsed: tuning.duskLengthSec + 5 };
    expect(secondsUntilNightfall(overrun, tuning)).toBe(0);
  });
});
