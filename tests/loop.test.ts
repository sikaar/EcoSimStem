import { describe, expect, it, vi } from 'vitest';
import { createFixedTimestepLoop } from '../src/engine/loop';

describe('createFixedTimestepLoop (§4.2)', () => {
  it('does not step or render on the first tick — it only anchors the clock', () => {
    const step = vi.fn();
    const render = vi.fn();
    const loop = createFixedTimestepLoop({ step, render });
    loop.tick(1000);
    expect(step).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  });

  it('steps once per tick when frame time exactly matches dt', () => {
    const step = vi.fn();
    const loop = createFixedTimestepLoop({ step, dt: 0.1 });
    loop.tick(0);
    loop.tick(100); // +100ms = 0.1s
    expect(step).toHaveBeenCalledTimes(1);
    expect(step).toHaveBeenCalledWith(0.1);
  });

  it('calls render exactly once per tick() call regardless of how many steps ran', () => {
    const render = vi.fn();
    const loop = createFixedTimestepLoop({ step: () => {}, render, dt: 0.1 });
    loop.tick(0);
    loop.tick(50); // under one dt — 0 steps, still renders
    loop.tick(150); // one dt worth — 1 step, still renders once
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('caps a wall-clock jump at 0.1s before it ever reaches the accumulator (tab-switch guard)', () => {
    const step = vi.fn();
    const loop = createFixedTimestepLoop({ step, dt: 0.01 });
    loop.tick(0);
    loop.tick(60_000); // huge jump — a full minute of hidden-tab time
    // frameDt capped at 0.1s, guard caps steps at speedMultiplier(1) * 4 = 4
    expect(step).toHaveBeenCalledTimes(4);
  });

  it('scales the guard allowance with the speed multiplier, so fast-forward still runs more steps per tick', () => {
    const step = vi.fn();
    const loop = createFixedTimestepLoop({ step, dt: 0.01, getSpeedMultiplier: () => 2 });
    loop.tick(0);
    loop.tick(60_000);
    // frameDt capped at 0.1s, *2 multiplier = 0.2s accumulated; guard caps at 2*4 = 8
    expect(step).toHaveBeenCalledTimes(8);
  });

  it('reset re-anchors the clock and zeroes the accumulator', () => {
    const step = vi.fn();
    const loop = createFixedTimestepLoop({ step, dt: 0.1 });
    loop.tick(0);
    loop.tick(50); // 0.05s accumulated, below dt — no step yet
    loop.reset(1000); // re-anchor; any accumulated backlog is discarded
    loop.tick(1050); // another 0.05s from the new anchor — still below dt
    expect(step).not.toHaveBeenCalled();
    loop.tick(1100); // now 0.1s from the reset anchor — one dt's worth
    expect(step).toHaveBeenCalledTimes(1);
  });
});
