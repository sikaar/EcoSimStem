import type { SimState } from '../engine/sim';

/**
 * A live reference to the running sim, set by App.tsx's setup effect.
 * simStore only carries aggregates (§4.1) — but the trait cloud (§9.2)
 * needs every rabbit's individual genes each frame, which has no place
 * in an aggregate snapshot. This is the same pattern as store/liveTuning:
 * a shared mutable module rather than React context, since the consumer
 * (TraitCloud) reads it inside its own animation-frame loop, not React's
 * render cycle.
 */
export const simRef: { current: SimState | null } = { current: null };
