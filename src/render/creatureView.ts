import * as THREE from 'three';
import { loadPolyforkAsset, loadWalkRuntime, type WalkGait } from './polyforkAssets';

/**
 * EntityLayer starts every species on a procedural placeholder mesh — the
 * no-credential default (§11.3) with zero network dependency, so first
 * paint never waits on a fetch. createCreatureLayers below kicks off the
 * real Polyfork loads in the background and swaps each species onto its
 * model (§11.2) the moment that species' GLB is parsed; a run that starts
 * before the swap lands just sees the boxes replaced under it, same as
 * any other position/rotation update on the next sync().
 *
 * Render reads entity transforms straight off the live sim each frame
 * (§4.1) — this class doesn't touch simStore at all.
 */

export interface PositionedEntity {
  id: number;
  x: number;
  z: number;
  dir?: number;
}

interface Instance {
  obj: THREE.Object3D;
  gait: WalkGait | null;
  distance: number;
  lastX: number;
  lastZ: number;
}

export class EntityLayer<T extends PositionedEntity> {
  private readonly instances = new Map<number, Instance>();
  private factory: () => THREE.Object3D;
  private yOffset: number;
  private createGait: ((obj: THREE.Object3D) => WalkGait | null) | null;

  constructor(
    private readonly scene: THREE.Scene,
    factory: () => THREE.Object3D,
    yOffset: number = 0,
    createGait: ((obj: THREE.Object3D) => WalkGait | null) | null = null,
  ) {
    this.factory = factory;
    this.yOffset = yOffset;
    this.createGait = createGait;
  }

  /** Swap onto a new factory (e.g. a loaded Polyfork model replacing the
   * procedural box). Every currently-live instance is dropped so the next
   * sync() rebuilds the whole layer on the new factory — a run never shows
   * a mix of boxes and models for the same species. Polyfork models are
   * already grounded (minY=0 per their metadata), hence the 0 default —
   * only the procedural placeholders need a yOffset to sit flush on the
   * ground plane.
   *
   * `createGait`, when given, builds a per-instance walk.mjs IK solver
   * (§11.2) for a rigged model — one per clone, since each has its own
   * bone hierarchy. Left null for species with no rig (plants) or when the
   * gait runtime failed to load, in which case the model still shows, just
   * unanimated — better than falling all the way back to the box. */
  setFactory(
    factory: () => THREE.Object3D,
    yOffset: number = 0,
    createGait: ((obj: THREE.Object3D) => WalkGait | null) | null = null,
  ): void {
    this.factory = factory;
    this.yOffset = yOffset;
    this.createGait = createGait;
    for (const { obj } of this.instances.values()) this.scene.remove(obj);
    this.instances.clear();
  }

  sync(entities: readonly T[]): void {
    const seen = new Set<number>();
    for (const entity of entities) {
      seen.add(entity.id);
      let inst = this.instances.get(entity.id);
      if (!inst) {
        const obj = this.factory();
        // Placed and oriented BEFORE the gait is built. walk.mjs's walker()
        // is handed a ground raycast query and plants feet against the
        // world under the model, so building it while the clone still sits
        // at the scene origin fits the rig to the wrong patch of world —
        // every creature gets a gait measured at (0,0) no matter where it
        // actually spawned.
        obj.position.set(entity.x, this.yOffset, entity.z);
        if (entity.dir !== undefined) obj.rotation.y = entity.dir;
        obj.updateMatrixWorld(true);
        this.scene.add(obj);
        // lastX/lastZ start at the spawn position, not the origin — a
        // fresh instance's first sync() must not register a fake "distance
        // travelled" burst from (0,0) to wherever the entity actually is.
        inst = { obj, gait: this.createGait?.(obj) ?? null, distance: 0, lastX: entity.x, lastZ: entity.z };
        this.instances.set(entity.id, inst);
      }
      const dx = entity.x - inst.lastX;
      const dz = entity.z - inst.lastZ;
      inst.lastX = entity.x;
      inst.lastZ = entity.z;
      if (entity.dir !== undefined) inst.obj.rotation.y = entity.dir;
      inst.obj.position.set(entity.x, this.yOffset, entity.z);

      if (inst.gait) {
        // poseAt wants cumulative distance, not a per-frame delta (§11.2:
        // "phase from distance travelled, not from time") — a creature
        // standing still (dx=dz=0) correctly holds its last pose instead
        // of animating in place.
        inst.distance += Math.hypot(dx, dz);
        inst.gait.poseAt(inst.distance);
        // The ground-plane position is then re-asserted, and that ordering
        // is the fix for a model rendering somewhere other than where the
        // simulation says the creature is. A gait solver poses limbs, but
        // it works on the object it was handed and is free to move that
        // object's root — shifting it to stop feet skating, or lifting it
        // to keep them planted. The simulation owns where a creature
        // stands, so x and z are written last and win. Height is
        // deliberately NOT overwritten: on sloped or uneven ground the
        // solver's y is the whole point of giving it a ground query, and
        // stamping yOffset back over it would push the feet through the
        // floor.
        inst.obj.position.x = entity.x;
        inst.obj.position.z = entity.z;
      }
    }
    for (const [id, inst] of this.instances) {
      if (seen.has(id)) continue;
      this.scene.remove(inst.obj);
      this.instances.delete(id);
    }
  }

  /** The live object for one entity id, or null if it has none. Exists for
   * placement tests — nothing in the app reads instances back out. */
  objectFor(id: number): THREE.Object3D | null {
    return this.instances.get(id)?.obj ?? null;
  }

  dispose(): void {
    for (const { obj } of this.instances.values()) this.scene.remove(obj);
    this.instances.clear();
  }
}

export interface CreatureLayers {
  rabbits: EntityLayer<PositionedEntity>;
  predators: EntityLayer<PositionedEntity>;
  plants: EntityLayer<PositionedEntity>;
  dispose: () => void;
}

// Same kit (nature-forest-kit-f29d6a) for all three, so palette and
// real-world scale agree with each other and with the den/lake markers in
// scene.ts. Rabbit and grass tuft are free tier; the fox is Pro — gated
// server-side on POLYFORK_PRO_TOKEN (api/asset/[id].ts), never a
// client-supplied credential.
const RABBIT_ASSET = { id: 'forest-rabbit-ea2da0', tier: 'free' } as const;
const PREDATOR_ASSET = { id: 'red-fox-5c3bc0', tier: 'pro' } as const;
const PLANT_ASSET = { id: 'grass-tuft-a40a08', tier: 'free' } as const;

export function createCreatureLayers(scene: THREE.Scene, ground: THREE.Object3D): CreatureLayers {
  const rabbitGeom = new THREE.BoxGeometry(0.5, 0.4, 0.7);
  const rabbitMat = new THREE.MeshPhongMaterial({ color: 0xc2a479, flatShading: true });
  const predatorGeom = new THREE.BoxGeometry(0.6, 0.5, 1.0);
  const predatorMat = new THREE.MeshPhongMaterial({ color: 0xc94f3d, flatShading: true });
  const plantGeom = new THREE.ConeGeometry(0.18, 0.4, 6);
  const plantMat = new THREE.MeshPhongMaterial({ color: 0x77b258, flatShading: true });

  const rabbits = new EntityLayer<PositionedEntity>(scene, () => new THREE.Mesh(rabbitGeom, rabbitMat), 0.25);
  const predators = new EntityLayer<PositionedEntity>(scene, () => new THREE.Mesh(predatorGeom, predatorMat), 0.3);
  const plants = new EntityLayer<PositionedEntity>(scene, () => new THREE.Mesh(plantGeom, plantMat), 0.2);

  // Real-world scale (§11's "never rescale to fake a fit"): these models
  // are placed at the size Polyfork authored them, matching the metres
  // convention the rest of the sim already uses (sense/speed tuning is in
  // m / m/s). Mesh.clone(true) shares geometry/material across instances
  // by default — the same "share geometry and materials" rule the
  // procedural boxes above already follow.
  //
  // Walk-cycle IK (§11.2): rabbit and fox are both `has_ik: "legs"` rigs
  // with a `gait` block, but neither downloaded GLB carries a baked
  // animation clip (confirmed against the actual bytes, not just the
  // asset listing) — walk.mjs's distance-driven poseAt() is the real path,
  // not a fallback. The ground is a single flat plane for the whole world
  // (scene.ts), so one raycastGround() covers every instance of every
  // species; only the per-instance walker() call needs to be per-clone.
  const walkRuntimePromise = loadWalkRuntime();

  function wireAnimatedSpecies(layer: EntityLayer<PositionedEntity>, asset: { id: string; tier: 'free' | 'pro' }): void {
    void Promise.all([loadPolyforkAsset(asset.id, asset.tier), walkRuntimePromise]).then(([template, walk]) => {
      if (!template) return;
      if (!walk) {
        layer.setFactory(() => template.clone(true));
        return;
      }
      const groundQuery = walk.raycastGround([ground]);
      layer.setFactory(
        () => template.clone(true),
        0,
        (obj) => walk.walker(obj, { ground: groundQuery }),
      );
    });
  }

  wireAnimatedSpecies(rabbits, RABBIT_ASSET);
  wireAnimatedSpecies(predators, PREDATOR_ASSET);
  void loadPolyforkAsset(PLANT_ASSET.id, PLANT_ASSET.tier).then((template) => {
    if (template) plants.setFactory(() => template.clone(true));
  });

  return {
    rabbits,
    predators,
    plants,
    dispose: () => {
      rabbits.dispose();
      predators.dispose();
      plants.dispose();
      rabbitGeom.dispose();
      rabbitMat.dispose();
      predatorGeom.dispose();
      predatorMat.dispose();
      plantGeom.dispose();
      plantMat.dispose();
    },
  };
}
