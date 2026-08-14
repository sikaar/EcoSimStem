import * as THREE from 'three';
import { GENE_RANGE } from '../engine/types';
import { GENE_HISTORY_LIMIT } from '../store/simStore';

/**
 * The 3D scatter from §9.2: one point per rabbit on sense × speed × urge,
 * rotatable, with a faint trail of previous days' centroids showing drift
 * direction. Colour is age (young→bright, old→dim) — lineage tinting needs
 * founder-tracking that doesn't exist yet (§9.3).
 *
 * Separate small scene/renderer from the main one — this is cheap (a
 * couple hundred points, one line) and keeping it isolated means it
 * doesn't complicate the main scene's camera/lighting.
 */

const MAX_POINTS = 200; // matches DEFAULT_TUNING.capRabbits

export interface RabbitLike {
  genes: { sense: number; speed: number; urge: number };
  ageDays: number;
  lifespanDays: number;
}

export interface CentroidLike {
  sense: number;
  speed: number;
  urge: number;
}

export interface TraitCloudHandles {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  updatePoints: (rabbits: readonly RabbitLike[]) => void;
  updateTrail: (history: readonly CentroidLike[]) => void;
  resize: () => void;
  dispose: () => void;
}

function normalize(value: number, key: 'sense' | 'speed' | 'urge'): number {
  const [lo, hi] = GENE_RANGE[key];
  return ((value - lo) / (hi - lo)) * 2 - 1; // -1..1, centered cube
}

export function createTraitCloud(canvas: HTMLCanvasElement): TraitCloudHandles {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
  camera.position.set(1.9, 1.5, 1.9);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const cubeGeom = new THREE.BoxGeometry(2, 2, 2);
  const edgesGeom = new THREE.EdgesGeometry(cubeGeom);
  cubeGeom.dispose();
  const wireMat = new THREE.LineBasicMaterial({ color: 0x2f6f86, transparent: true, opacity: 0.35 });
  const wireframe = new THREE.LineSegments(edgesGeom, wireMat);
  scene.add(wireframe);

  scene.add(new THREE.AmbientLight(0xffffff, 1));

  const positions = new Float32Array(MAX_POINTS * 3);
  const pointColors = new Float32Array(MAX_POINTS * 3);
  const pointsGeom = new THREE.BufferGeometry();
  pointsGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pointsGeom.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));
  pointsGeom.setDrawRange(0, 0);
  const pointsMat = new THREE.PointsMaterial({ size: 0.07, vertexColors: true, sizeAttenuation: true });
  const points = new THREE.Points(pointsGeom, pointsMat);
  scene.add(points);

  const youngColor = new THREE.Color(0x9fd8dd);
  const oldColor = new THREE.Color(0x2f6f86);
  const tmpColor = new THREE.Color();

  function updatePoints(rabbits: readonly RabbitLike[]): void {
    const count = Math.min(rabbits.length, MAX_POINTS);
    for (let i = 0; i < count; i++) {
      const r = rabbits[i]!;
      positions[i * 3] = normalize(r.genes.sense, 'sense');
      positions[i * 3 + 1] = normalize(r.genes.speed, 'speed');
      positions[i * 3 + 2] = normalize(r.genes.urge, 'urge');

      const ageFrac = r.lifespanDays > 0 ? Math.min(1, r.ageDays / r.lifespanDays) : 0;
      tmpColor.copy(youngColor).lerp(oldColor, ageFrac);
      pointColors[i * 3] = tmpColor.r;
      pointColors[i * 3 + 1] = tmpColor.g;
      pointColors[i * 3 + 2] = tmpColor.b;
    }
    pointsGeom.setDrawRange(0, count);
    pointsGeom.attributes.position!.needsUpdate = true;
    pointsGeom.attributes.color!.needsUpdate = true;
  }

  const trailPositions = new Float32Array(GENE_HISTORY_LIMIT * 3);
  const trailGeom = new THREE.BufferGeometry();
  trailGeom.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  trailGeom.setDrawRange(0, 0);
  const trailMat = new THREE.LineBasicMaterial({ color: 0xf0c05a, transparent: true, opacity: 0.55 });
  const trail = new THREE.Line(trailGeom, trailMat);
  scene.add(trail);

  function updateTrail(history: readonly CentroidLike[]): void {
    const count = Math.min(history.length, GENE_HISTORY_LIMIT);
    for (let i = 0; i < count; i++) {
      const h = history[i]!;
      trailPositions[i * 3] = normalize(h.sense, 'sense');
      trailPositions[i * 3 + 1] = normalize(h.speed, 'speed');
      trailPositions[i * 3 + 2] = normalize(h.urge, 'urge');
    }
    trailGeom.setDrawRange(0, count);
    trailGeom.attributes.position!.needsUpdate = true;
  }

  function resize(): void {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight, false);
  }
  resize();

  function dispose(): void {
    edgesGeom.dispose();
    wireMat.dispose();
    pointsGeom.dispose();
    pointsMat.dispose();
    trailGeom.dispose();
    trailMat.dispose();
    renderer.dispose();
  }

  return { scene, camera, renderer, updatePoints, updateTrail, resize, dispose };
}
