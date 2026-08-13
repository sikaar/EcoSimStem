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
  /** False only when all candidate headings were illegal this step. */
  moved: boolean;
}

const OBSTACLE_MARGIN = 1.1;
const OBSTACLE_PUSH = 0.9;
const WATER_REJECT_PAD = 0.25;
const CANDIDATE_HEADINGS = 8;

function isLegal(world: World, x: number, z: number): boolean {
  return !isInWater(world, x, z, WATER_REJECT_PAD) && Math.abs(x) <= world.half && Math.abs(z) <= world.half;
}

function angularDistance(a: number, b: number): number {
  const twoPi = Math.PI * 2;
  let diff = Math.abs(a - b) % twoPi;
  if (diff > Math.PI) diff = twoPi - diff;
  return diff;
}

export function move(world: World, pos: Movable, targetX: number, targetZ: number, speed: number, dt: number): MoveResult {
  let dx = targetX - pos.x;
  let dz = targetZ - pos.z;
  const d = Math.hypot(dx, dz) || 1;
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
  const step = speed * dt;

  const nx = pos.x + dx * step;
  const nz = pos.z + dz * step;
  if (isLegal(world, nx, nz)) {
    return { x: nx, z: nz, vx: (nx - pos.x) / dt, vz: (nz - pos.z) / dt, dir: desiredHeading, moved: true };
  }

  let bestHeading: number | null = null;
  let bestDiff = Infinity;
  for (let i = 0; i < CANDIDATE_HEADINGS; i++) {
    const heading = (i / CANDIDATE_HEADINGS) * Math.PI * 2;
    const cx = pos.x + Math.sin(heading) * step;
    const cz = pos.z + Math.cos(heading) * step;
    if (!isLegal(world, cx, cz)) continue;
    const diff = angularDistance(heading, desiredHeading);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestHeading = heading;
    }
  }

  if (bestHeading === null) {
    return { x: pos.x, z: pos.z, vx: 0, vz: 0, dir: desiredHeading, moved: false };
  }

  const bx = pos.x + Math.sin(bestHeading) * step;
  const bz = pos.z + Math.cos(bestHeading) * step;
  return { x: bx, z: bz, vx: (bx - pos.x) / dt, vz: (bz - pos.z) / dt, dir: bestHeading, moved: true };
}

/** Sample up to 8 wander headings and pick a legal one nearest the current
 * facing — same fallback logic as `move`, for creatures with no active
 * drive target (§6.2's wander case). */
export function wanderTarget(world: World, pos: Movable, dir: number, reach: number): { x: number; z: number } {
  for (let i = 0; i < CANDIDATE_HEADINGS; i++) {
    const heading = dir + (i === 0 ? 0 : ((i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2) * Math.PI) / CANDIDATE_HEADINGS);
    const x = pos.x + Math.sin(heading) * reach;
    const z = pos.z + Math.cos(heading) * reach;
    if (isLegal(world, x, z)) return { x, z };
  }
  return { x: pos.x, z: pos.z };
}
