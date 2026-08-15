import { describe, expect, it } from 'vitest';
import type { World } from '../src/engine/world';
import { move, wanderTarget } from '../src/engine/systems/movement';

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

  it('reports moved:false when already standing on the target', () => {
    // Regression guard. This used to return moved:true with a zero-length
    // step, so a creature parked on its target paid the full speed^2
    // movement cost to stand still — which is how stuck rabbits burned
    // their whole energy pool without going anywhere.
    const world = emptyWorld();
    const result = move(world, { x: 3, z: 4 }, 3, 4, 2, 1 / 60);
    expect(result.moved).toBe(false);
    expect(result.x).toBe(3);
    expect(result.z).toBe(4);
    expect(result.vx).toBe(0);
    expect(result.vz).toBe(0);
  });

  it('does not overshoot a target closer than one step', () => {
    const world = emptyWorld();
    const result = move(world, { x: 0, z: 0 }, 0.5, 0, 10, 1); // step would be 10m
    expect(result.x).toBeCloseTo(0.5);
    expect(result.z).toBeCloseTo(0);
  });
});

describe('wanderTarget', () => {
  it('finds a legal heading behind the creature when everything ahead is blocked', () => {
    // Regression guard. The sweep used to cover only +/-90 degrees around
    // the current facing, so a creature facing a wall got its own position
    // back as a target — which made `move` return a zero-length step and
    // leave `dir` unchanged, so the next tick retried the same failing arc
    // forever. Here the only open water-free ground is behind.
    const world = emptyWorld({ lakes: [{ x: 0, z: 10, rot: 0, rx: 9, rz: 9 }] });
    const pos = { x: 0, z: 0.2 };
    const target = wanderTarget(world, pos, 0 /* facing +z, straight into the lake */, 3);
    expect(target.x === pos.x && target.z === pos.z).toBe(false);
    // Any heading that isn't into the lake will do — sideways counts.
    expect(target.z).toBeLessThanOrEqual(pos.z + 1e-9);
  });

  it('escapes a position outside the world instead of freezing there', () => {
    // Regression guard for the trap that froze founders: den scatter could
    // place a rabbit past the map edge, and bounds used to be enforced by
    // rejecting the step — which rejected the inward ones too.
    const world = emptyWorld({ half: 28 });
    const target = wanderTarget(world, { x: 28.36, z: -25.18 }, 0, 3);
    expect(Math.abs(target.x)).toBeLessThanOrEqual(28);
  });

  it('returns its own position only when genuinely walled in on all sides', () => {
    const world = emptyWorld({ lakes: [{ x: 0, z: 0, rot: 0, rx: 1000, rz: 1000 }] });
    const target = wanderTarget(world, { x: 0, z: 0 }, 0, 3);
    expect(target).toEqual({ x: 0, z: 0 });
  });
});
