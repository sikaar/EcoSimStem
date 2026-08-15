import { isInWater, type World } from '../world';

/**
 * Steering: seek target, repel from obstacles, reject water/bounds.
 *
 * Carries over the prototype's obstacle-repulsion feel unchanged, but fixes
 * the shoreline-stall defect (§6.3, §16 item 1): the prototype rotated once,
 * retried once, then gave up and didn't move at all — which is why rabbits
 * froze at the bank (most headings near a shoreline point at water). This
 * version samples up to 8 candidate headings and takes the legal one best
 * aligned with the desired direction, only refusing to move if all 8 fail.
 */

export interface Movable {
  x: number;
  z: number;
}

export interface MoveResult {
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Facing heading in radians, x = sin(dir), z = cos(dir) — matches the
   * prototype's convention so render-layer rotation stays a drop-in port. */
  dir: number;
  /** False when the creature did not actually change position this step —
   * either because every candidate heading was illegal, or because it was
   * already standing on its target. Drives the idle-vs-moving energy rate,
   * so it must reflect real displacement, not merely "a move was
   * attempted": a creature parked on its target that reports `true` pays
   * the full speed² movement cost while going nowhere. */
  moved: boolean;
}

const OBSTACLE_MARGIN = 1.1;
const OBSTACLE_PUSH = 0.9;
const WATER_REJECT_PAD = 0.25;
const CANDIDATE_HEADINGS = 8;

const clampAxis = (v: number, half: number): number => (v < -half ? -half : v > half ? half : v);

/** World bounds are enforced by CLAMPING, not by rejection. Rejecting an
 * out-of-bounds step looks equivalent but creates an inescapable trap: a
 * creature that starts outside the world (den scatter can place founders
 * past the edge) finds every candidate step still out of bounds — including
 * the ones heading back inward — so it can never legalise itself and
 * freezes for the rest of the run. Clamping makes "outside the world" a
 * state that resolves itself on the next step instead. Water still
 * rejects, since a creature in water has legal ground all around it. */
function clampToWorld(world: World, x: number, z: number): { x: number; z: number } {
  return { x: clampAxis(x, world.half), z: clampAxis(z, world.half) };
}

function isLegal(world: World, x: number, z: number): boolean {
  return !isInWater(world, x, z, WATER_REJECT_PAD);
}

function angularDistance(a: number, b: number): number {
  const twoPi = Math.PI * 2;
  let diff = Math.abs(a - b) % twoPi;
  if (diff > Math.PI) diff = twoPi - diff;
  return diff;
}

/** Below this distance a creature counts as already standing on its target
 * and holds position instead of jittering across it. One 60Hz step at a
 * typical 2 m/s is ~0.033m, so this is a couple of steps' worth. */
const ARRIVAL_EPSILON = 0.05;

/** A wander target must be at least this far away to be worth walking to —
 * comfortably above ARRIVAL_EPSILON so a chosen target can never read as
 * "already arrived" on the very next step. */
const MIN_WANDER_DISTANCE = 0.5;

export function move(world: World, pos: Movable, targetX: number, targetZ: number, speed: number, dt: number): MoveResult {
  let dx = targetX - pos.x;
  let dz = targetZ - pos.z;
  const distanceToTarget = Math.hypot(dx, dz);

  // Already there: hold still and bill the idle rate. Without this, a
  // target at (or within a step of) the creature's own position produced a
  // zero-length steering vector that still reported `moved: true`, so the
  // creature paid the full movement cost to stand on the spot.
  if (distanceToTarget < ARRIVAL_EPSILON) {
    return { x: pos.x, z: pos.z, vx: 0, vz: 0, dir: Math.atan2(dx, dz), moved: false };
  }

  const d = distanceToTarget || 1;
  dx /= d;
  dz /= d;

  for (const o of world.obstacles) {
    const ox = pos.x - o.x;
    const oz = pos.z - o.z;
    const od = Math.hypot(ox, oz);
    if (od < o.r + OBSTACLE_MARGIN && od > 0.01) {
      const push = (o.r + OBSTACLE_MARGIN - od) * OBSTACLE_PUSH;
      dx += (ox / od) * push;
      dz += (oz / od) * push;
    }
  }

  const n = Math.hypot(dx, dz) || 1;
  dx /= n;
  dz /= n;
  const desiredHeading = Math.atan2(dx, dz);
  // Never step past the target — overshooting makes a creature oscillate
  // around a nearby target instead of settling on it.
  const step = Math.min(speed * dt, distanceToTarget);

  const direct = clampToWorld(world, pos.x + dx * step, pos.z + dz * step);
  if (isLegal(world, direct.x, direct.z)) {
    return {
      x: direct.x,
      z: direct.z,
      vx: (direct.x - pos.x) / dt,
      vz: (direct.z - pos.z) / dt,
      dir: desiredHeading,
      moved: direct.x !== pos.x || direct.z !== pos.z,
    };
  }

  let bestHeading: number | null = null;
  let bestDiff = Infinity;
  for (let i = 0; i < CANDIDATE_HEADINGS; i++) {
    const heading = (i / CANDIDATE_HEADINGS) * Math.PI * 2;
    const c = clampToWorld(world, pos.x + Math.sin(heading) * step, pos.z + Math.cos(heading) * step);
    if (!isLegal(world, c.x, c.z)) continue;
    if (c.x === pos.x && c.z === pos.z) continue; // clamped to a no-op
    const diff = angularDistance(heading, desiredHeading);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestHeading = heading;
    }
  }

  if (bestHeading === null) {
    return { x: pos.x, z: pos.z, vx: 0, vz: 0, dir: desiredHeading, moved: false };
  }

  const best = clampToWorld(world, pos.x + Math.sin(bestHeading) * step, pos.z + Math.cos(bestHeading) * step);
  return {
    x: best.x,
    z: best.z,
    vx: (best.x - pos.x) / dt,
    vz: (best.z - pos.z) / dt,
    dir: bestHeading,
    moved: true,
  };
}

/** Sample wander headings outward from the current facing and pick the
 * first legal one — same fallback logic as `move`, for creatures with no
 * active drive target (§6.2's wander case).
 *
 * The offsets sweep the FULL circle, not just the ±90° in front. A
 * half-circle sweep looks reasonable (prefer to keep going roughly
 * forward) but deadlocks: a creature facing a shoreline or map edge finds
 * every forward heading illegal, gets its own position back as the target,
 * which makes `move` report a zero-length step and leave `dir` unchanged —
 * so the next tick samples the same failing arc, forever. Sweeping behind
 * as well means the only way to return self is being genuinely walled in
 * on all sides, which the world generator never produces. */
export function wanderTarget(world: World, pos: Movable, dir: number, reach: number): { x: number; z: number } {
  const stride = (Math.PI * 2) / CANDIDATE_HEADINGS;
  for (let i = 0; i < CANDIDATE_HEADINGS; i++) {
    const heading = dir + (i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2) * stride);
    const c = clampToWorld(world, pos.x + Math.sin(heading) * reach, pos.z + Math.cos(heading) * reach);
    // The clamped candidate has to be somewhere worth walking to. In a map
    // corner every outward heading clamps onto the corner itself, landing
    // a hair from the creature — inside `move`'s arrival epsilon, so it
    // "arrives" instantly and stops. Requiring real separation makes the
    // sweep skip those and keep looking for a heading that points inward.
    if (isLegal(world, c.x, c.z) && Math.hypot(c.x - pos.x, c.z - pos.z) > MIN_WANDER_DISTANCE) return c;
  }
  return { x: pos.x, z: pos.z };
}
