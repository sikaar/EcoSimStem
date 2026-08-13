/**
 * Uniform spatial hash replacing the prototype's O(n²) scan (§6.1). Cell
 * size is ≈ the largest possible sense radius so a 3×3 neighbourhood query
 * is guaranteed to be a superset of anything within sense range. Rebuilt
 * once per step; the caller is expected to keep the staggered per-entity
 * rescan on top — that part is gameplay-neutral and stays in drives.ts.
 */

// Genes.sense tops out at 15 m (§5.3) — this is the hash's cell size, not a
// tuning knob, so it lives here rather than in Tuning.
export const SPATIAL_HASH_CELL_SIZE = 15;

export interface SpatialEntry {
  id: number;
  x: number;
  z: number;
}

export class SpatialHash {
  private readonly cellSize: number;
  private readonly cells = new Map<string, SpatialEntry[]>();

  constructor(cellSize: number = SPATIAL_HASH_CELL_SIZE) {
    this.cellSize = cellSize;
  }

  private cellOf(x: number, z: number): [number, number] {
    return [Math.floor(x / this.cellSize), Math.floor(z / this.cellSize)];
  }

  private static key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  clear(): void {
    this.cells.clear();
  }

  insert(entry: SpatialEntry): void {
    const [cx, cz] = this.cellOf(entry.x, entry.z);
    const k = SpatialHash.key(cx, cz);
    let bucket = this.cells.get(k);
    if (!bucket) {
      bucket = [];
      this.cells.set(k, bucket);
    }
    bucket.push(entry);
  }

  rebuild(entries: readonly SpatialEntry[]): void {
    this.clear();
    for (const entry of entries) this.insert(entry);
  }

  /** Everything in the 3×3 neighbourhood around (x, z) — a superset of
   * anything within `cellSize` of the point. Cheap; callers filter by
   * exact radius themselves when they need it (see `queryRadius`). */
  queryNeighborhood(x: number, z: number): SpatialEntry[] {
    const [cx, cz] = this.cellOf(x, z);
    const out: SpatialEntry[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const bucket = this.cells.get(SpatialHash.key(cx + dx, cz + dz));
        if (bucket) out.push(...bucket);
      }
    }
    return out;
  }

  queryRadius(x: number, z: number, radius: number): SpatialEntry[] {
    const r2 = radius * radius;
    return this.queryNeighborhood(x, z).filter((e) => (e.x - x) ** 2 + (e.z - z) ** 2 <= r2);
  }
}
