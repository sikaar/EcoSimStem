import * as THREE from 'three';

/**
 * Debug/observation aid ported from the V1 prototype: a thin ring around
 * each creature sized to its perception radius, toggled on demand rather
 * than always drawn (dozens of overlapping circles is noise, not signal,
 * most of the time). One shared geometry per species-coloured material,
 * one Line instance per creature pulled from a reusable pool — same
 * "share geometry and materials" pattern as creatureView.ts's EntityLayer,
 * just with THREE.Line instead of Mesh since a ring is an outline, not a
 * filled shape.
 *
 * Predators get a ring too, in their own colour. They are the hardest
 * thing on the map to find — one or two of them among fifty rabbits, at
 * the scale the default camera sits at — and their ring is the only thing
 * that shows the radius inside which they can actually see prey, which is
 * the number the whole predator half of the tuning panel is about.
 */
export interface SenseRingEntity {
  x: number;
  z: number;
  genes: { sense: number };
}

export interface PositionedEntity {
  x: number;
  z: number;
}

// A large population makes 100+ overlapping rings unreadable noise rather
// than useful signal — matches the V1 prototype's own cap.
const MAX_RINGS = 60;

export interface SenseRings {
  /** `predatorSense` is a tuning global rather than a per-creature gene
   * (see entities/predator.ts), so it is passed in once instead of read
   * off each predator. */
  update(
    rabbits: readonly SenseRingEntity[],
    predators: readonly PositionedEntity[],
    predatorSense: number,
    visible: boolean,
  ): void;
  dispose(): void;
}

export function createSenseRings(scene: THREE.Scene): SenseRings {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(t), 0, Math.sin(t)));
  }
  const ringGeom = new THREE.BufferGeometry().setFromPoints(points);
  const rabbitMat = new THREE.LineBasicMaterial({ color: 0x63b3c4, transparent: true, opacity: 0.28 });
  // --fox, and less transparent than the rabbits': there are only ever a
  // handful of these and they are the ones worth spotting.
  const predatorMat = new THREE.LineBasicMaterial({ color: 0xc94f3d, transparent: true, opacity: 0.5 });

  const rabbitPool: THREE.LineLoop[] = [];
  const predatorPool: THREE.LineLoop[] = [];

  function syncPool(
    pool: THREE.LineLoop[],
    material: THREE.LineBasicMaterial,
    entities: readonly PositionedEntity[],
    radiusOf: (index: number) => number,
  ): void {
    const count = Math.min(entities.length, MAX_RINGS);
    while (pool.length < count) {
      const line = new THREE.LineLoop(ringGeom, material);
      pool.push(line);
      group.add(line);
    }
    for (let i = 0; i < pool.length; i++) {
      const line = pool[i]!;
      if (i < count) {
        const e = entities[i]!;
        line.visible = true;
        line.position.set(e.x, 0.05, e.z);
        line.scale.setScalar(radiusOf(i));
      } else {
        line.visible = false;
      }
    }
  }

  function update(
    rabbits: readonly SenseRingEntity[],
    predators: readonly PositionedEntity[],
    predatorSense: number,
    visible: boolean,
  ): void {
    group.visible = visible;
    if (!visible) return;
    syncPool(rabbitPool, rabbitMat, rabbits, (i) => rabbits[i]!.genes.sense);
    syncPool(predatorPool, predatorMat, predators, () => predatorSense);
  }

  function dispose(): void {
    scene.remove(group);
    ringGeom.dispose();
    rabbitMat.dispose();
    predatorMat.dispose();
  }

  return { update, dispose };
}
