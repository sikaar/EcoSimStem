import type { PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Camera orbit, scoped to the canvas element passed in. Three.js's
 * OrbitControls uses pointer capture on that element for drag continuation,
 * which is what keeps it canvas-scoped rather than window-scoped (§10.1) —
 * a window-scoped drag listener is what let a slider drag hijack the
 * camera in the prototype.
 */
export interface OrbitControlsOptions {
  minDistance?: number;
  maxDistance?: number;
  maxPolarAngle?: number;
  enablePan?: boolean;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
}

export function createOrbitControls(
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  options: OrbitControlsOptions = {},
): OrbitControls {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = options.minDistance ?? 8;
  controls.maxDistance = options.maxDistance ?? 90;
  controls.maxPolarAngle = options.maxPolarAngle ?? Math.PI * 0.49; // stop just short of the horizon
  controls.enablePan = options.enablePan ?? true;
  controls.autoRotate = options.autoRotate ?? false;
  controls.autoRotateSpeed = options.autoRotateSpeed ?? 2;
  controls.target.set(0, 0, 0);
  return controls;
}
