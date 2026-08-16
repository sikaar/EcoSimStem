import type { Rng } from './rng';
import type { Tuning } from './types';

/** Half-extent of the play area — 56×56 m, per handover §5.1. */
export const HALF = 28;

export interface Point {
  x: number;
  z: number;
}

/** A rotated ellipse. The ellipse is the source of truth for collision and
 * drinking; any mesh drawn over it is decoration (§5.1). */
export interface Lake {
  x: number;
  z: number;
  rot: number;
  rx: number;
  rz: number;
}

export interface Obstacle {
  x: number;
  z: number;
  r: number;
}

export type DenSpecies = 'rabbit' | 'predator';

export interface Den {
  x: number;
  z: number;
  species: DenSpecies;
}

export interface World {
  half: number;
  lakes: Lake[];
  shore: Point[];
  obstacles: Obstacle[];
  dens: Den[];
}

// Fixed map layout — five identically-sized ellipses at authored positions
// and rotations. Terrain generation is a non-goal (§1); this is not
// re-derived from the seed on every run.
const LAKE_LAYOUT: ReadonlyArray<{ x: number; z: number; rot: number }> = [
  { x: -15, z: -11, rot: 0 },
  { x: -10, z: -8, rot: 0.7 },
  { x: 15, z: 12, rot: 0.35 },
  { x: 17, z: -13, rot: 1.1 },
  { x: -16, z: 13, rot: 0.5 },
];
const LAKE_RX = 4.0;
const LAKE_RZ = 3.4;

function buildLakes(): Lake[] {
  return LAKE_LAYOUT.map((l) => ({ ...l, rx: LAKE_RX, rz: LAKE_RZ }));
}

function toLakeLocal(lake: Lake, x: number, z: number): Point {
  const c = Math.cos(-lake.rot);
  const s = Math.sin(-lake.rot);
  const dx = x - lake.x;
  const dz = z - lake.z;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

function fromLakeLocal(lake: Lake, lx: number, lz: number): Point {
  const c = Math.cos(lake.rot);
  const s = Math.sin(lake.rot);
  return { x: lake.x + lx * c - lz * s, z: lake.z + lx * s + lz * c };
}

/** True if (x, z) is inside any lake, optionally inflated by `pad`. */
export function isInWater(world: World, x: number, z: number, pad = 0): boolean {
  for (const lake of world.lakes) {
    const local = toLakeLocal(lake, x, z);
    const rx = lake.rx + pad;
    const rz = lake.rz + pad;
    if ((local.x * local.x) / (rx * rx) + (local.z * local.z) / (rz * rz) <= 1) return true;
  }
  return false;
}

const SHORE_SAMPLES_PER_LAKE = 14;
const SHORE_OFFSET = 0.9;
const SHORE_CLEARANCE = 0.15;

function buildShore(world: World): Point[] {
  const shore: Point[] = [];
  for (const lake of world.lakes) {
    for (let i = 0; i < SHORE_SAMPLES_PER_LAKE; i++) {
      const t = (i / SHORE_SAMPLES_PER_LAKE) * Math.PI * 2;
      const lx = Math.cos(t) * (lake.rx + SHORE_OFFSET);
      const lz = Math.sin(t) * (lake.rz + SHORE_OFFSET);
      const p = fromLakeLocal(lake, lx, lz);
      if (Math.abs(p.x) < world.half && Math.abs(p.z) < world.half && !isInWater(world, p.x, p.z, SHORE_CLEARANCE)) {
        shore.push(p);
      }
    }
  }
  return shore;
}

// Nearest drinkable point is computed analytically — project onto the
// ellipse boundary along the direction from the lake centre, then push out
// 1.14× so the point lands on dry land rather than exactly on the edge
// (§5.1, §0.3 item 2). This is the load-bearing fix for the sampled-marker
// version, which let rabbits stand between markers and never drink.
const DRINK_PUSHOUT = 1.14;

export function nearestWaterPoint(world: World, x: number, z: number, range: number): Point | null {
  let best: Point | null = null;
  let bestDistSq = range * range;
  for (const lake of world.lakes) {
    const local = toLakeLocal(lake, x, z);
    const k = Math.hypot(local.x / lake.rx, local.z / lake.rz) || 1e-6;
    const lx = (local.x / k) * DRINK_PUSHOUT;
    const lz = (local.z / k) * DRINK_PUSHOUT;
    const p = fromLakeLocal(lake, lx, lz);
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestDistSq) {
      bestDistSq = d;
      best = p;
    }
  }
  return best;
}

/** Sample a random land point clear of water and existing obstacles. Falls
 * back to a small central patch if 80 attempts all fail. */
export function landPoint(world: World, rng: Rng, minEdge = 1.6): Point {
  for (let i = 0; i < 80; i++) {
    const x = rng.range(-world.half + 1, world.half - 1);
    const z = rng.range(-world.half + 1, world.half - 1);
    if (isInWater(world, x, z, minEdge)) continue;
    let blocked = false;
    for (const o of world.obstacles) {
      if ((o.x - x) ** 2 + (o.z - z) ** 2 < o.r * o.r) {
        blocked = true;
        break;
      }
    }
    if (!blocked) return { x, z };
  }
  return { x: rng.range(-8, 8), z: rng.range(-8, 8) };
}

// Only collision-relevant props become obstacles — decorative-only scatter
// (grass, small rocks, reeds) is a render-layer concern, not an engine one.
const TREE_SPEC: ReadonlyArray<readonly [count: number, radius: number]> = [
  [13, 1.1],
  [9, 0.7],
  [7, 1.3],
];
const ROCK_SPEC: ReadonlyArray<readonly [count: number, radius: number]> = [
  [5, 1.2], // boulders
  [8, 0.6], // medium rocks
  [4, 1.1], // fallen logs
];

function generateObstacles(world: World, rng: Rng): void {
  for (const [count, r] of TREE_SPEC) {
    for (let i = 0; i < count; i++) {
      const p = landPoint(world, rng, 2.5);
      world.obstacles.push({ x: p.x, z: p.z, r });
    }
  }
  for (const [count, r] of ROCK_SPEC) {
    for (let i = 0; i < count; i++) {
      const p = landPoint(world, rng, 2);
      world.obstacles.push({ x: p.x, z: p.z, r });
    }
  }
}

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.z - b.z);

const RABBIT_DEN_MIN_SPACING = 8;
const DEN_WATER_CLEARANCE = 3;
const DEN_PLACEMENT_ATTEMPTS = 200;
/** How far a predator den must stay from the world edge. "Maximise
 * distance from the rabbit dens" is the right instinct — a predator should
 * not live on the prey's doorstep — but taken literally on a square map it
 * has exactly one answer: the corners. A predator that dens in a corner
 * returns there every dusk, wanders out from there every dawn, and hunts a
 * quadrant the rabbits have no reason to enter. Reserving a margin keeps
 * the "far from prey" rule while leaving the den inside the map the game
 * is actually played on. */
const PREDATOR_DEN_EDGE_CLEARANCE = 6;

/** 6 rabbit dens (min 8 m apart, never within 3 m of water) and 2 predator
 * dens (placed to maximise distance from the rabbit-den cluster, without
 * ending up in a corner) — §5.2. */
export function generateDens(
  world: World,
  rng: Rng,
  tuning: Pick<Tuning, 'rabbitDens' | 'predatorDens'>,
): Den[] {
  const dens: Den[] = [];

  for (let i = 0; i < tuning.rabbitDens; i++) {
    let placed: Point | null = null;
    for (let attempt = 0; attempt < DEN_PLACEMENT_ATTEMPTS && !placed; attempt++) {
      const p = landPoint(world, rng, DEN_WATER_CLEARANCE);
      const tooClose = dens.some((d) => dist(d, p) < RABBIT_DEN_MIN_SPACING);
      if (!tooClose) placed = p;
    }
    // If spacing can't be satisfied after many attempts, place anyway
    // rather than silently under-populating the den count.
    dens.push({ ...(placed ?? landPoint(world, rng, DEN_WATER_CLEARANCE)), species: 'rabbit' });
  }

  const rabbitDens = dens.filter((d) => d.species === 'rabbit');
  for (let i = 0; i < tuning.predatorDens; i++) {
    let best: Point | null = null;
    let bestMinDist = -Infinity;
    for (let attempt = 0; attempt < DEN_PLACEMENT_ATTEMPTS; attempt++) {
      const p = landPoint(world, rng, 1.6);
      if (Math.abs(p.x) > world.half - PREDATOR_DEN_EDGE_CLEARANCE) continue;
      if (Math.abs(p.z) > world.half - PREDATOR_DEN_EDGE_CLEARANCE) continue;
      const others = [...rabbitDens, ...dens.filter((d) => d.species === 'predator')];
      const minDist = others.length === 0 ? Infinity : Math.min(...others.map((d) => dist(d, p)));
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        best = p;
      }
    }
    if (best) dens.push({ ...best, species: 'predator' });
  }

  return dens;
}

export function distanceToNearestOwnDen(pos: Point, dens: readonly Den[], species: DenSpecies): number {
  let best = Infinity;
  for (const d of dens) {
    if (d.species !== species) continue;
    const dd = dist(d, pos);
    if (dd < best) best = dd;
  }
  return best;
}

/** The actual nearest own-species den, not just its distance — used to
 * supply the RETURN drive's target (§6.2). A den is always "known," unlike
 * food/water/mates, so this ignores sense range. */
export function nearestOwnDen(pos: Point, dens: readonly Den[], species: DenSpecies): Den | null {
  let best: Den | null = null;
  let bestDist = Infinity;
  for (const d of dens) {
    if (d.species !== species) continue;
    const dd = dist(d, pos);
    if (dd < bestDist) {
      bestDist = dd;
      best = d;
    }
  }
  return best;
}

export function isHome(pos: Point, dens: readonly Den[], species: DenSpecies, denRadius: number): boolean {
  return distanceToNearestOwnDen(pos, dens, species) <= denRadius;
}

export function generateWorld(rng: Rng, tuning: Pick<Tuning, 'rabbitDens' | 'predatorDens'>): World {
  const world: World = { half: HALF, lakes: buildLakes(), shore: [], obstacles: [], dens: [] };
  world.shore = buildShore(world);
  generateObstacles(world, rng);
  world.dens = generateDens(world, rng, tuning);
  return world;
}
