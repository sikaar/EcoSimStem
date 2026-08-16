import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EntityLayer } from '../src/render/creatureView';

/**
 * Placement invariants for the render layer, written after the fox model
 * turned up somewhere other than where the simulation had the predator.
 *
 * These are the two things that can move a model away from its entity, and
 * neither is visible to a test that only checks "an object was added":
 * a gait solver getting the root transform after the layer set it, and a
 * gait being built while the clone still sits at the scene origin.
 */
interface FakeGait {
  poseAt(distance: number): void;
}

function layerWith(onGait: (obj: THREE.Object3D) => FakeGait | null) {
  const scene = new THREE.Scene();
  const layer = new EntityLayer<{ id: number; x: number; z: number; dir?: number }>(
    scene,
    () => new THREE.Object3D(),
    0,
    onGait,
  );
  return { scene, layer };
}

describe('EntityLayer placement', () => {
  it('keeps the model at the entity position even when the gait moves the root', () => {
    // walk.mjs poses limbs against a ground raycast and is free to touch
    // the object it was handed — shifting it to stop feet skating, or
    // lifting it to keep them planted. The simulation is the authority on
    // where a creature stands, so the layer has the last word on x and z.
    const { layer } = layerWith((obj) => ({
      poseAt: () => {
        obj.position.set(999, 5, -999);
      },
    }));

    layer.sync([{ id: 1, x: 12.5, z: -4.25 }]);
    layer.sync([{ id: 1, x: 13.5, z: -4.25 }]);

    const obj = layer.objectFor(1)!;
    expect(obj.position.x).toBe(13.5);
    expect(obj.position.z).toBe(-4.25);
  });

  it('leaves height to the gait, which owns foot planting', () => {
    // The mirror of the test above: y is the one axis the solver is given
    // a ground query for, so stamping the layer's yOffset back over it
    // would push the feet through the floor.
    const { layer } = layerWith((obj) => ({
      poseAt: () => {
        obj.position.y = 0.42;
      },
    }));
    layer.sync([{ id: 1, x: 1, z: 2 }]);
    expect(layer.objectFor(1)!.position.y).toBe(0.42);
  });

  it('builds the gait after the instance is placed, not at the scene origin', () => {
    // A gait fitted while the clone is still at (0,0) measures the wrong
    // patch of world for every creature that did not spawn there.
    let positionAtGaitCreation: THREE.Vector3 | null = null;
    const { layer } = layerWith((obj) => {
      positionAtGaitCreation = obj.position.clone();
      return { poseAt: () => {} };
    });

    layer.sync([{ id: 1, x: -7, z: 21 }]);

    expect(positionAtGaitCreation).not.toBeNull();
    expect(positionAtGaitCreation!.x).toBe(-7);
    expect(positionAtGaitCreation!.z).toBe(21);
  });

  it('feeds the gait cumulative distance travelled, and holds pose while standing still', () => {
    const seen: number[] = [];
    const { layer } = layerWith(() => ({ poseAt: (d) => seen.push(d) }));

    layer.sync([{ id: 1, x: 0, z: 0 }]);
    layer.sync([{ id: 1, x: 3, z: 4 }]); // +5
    layer.sync([{ id: 1, x: 3, z: 4 }]); // stationary
    layer.sync([{ id: 1, x: 3, z: 6 }]); // +2

    expect(seen).toEqual([0, 5, 5, 7]);
  });

  it('applies facing from the entity', () => {
    const { layer } = layerWith(() => null);
    layer.sync([{ id: 1, x: 0, z: 0, dir: 1.25 }]);
    expect(layer.objectFor(1)!.rotation.y).toBe(1.25);
  });

  it('removes objects for entities that are gone', () => {
    const { scene, layer } = layerWith(() => null);
    layer.sync([{ id: 1, x: 0, z: 0 }, { id: 2, x: 1, z: 1 }]);
    expect(scene.children).toHaveLength(2);
    layer.sync([{ id: 2, x: 1, z: 1 }]);
    expect(scene.children).toHaveLength(1);
    expect(layer.objectFor(1)).toBeNull();
  });
});
