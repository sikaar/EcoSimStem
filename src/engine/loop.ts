/**
 * Fixed-timestep accumulator (§4.2). Kept as the substrate the day-phase
 * machine sits on top of, per the handover's explicit instruction. Wired
 * as `tick(nowMs)` rather than owning `requestAnimationFrame` itself, so
 * it can be driven with synthetic timestamps in Vitest — the RAF loop
 * itself is a render-layer concern, not the engine's.
 */

export interface FixedTimestepLoopOptions {
  /** Simulation timestep in seconds. Defaults to 1/60. */
  dt?: number;
  /** Called once per simulated tick with the fixed dt. */
  step: (dt: number) => void;
  /** Called once per `tick()` call, after any step()s it triggered. */
  render?: () => void;
  /** Time-compression factor (fast-forward). Defaults to 1. */
  getSpeedMultiplier?: () => number;
}

export interface FixedTimestepLoop {
  /** Advance the loop given the current wall-clock time in milliseconds. */
  tick(nowMs: number): void;
  /** Re-anchor the loop to a new wall-clock time without accumulating a
   * jump — call after a pause or tab-blur resume. */
  reset(nowMs: number): void;
}

const DEFAULT_DT = 1 / 60;
/** Tab-switch guard: never treat a single frame as more than 0.1s of
 * elapsed wall-clock time (§4.2). */
const MAX_FRAME_DT_SEC = 0.1;

export function createFixedTimestepLoop(options: FixedTimestepLoopOptions): FixedTimestepLoop {
  const dt = options.dt ?? DEFAULT_DT;
  const getSpeedMultiplier = options.getSpeedMultiplier ?? (() => 1);
  let lastMs: number | null = null;
  let acc = 0;

  function reset(nowMs: number): void {
    lastMs = nowMs;
    acc = 0;
  }

  function tick(nowMs: number): void {
    if (lastMs === null) {
      lastMs = nowMs;
      return;
    }
    const frameDt = Math.min((nowMs - lastMs) / 1000, MAX_FRAME_DT_SEC);
    lastMs = nowMs;

    const speedMultiplier = getSpeedMultiplier();
    acc += frameDt * speedMultiplier;

    // Guard against a death spiral on slow machines (§4.2) — cap how many
    // step()s a single tick can trigger, scaled to the speed multiplier so
    // fast-forward still gets to run more steps per tick.
    let guard = 0;
    const guardLimit = speedMultiplier * 4;
    while (acc >= dt && guard++ < guardLimit) {
      options.step(dt);
      acc -= dt;
    }

    options.render?.();
  }

  return { tick, reset };
}
