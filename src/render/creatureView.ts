import * as THREE from 'three';
import { loadPolyforkAsset } from './polyforkAssets';

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

export class EntityLayer<T extends PositionedEntity> {
  private readonly instances = new Map<number, THREE.Object3D>();
  private factory: () => THREE.Object3D;
  private yOffset: number;

  constructor(private readonly scene: THREE.Scene, factory: () => THREE.Object3D, yOffset: number = 0) {
    this.factory = factory;
    this.yOffset = yOffset;
  }

  /** Swap onto a new factory (e.g. a loaded Polyfork model replacing the
   * procedural box). Every currently-live instance is dropped so the next
   * sync() rebuilds the whole layer on the new factory — a run never shows
   * a mix of boxes and models for the same species. Polyfork models are
   * already grounded (minY=0 per their metadata), hence the 0 default —
   * only the procedural placeholders need a yOffset to sit flush on the
   * ground plane. */
  setFactory(factory: () => THREE.Object3D, yOffset: number = 0): void {
    this.factory = factory;
    this.yOffset = yOffset;
    for (const obj of this.instances.values()) this.scene.remove(obj);
    this.instances.clear();
  }

  sync(entities: readonly T[]): void {
    const seen = new Set<number>();
    for (const entity of entities) {
      seen.add(entity.id);
      let obj = this.instances.get(entity.id);
      if (!obj) {
        obj = this.factory();
        this.scene.add(obj);
        this.instances.set(entity.id, obj);
      }
      obj.position.set(entity.x, this.yOffset, entity.z);
      if (entity.dir !== undefined) obj.rotation.y = entity.dir;
    }
    for (const [id, obj] of this.instances) {
      if (seen.has(id)) continue;
      this.scene.remove(obj);
      this.instances.delete(id);
    }
  }

  dispose(): void {
    for (const obj of this.instances.values()) this.scene.remove(obj);
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

export function createCreatureLayers(scene: THREE.Scene): CreatureLayers {
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
  void loadPolyforkAsset(RABBIT_ASSET.id, RABBIT_ASSET.tier).then((template) => {
    if (template) rabbits.setFactory(() => template.clone(true));
  });
  void loadPolyforkAsset(PREDATOR_ASSET.id, PREDATOR_ASSET.tier).then((template) => {
    if (template) predators.setFactory(() => template.clone(true));
  });
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
