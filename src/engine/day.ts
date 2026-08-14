import type { Tuning } from './types';

/**
 * The day-phase state machine (§4.2). The day is the game's metronome, save
 * point, scoring interval, and draft boundary — this module owns the phase
 * graph itself; the fixed-timestep accumulator that drives it lives in
 * loop.ts, and what each phase actually *does* to the population lives in
 * systems/lifecycle.ts and friends.
 */
export type DayPhase = 'dawn' | 'forage' | 'dusk' | 'resolve' | 'draft' | 'night';

export interface DayState {
  day: number;
  phase: DayPhase;
  /** Seconds elapsed within the current phase. */
  phaseElapsed: number;
}

// Fixed-duration phases not exposed as tuning knobs — they're pacing, not balance.
const DAWN_DURATION_SEC = 2;
const NIGHT_DURATION_SEC = 1.5;

export function createDayState(day = 1): DayState {
  return { day, phase: 'dawn', phaseElapsed: 0 };
}

function phaseDuration(phase: DayPhase, tuning: Pick<Tuning, 'dayLengthSec' | 'duskLengthSec'>): number {
  switch (phase) {
    case 'dawn':
      return DAWN_DURATION_SEC;
    case 'forage':
      return tuning.dayLengthSec;
    case 'dusk':
      return tuning.duskLengthSec;
    case 'resolve':
      return 0; // instant
    case 'draft':
      return Infinity; // "until input" — never auto-advances, see completeDraft
    case 'night':
      return NIGHT_DURATION_SEC;
  }
}

function nextPhase(phase: DayPhase, day: number, tuning: Pick<Tuning, 'draftIntervalDays'>): DayPhase {
  switch (phase) {
    case 'dawn':
      return 'forage';
    case 'forage':
      return 'dusk';
    case 'dusk':
      return 'resolve';
    case 'resolve':
      return day % tuning.draftIntervalDays === 0 ? 'draft' : 'night';
    case 'draft':
      return 'night'; // reached only via completeDraft, never by elapsed time
    case 'night':
      return 'dawn';
  }
}

/** Advance the state machine by `dt` seconds. Never auto-advances out of
 * `draft` — that phase is "until input" (§4.2's table) and requires an
 * explicit `completeDraft` call once the player has chosen a card. */
export function advanceDayPhase(
  state: DayState,
  dt: number,
  tuning: Pick<Tuning, 'dayLengthSec' | 'duskLengthSec' | 'draftIntervalDays'>,
): DayState {
  const elapsed = state.phaseElapsed + dt;
  const duration = phaseDuration(state.phase, tuning);
  if (elapsed < duration) {
    return { ...state, phaseElapsed: elapsed };
  }
  const next = nextPhase(state.phase, state.day, tuning);
  const day = next === 'dawn' ? state.day + 1 : state.day;
  return { day, phase: next, phaseElapsed: 0 };
}

/** Explicit transition out of `draft`, fired when the player has picked a
 * card (or there was nothing to pick because the interval was skipped —
 * callers just won't be in `draft` phase in that case). */
export function completeDraft(state: DayState): DayState {
  if (state.phase !== 'draft') return state;
  return { day: state.day, phase: 'night', phaseElapsed: 0 };
}

/**
 * Seconds remaining before the field becomes fatal for creatures still
 * out — the end of `dusk`, when `resolve` kills anything not denned. Used
 * by drives.ts's `computeReturnUrgency` (§6.2) as the `timeRatio`
 * denominator.
 */
export function secondsUntilNightfall(
  state: DayState,
  tuning: Pick<Tuning, 'dayLengthSec' | 'duskLengthSec'>,
): number {
  switch (state.phase) {
    case 'forage':
      return Math.max(0, tuning.dayLengthSec - state.phaseElapsed) + tuning.duskLengthSec;
    case 'dusk':
      return Math.max(0, tuning.duskLengthSec - state.phaseElapsed);
    default:
      // Not a foraging phase — nothing should be computing return urgency
      // right now, but return the full window rather than 0/NaN.
      return tuning.dayLengthSec + tuning.duskLengthSec;
  }
}
