import { describe, expect, it, vi } from 'vitest';
import { Box3, BufferGeometry, Group, Mesh, PerspectiveCamera, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { spacecraftAttitude, craftCameraPose, CRAFT_SCALE, EARTH_RADIUS_AU } from '../src/spacecraft';
import { SolarScene } from '../src/scene';
import { interpolate, skyDirection, utcToTdb } from '../src/math';
import comparisons from '../public/data/comparisons.json';
import observations from '../public/data/observations.json';
import bodies from '../public/data/bodies.json';
import sightlines from '../public/data/sightlines.json';
import type { Sightline } from '../src/types';

const prepared = [...comparisons.flatMap(s => s.frames), ...observations]
  .filter(o => o.spacecraft && o.image)
  .map(o => ({ ...o, image: { ...o.image!, calibration: (sightlines as Record<string, Sightline>)[o.image!.path] } }));
const earthSamples = bodies.find(b => b.id === '399')!.samples;

describe('SPHEREx model orientation and physical Earth', () => {
  it('preserves boresight and maximises panel sunlight for every prepared exposure', () => {
    const ids = new Set<string>();
    for (const o of prepared) {
      if (!o.spacecraft || !o.image) continue;
      ids.add(o.objectId);
      const position = new Vector3(...o.spacecraft);
      const forward = new Vector3(...skyDirection(o.ra, o.dec));
      const { quaternion, sunAngle } = spacecraftAttitude(position, forward);
      const bore = new Vector3(0, 1, 0).applyQuaternion(quaternion);
      const panel = new Vector3(0, 0, -1).applyQuaternion(quaternion);
      const sun = position.clone().negate().normalize();
      expect(bore.distanceTo(forward)).toBeLessThan(1e-10);
      expect(Math.abs(panel.dot(bore))).toBeLessThan(1e-10);
      expect(panel.dot(sun)).toBeCloseTo(Math.sqrt(Math.max(0, 1 - sun.dot(forward) ** 2)), 10);
      expect(Number.isFinite(sunAngle)).toBe(true);
      const earth = new Vector3(...interpolate(earthSamples, utcToTdb(o.mjd)));
      for (const aspect of [.35, .55, 1, 2, 3]) {
        const pose = craftCameraPose(position, earth, forward, aspect);
        expect(pose.position.clone().sub(pose.target).dot(earth.clone().negate())).toBeGreaterThanOrEqual(-1e-12);
        expect(pose.position.distanceTo(earth)).toBeGreaterThan(EARTH_RADIUS_AU);
        expect(pose.position.distanceTo(position)).toBeGreaterThan(CRAFT_SCALE);
        const camera = new PerspectiveCamera(pose.fov, aspect, EARTH_RADIUS_AU * .01, 400);
        camera.position.copy(pose.position); camera.up.copy(pose.up); camera.lookAt(pose.target); camera.updateMatrixWorld();
        for (const point of [position, earth]) {
          const screen = point.clone().project(camera);
          expect(Math.abs(screen.x)).toBeLessThan(.9); expect(Math.abs(screen.y)).toBeLessThan(.9);
          expect(screen.z).toBeGreaterThan(-1); expect(screen.z).toBeLessThan(1);
        }
        // The complete globe remains in frame, including a narrow portrait viewport.
        for (const axis of [new Vector3(1,0,0), new Vector3(0,1,0), new Vector3(0,0,1)]) {
          for (const sign of [-1, 1]) {
            const screen = earth.clone().addScaledVector(axis, sign * EARTH_RADIUS_AU).project(camera);
            expect(Math.abs(screen.x)).toBeLessThan(.9);
            expect(Math.abs(screen.y)).toBeLessThan(.9);
          }
        }
      }
    }
    // 913 has no prepared image in Apogee; its spacecraft button must stay disabled.
    expect(ids.size).toBe(23);
    expect(ids.has('913')).toBe(false);
  });
  it('places every enlarged model fully above Earth at the exposure time', async () => {
    // Node is needed only by this fixture check; the application tsconfig is browser-only.
    const filesystemModule = 'node:fs/promises';
    const { readFile } = await import(filesystemModule);
    const bytes = await readFile(new URL('../public/model/spherex-lite.glb', import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const size = new Box3().setFromObject(gltf.scene).getSize(new Vector3());
    const modelRadius = size.length() / Math.max(size.x, size.y, size.z) * CRAFT_SCALE / 2;
    for (const o of prepared) {
      const earth = new Vector3(...interpolate(earthSamples, utcToTdb(o.mjd)));
      const altitude = earth.distanceTo(new Vector3(...o.spacecraft!)) - EARTH_RADIUS_AU;
      expect(altitude).toBeGreaterThan(modelRadius);
      expect(altitude * 149597870.7).toBeGreaterThan(640);
      expect(altitude * 149597870.7).toBeLessThan(675);
    }
    gltf.scene.traverse(object => {
      const mesh = object as Mesh;
      mesh.geometry?.dispose();
      if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
    });
  });
  it('keeps a finite orthonormal attitude even when the Sun is parallel to the boresight', () => {
    for (const v of [new Vector3(0,0,1), new Vector3(0,0,-1), new Vector3(1,0,0)]) {
      const {quaternion, sunAngle} = spacecraftAttitude(v.clone().negate(), v);
      expect(quaternion.length()).toBeCloseTo(1,12);
      expect(new Vector3(0,1,0).applyQuaternion(quaternion).distanceTo(v)).toBeLessThan(1e-10);
      expect(sunAngle).toBeCloseTo(90,10);
    }
  });
});

// Exercise view state without creating a WebGL renderer or a browser DOM.
function sceneState() {
  const scene = Object.create(SolarScene.prototype) as any;
  Object.assign(scene, {
    camera: new PerspectiveCamera(45, 1, .001, 400),
    controls: { target: new Vector3(), minDistance: .01, enabled: true },
    byId: new Map(bodies.map(b => [b.id, b])), chosen: prepared[0].objectId,
    mjd: prepared[0].mjd, observation: prepared[0],
    observer: false, craftView: false, craftFlight: false, craftEpoch: 0,
    projectionGroup: new Group(),
    fly: vi.fn(), request: vi.fn(), onError: vi.fn(), alignObserver: vi.fn(), placeCraft: vi.fn(),
    loadCraft: vi.fn(() => Promise.resolve()),
  });
  scene.camera.position.set(0, -9, 7);
  return scene;
}

describe('spacecraft view transitions', () => {
  it('returns to the original system-scale camera after spacecraft → observer → free', async () => {
    const scene = sceneState(), original = scene.camera.position.clone();
    scene.view('craft');
    await Promise.resolve();
    scene.camera.position.fromArray(prepared[0].spacecraft!);
    scene.camera.fov = 42;
    scene.view('observer');
    scene.view('free');
    const pose = scene.fly.mock.lastCall[0];
    expect(pose.position.distanceTo(original)).toBe(0);
    expect(pose.fov).toBe(45);
    expect(scene.camera.near).toBe(.001);
    expect(scene.controls.minDistance).toBe(.01);
    expect(scene.craftView).toBe(false);
    expect(scene.observer).toBe(false);
  });
  it('ignores stale model-load callbacks from an earlier spacecraft entry', async () => {
    const scene = sceneState();
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    scene.loadCraft.mockReturnValue(pending);
    scene.view('craft');
    scene.view('system');
    scene.view('craft');
    finish();
    await Promise.resolve();
    expect(scene.placeCraft).toHaveBeenCalledTimes(1);
  });
  it('measures the drawn Earth radius for close-up label placement', () => {
    const scene = sceneState(), earth = new Mesh();
    earth.userData.radius = .027;
    earth.scale.setScalar(EARTH_RADIUS_AU / .027);
    scene.camera.position.set(0, 0, EARTH_RADIUS_AU * 4);
    scene.element = { clientHeight: 600 };
    expect(scene.planetPixels(earth)).toBeGreaterThan(0);
    expect(scene.planetPixels(earth)).toBeLessThan(300);
  });
  it('continues toward the close-up when an exposure changes during entry', () => {
    const scene = sceneState();
    const mesh = () => new Mesh(new BufferGeometry());
    Object.assign(scene, {
      craftView: true, tween: {}, apparentPosition: new Vector3(),
      photoPlane: mesh(), trailMesh: mesh(), photoBacking: mesh(), photoFrame: mesh(),
      trailEnabled: true, photoEnabled: true,
    });
    scene.setObservation(prepared[1]);
    expect(scene.placeCraft).toHaveBeenCalledWith(true);
    expect(scene.mjd).toBe(prepared[1].mjd);
  });
  it('uses current zoom when the observer fly-through is interrupted by its zoom control', () => {
    const scene = sceneState();
    Object.assign(scene, {
      observer: true, craftFlight: true, tween: {}, observerRange: 2,
      onObserverZoom: vi.fn(),
    });
    scene.setObserverZoom(2);
    expect(scene.observerZoom).toBe(2);
    expect(scene.alignObserver).toHaveBeenCalledWith(false);
  });
});
