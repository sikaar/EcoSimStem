import { DEFAULT_TUNING } from '../config/tuning';
import type { Tuning } from '../engine/types';

/**
 * A single mutable Tuning instance, shared by reference between the
 * running sim and the debug tuning panel. `sim.tuning` is read fresh on
 * every step (§engine systems all take `tuning` by reference, never copy
 * it), so mutating a field here takes effect on the very next tick —
 * no restart needed for most knobs. Creation-time-only fields (den
 * counts, `predatorStart`, world layout) need requestRestart() from
 * simStore to actually take effect, since they're only read once inside
 * createSim().
 *
 * This is a debug tool, not the eventual save/settings system (§12) —
 * it exists so predator balance (the known open item — see tuning.ts's
 * header) can be explored live instead of via a code-change-and-redeploy
 * loop.
 */
export const liveTuning: Tuning = { ...DEFAULT_TUNING };

export function resetLiveTuning(): void {
  Object.assign(liveTuning, DEFAULT_TUNING);
}
