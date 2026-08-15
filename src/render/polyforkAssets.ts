import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type * as THREE from 'three';

/**
 * Real Polyfork models (§11.2), loaded through our own server proxy
 * (api/asset/[id].ts) — never hotlinked from polyfork.dev directly, so the
 * Pro token stays server-side and every fetch gets the proxy's caching and
 * CORS headers. Resolves to `null` instead of rejecting on any failure
 * (missing token, offline, upstream error) so callers can fall back to the
 * procedural placeholder (§11.3) with a plain `if`, not a try/catch.
 *
 * Loaded scenes are cached at module scope, keyed by id+tier — a Restart
 * click tears down and recreates the whole three.js scene, but there's no
 * reason to refetch or reparse a GLB that already loaded once this page
 * session.
 */
export type AssetTier = 'free' | 'pro';

const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Object3D | null>>();

export function loadPolyforkAsset(id: string, tier: AssetTier): Promise<THREE.Object3D | null> {
  const key = `${tier}:${id}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = loader
      .loadAsync(`/api/asset/${id}?tier=${tier}`)
      .then((gltf) => gltf.scene)
      .catch(() => null);
    cache.set(key, pending);
  }
  return pending;
}

/** A rigged model's per-instance walk-cycle solver: feed it a monotonically
 * increasing travelled-distance value each frame (never a delta, never
 * time) and it plants feet without skating. */
export interface WalkGait {
  poseAt(distance: number): void;
}

export interface WalkRuntime {
  walker(model: THREE.Object3D, opts: { ground: unknown }): WalkGait;
  raycastGround(meshes: THREE.Object3D[]): unknown;
}

// Unlike the GLBs above, walk.mjs isn't a licensed 3D asset — it's a small
// shared utility Polyfork documents as a direct hotlink
// (`import ... from 'https://polyfork.dev/cdn/walk.mjs'`), so this skips
// our proxy. The URL lives in a variable, not a string literal, so
// TypeScript treats the import as untyped (`Promise<any>`) rather than
// trying to resolve a remote URL as a local module at compile time.
const WALK_RUNTIME_URL = 'https://polyfork.dev/cdn/walk.mjs';

let walkRuntime: Promise<WalkRuntime | null> | null = null;

export function loadWalkRuntime(): Promise<WalkRuntime | null> {
  if (!walkRuntime) {
    walkRuntime = import(/* @vite-ignore */ WALK_RUNTIME_URL)
      .then((mod: WalkRuntime) => mod)
      .catch(() => null);
  }
  return walkRuntime;
}
