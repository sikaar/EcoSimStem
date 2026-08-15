import { DEFAULT_TUNING } from '../config/tuning';
import type { Tuning } from '../engine/types';
import type { GameMode } from './gameStore';

/**
 * localStorage persistence (§12). Schema-versioned so a future shape
 * change has somewhere to branch from on read.
 *
 * Deliberately smaller than the spec's full SaveV2 shape — biome,
 * archetype, cards, and scores don't exist yet (Phase 2+), so this only
 * persists what's actually simulated today: seed, day reached, and the
 * tuning delta from defaults. `version: 1` because this is genuinely the
 * first save schema in this codebase, not a port of a prior one.
 *
 * Resume works by deterministic replay, not full entity serialization:
 * createSim(seed, tuning) + runUntilDay(sim, day) reproduces the exact
 * same state the original run reached (already relied on by sim.test.ts's
 * determinism checks), which is simpler than serializing every rabbit.
 * The tradeoff is day-boundary granularity — autosave captures "day N,
 * dawn," not an arbitrary mid-day moment, so resuming replays from the
 * start of that day rather than the exact second you left off.
 */
export interface SaveV1 {
  version: 1;
  seed: number;
  day: number;
  tuningDelta: Partial<Tuning>;
  savedAt: number;
  /** Optional so saves written before Game Mode existed still load —
   * loadSave defaults it to 'free' when absent. Resuming does NOT restore
   * EP/level/objective progress (that state was never persisted; see
   * GameView's doc comment on resetForNewRun) — this field only keeps a
   * resumed Game Mode run's knobs correctly locked instead of silently
   * becoming a fully-unlocked Free Mode run. */
  mode?: GameMode;
}

const SAVE_KEY = 'ecosystem_save_v1';

function diffFromDefaults(tuning: Tuning): Partial<Tuning> {
  const delta: Partial<Tuning> = {};
  for (const key of Object.keys(DEFAULT_TUNING) as Array<keyof Tuning>) {
    if (tuning[key] !== DEFAULT_TUNING[key]) {
      delta[key] = tuning[key];
    }
  }
  return delta;
}

export function saveRun(seed: number, tuning: Tuning, day: number, mode: GameMode): void {
  const save: SaveV1 = {
    version: 1,
    seed,
    day,
    tuningDelta: diffFromDefaults(tuning),
    savedAt: Date.now(),
    mode,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Private browsing / storage quota — losing an autosave silently
    // beats surfacing an error for a background convenience feature.
  }
}

function isValidSave(value: unknown): value is SaveV1 {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v['version'] === 1 &&
    typeof v['seed'] === 'number' &&
    typeof v['day'] === 'number' &&
    typeof v['savedAt'] === 'number' &&
    typeof v['tuningDelta'] === 'object' &&
    v['tuningDelta'] !== null &&
    (v['mode'] === undefined || v['mode'] === 'free' || v['mode'] === 'game')
  );
}

export function loadSave(): SaveV1 | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidSave(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
