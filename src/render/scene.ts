import * as THREE from 'three';
import type { World } from '../engine/world';

export interface SceneHandles {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  resize: () => void;
  dispose: () => void;
}

/**
 * Static scene setup: ground, lights, water (decoration only — the ellipse
 * in world.ts is the source of truth for collision/drinking, per §5.1),
 * and den markers. Creature meshes are handled per-frame by
 * creatureView.ts, not here.
 */
export function createScene(canvas: HTMLCanvasElement, world: World): SceneHandles {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1416); // --ink token

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  camera.position.set(0, 34, 40);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.1);
  sun.position.set(20, 30, 10);
  scene.add(sun);

  const groundGeom = new THREE.PlaneGeometry(world.half * 2, world.half * 2);
  const ground = new THREE.Mesh(groundGeom, new THREE.MeshPhongMaterial({ color: 0x3a5f3f, flatShading: true }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Unit circle baked flat (XZ plane, facing +Y); scaled per-lake into an
  // ellipse and rotated to match — orientation is a best-effort visual
  // match, not load-bearing, since the mesh is decoration (§5.1).
  const lakeGeom = new THREE.CircleGeometry(1, 40);
  lakeGeom.rotateX(-Math.PI / 2);
  const lakeMat = new THREE.MeshPhongMaterial({ color: 0x2f6f86, transparent: true, opacity: 0.85 });
  for (const lake of world.lakes) {
    const mesh = new THREE.Mesh(lakeGeom, lakeMat);
    mesh.scale.set(lake.rx, 1, lake.rz);
    mesh.rotation.y = -lake.rot;
    mesh.position.set(lake.x, 0.02, lake.z);
    scene.add(mesh);
  }

  const denGeom = new THREE.CylinderGeometry(0.6, 0.7, 0.4, 8);
  const rabbitDenMat = new THREE.MeshPhongMaterial({ color: 0x8a6f4d, flatShading: true });
  const predatorDenMat = new THREE.MeshPhongMaterial({ color: 0x4a2f2a, flatShading: true });
  for (const den of world.dens) {
    const mesh = new THREE.Mesh(denGeom, den.species === 'rabbit' ? rabbitDenMat : predatorDenMat);
    mesh.position.set(den.x, 0.2, den.z);
    scene.add(mesh);
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
    groundGeom.dispose();
    lakeGeom.dispose();
    denGeom.dispose();
    renderer.dispose();
  }

  return { scene, camera, renderer, resize, dispose };
}
