import type { PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Camera orbit, scoped to the canvas element passed in. Three.js's
 * OrbitControls uses pointer capture on that element for drag continuation,
 * which is what keeps it canvas-scoped rather than window-scoped (§10.1) —
 * a window-scoped drag listener is what let a slider drag hijack the
 * camera in the prototype.
 */
export function createOrbitControls(camera: PerspectiveCamera, canvas: HTMLCanvasElement): OrbitControls {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 90;
  controls.maxPolarAngle = Math.PI * 0.49; // stop just short of the horizon
  controls.target.set(0, 0, 0);
  return controls;
}
