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
