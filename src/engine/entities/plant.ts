import { landPoint, type World } from '../world';
import type { Rng } from '../rng';

export interface Plant {
  id: number;
  x: number;
  z: number;
  alive: boolean;
  respawnDaysLeft: number;
}

const PLANT_LAND_CLEARANCE = 1.4;

export function spawnPlant(id: number, world: World, rng: Rng): Plant {
  const p = landPoint(world, rng, PLANT_LAND_CLEARANCE);
  return { id, x: p.x, z: p.z, alive: true, respawnDaysLeft: 0 };
}

/** Move a depleted plant to a fresh land point and revive it in place —
 * mirrors the prototype's respawn-by-relocation rather than a fixed plot. */
export function respawnPlant(plant: Plant, world: World, rng: Rng): void {
  const p = landPoint(world, rng, PLANT_LAND_CLEARANCE);
  plant.x = p.x;
  plant.z = p.z;
  plant.alive = true;
  plant.respawnDaysLeft = 0;
}
