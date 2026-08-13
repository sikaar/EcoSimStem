import { describe, expect, it } from 'vitest';
import type { World } from '../src/engine/world';
import { move } from '../src/engine/systems/movement';

function emptyWorld(overrides: Partial<World> = {}): World {
  return { half: 28, lakes: [], shore: [], obstacles: [], dens: [], ...overrides };
}

describe('move', () => {
  it('advances straight toward an unobstructed target', () => {
    const world = emptyWorld();
    const result = move(world, { x: 0, z: 0 }, 10, 0, 2, 1);
    expect(result.moved).toBe(true);
    expect(result.x).toBeCloseTo(2);
    expect(result.z).toBeCloseTo(0);
  });

  it('deflects around an obstacle that is off the direct line to target', () => {
    // Obstacle directly on the target line produces zero lateral force by
    // construction (the repulsion is radial); offset it so there's
    // something for the repulsion to actually bend around.
    const world = emptyWorld({ obstacles: [{ x: 1, z: 0.5, r: 1 }] });
    const result = move(world, { x: 0, z: 0 }, 10, 0, 2, 1);
    expect(Math.abs(result.z)).toBeGreaterThan(0.01);
  });

  it('shoreline-stall fix: finds a legal heading via the 8-candidate fallback instead of freezing (§6.3, §16.1)', () => {
    // A shoreline point where the direct path toward the target crosses
    // water, but land is available off to the side.
    const world = emptyWorld({ lakes: [{ x: 5, z: 0, rot: 0, rx: 3, rz: 3 }] });
    const result = move(world, { x: 1, z: 0 }, 10, 0, 2, 1);
    expect(result.moved).toBe(true);
    // The prototype's defect was returning with position unchanged; here
    // the fallback must land somewhere legal and different.
    expect(result.x === 1 && result.z === 0).toBe(false);
  });

  it('refuses to move only when every one of the 8 candidates is illegal', () => {
    // Creature sits at the centre of a lake far larger than one step —
    // every direction for this step size is still water.
    const world = emptyWorld({ lakes: [{ x: 0, z: 0, rot: 0, rx: 1000, rz: 1000 }] });
    const result = move(world, { x: 0, z: 0 }, 10, 0, 2, 1);
    expect(result.moved).toBe(false);
    expect(result.x).toBe(0);
    expect(result.z).toBe(0);
  });

  it('rejects stepping outside the world bounds', () => {
    const world = emptyWorld({ half: 5 });
    const result = move(world, { x: 4.9, z: 0 }, 100, 0, 10, 1);
    // Direct step would overshoot bounds; fallback should still keep it in-bounds.
    expect(Math.abs(result.x)).toBeLessThanOrEqual(5);
    expect(Math.abs(result.z)).toBeLessThanOrEqual(5);
  });
});
