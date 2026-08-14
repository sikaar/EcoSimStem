import * as THREE from 'three';

/**
 * Procedural placeholder meshes — the no-credential default (§11.3), and
 * what real Polyfork rigs will eventually replace per creature. Geometry
 * and material are shared across every instance of a species (§11.3:
 * "share geometry and materials"); only position/rotation vary per mesh.
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
  private readonly meshes = new Map<number, THREE.Mesh>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly geometry: THREE.BufferGeometry,
    private readonly material: THREE.Material,
    private readonly yOffset: number = 0,
  ) {}

  sync(entities: readonly T[]): void {
    const seen = new Set<number>();
    for (const entity of entities) {
      seen.add(entity.id);
      let mesh = this.meshes.get(entity.id);
      if (!mesh) {
        mesh = new THREE.Mesh(this.geometry, this.material);
        this.scene.add(mesh);
        this.meshes.set(entity.id, mesh);
      }
      mesh.position.set(entity.x, this.yOffset, entity.z);
      if (entity.dir !== undefined) mesh.rotation.y = entity.dir;
    }
    for (const [id, mesh] of this.meshes) {
      if (seen.has(id)) continue;
      this.scene.remove(mesh);
      this.meshes.delete(id);
    }
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) this.scene.remove(mesh);
    this.meshes.clear();
  }
}

export interface CreatureLayers {
  rabbits: EntityLayer<PositionedEntity>;
  predators: EntityLayer<PositionedEntity>;
  plants: EntityLayer<PositionedEntity>;
  dispose: () => void;
}

export function createCreatureLayers(scene: THREE.Scene): CreatureLayers {
  const rabbitGeom = new THREE.BoxGeometry(0.5, 0.4, 0.7);
  const rabbitMat = new THREE.MeshPhongMaterial({ color: 0xc2a479, flatShading: true });
  const predatorGeom = new THREE.BoxGeometry(0.6, 0.5, 1.0);
  const predatorMat = new THREE.MeshPhongMaterial({ color: 0xc94f3d, flatShading: true });
  const plantGeom = new THREE.ConeGeometry(0.18, 0.4, 6);
  const plantMat = new THREE.MeshPhongMaterial({ color: 0x77b258, flatShading: true });

  const rabbits = new EntityLayer<PositionedEntity>(scene, rabbitGeom, rabbitMat, 0.25);
  const predators = new EntityLayer<PositionedEntity>(scene, predatorGeom, predatorMat, 0.3);
  const plants = new EntityLayer<PositionedEntity>(scene, plantGeom, plantMat, 0.2);

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
