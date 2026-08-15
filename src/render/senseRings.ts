import * as THREE from 'three';

/**
 * Debug/observation aid ported from the V1 prototype: a thin ring around
 * each rabbit sized to its sense gene, toggled on demand rather than always
 * drawn (dozens of overlapping circles is noise, not signal, most of the
 * time). One shared geometry/material pair, one Line instance per rabbit
 * pulled from a reusable pool — same "share geometry and materials"
 * pattern as creatureView.ts's EntityLayer, just with THREE.Line instead
 * of Mesh since a ring is an outline, not a filled shape.
 */
export interface SenseRingEntity {
  x: number;
  z: number;
  genes: { sense: number };
}

// A large population makes 100+ overlapping rings unreadable noise rather
// than useful signal — matches the V1 prototype's own cap.
const MAX_RINGS = 60;

export interface SenseRings {
  update(rabbits: readonly SenseRingEntity[], visible: boolean): void;
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
  const ringMat = new THREE.LineBasicMaterial({ color: 0x63b3c4, transparent: true, opacity: 0.28 });

  const pool: THREE.LineLoop[] = [];

  function update(rabbits: readonly SenseRingEntity[], visible: boolean): void {
    group.visible = visible;
    if (!visible) return;

    const count = Math.min(rabbits.length, MAX_RINGS);
    while (pool.length < count) {
      const line = new THREE.LineLoop(ringGeom, ringMat);
      pool.push(line);
      group.add(line);
    }
    for (let i = 0; i < pool.length; i++) {
      const line = pool[i]!;
      if (i < count) {
        const r = rabbits[i]!;
        line.visible = true;
        line.position.set(r.x, 0.05, r.z);
        line.scale.setScalar(r.genes.sense);
      } else {
        line.visible = false;
      }
    }
  }

  function dispose(): void {
    scene.remove(group);
    ringGeom.dispose();
    ringMat.dispose();
  }

  return { update, dispose };
}
