import { describe, expect, it, vi } from 'vitest';
import { Box3, BufferGeometry, Color, Group, Mesh, PerspectiveCamera, Vector3, Vector4 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { spacecraftAttitude, craftCameraPose, craftOnlyCameraPose, craftInsetRect, CRAFT_SCALE, EARTH_RADIUS_AU } from '../src/spacecraft';
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
  it('frames the spacecraft alone at its unchanged physical position on every viewport', () => {
    for (const o of prepared) {
      const position = new Vector3(...o.spacecraft!), forward = new Vector3(...skyDirection(o.ra, o.dec));
      for (const aspect of [.35, 1, 1.25, 3]) {
        const pose = craftOnlyCameraPose(position, forward, aspect);
        expect(pose.target.distanceTo(position)).toBe(0);
        const camera = new PerspectiveCamera(pose.fov, aspect, EARTH_RADIUS_AU * .01, 400);
        camera.position.copy(pose.position); camera.up.copy(pose.up); camera.lookAt(pose.target); camera.updateMatrixWorld();
        for (const axis of [new Vector3(1,0,0), new Vector3(0,1,0), new Vector3(0,0,1)]) {
          for (const sign of [-1, 1]) {
            const screen = position.clone().addScaledVector(axis, sign * CRAFT_SCALE * .83).project(camera);
            expect(Math.abs(screen.x)).toBeLessThan(.9);
            expect(Math.abs(screen.y)).toBeLessThan(.9);
            expect(screen.z).toBeGreaterThan(-1);
            expect(screen.z).toBeLessThan(1);
          }
        }
      }
    }
  });
  it('keeps the inset inside mobile and desktop viewports', () => {
    for (const [width, height] of [[320, 300], [380, 700], [800, 450], [1400, 900]]) {
      const rect = craftInsetRect(width, height);
      expect(rect.left).toBeGreaterThanOrEqual(12);
      expect(rect.top).toBeGreaterThanOrEqual(12);
      expect(rect.left + rect.width).toBeLessThanOrEqual(width - 12);
      expect(rect.top + rect.height).toBeLessThanOrEqual(height - 12);
    }
  });
  it('fits the inset between the measured scene header and lower controls', () => {
    const rect = craftInsetRect(380, 520, { top: 190, bottom: 350 });
    expect(rect.top).toBe(190);
    expect(rect.height).toBeLessThanOrEqual(160);
    expect(rect.top + rect.height).toBeLessThanOrEqual(350);
    expect(rect.left + rect.width).toBeLessThanOrEqual(368);
    expect(craftInsetRect(380, 520, { top: 300, bottom: 320 }).width).toBe(0);
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
    observer: false, craftView: false, craftOnly: false, craftFlight: false, craftEpoch: 0,
    craftInset: { hidden: true, style: {} },
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
  it('isolates the spacecraft by camera layer and restores the full scene afterward', async () => {
    const scene = sceneState();
    scene.view('craft-only');
    await Promise.resolve();
    expect(scene.craftView).toBe(true);
    expect(scene.craftOnly).toBe(true);
    expect(scene.camera.layers.mask).toBe(2);
    expect(scene.placeCraft).toHaveBeenCalledWith(true);
    scene.view('system');
    expect(scene.craftOnly).toBe(false);
    expect(scene.camera.layers.mask).toBe(1);
    expect(scene.camera.near).toBe(.001);
  });
  it('renders the optional inset with a separate camera and restores the main viewport', async () => {
    const scene = sceneState();
    const viewport = new Vector4(0, 0, 1000, 700), scissor = viewport.clone();
    const renderer = {
      getViewport: (out: Vector4) => out.copy(viewport),
      getScissor: (out: Vector4) => out.copy(scissor),
      getScissorTest: () => false,
      getClearColor: (out: Color) => out.set(0x090e17),
      getClearAlpha: () => 1,
      setViewport: vi.fn(), setScissor: vi.fn(), setScissorTest: vi.fn(), setClearColor: vi.fn(), render: vi.fn(),
    };
    Object.assign(scene, {
      observer: true, renderer, scene: new Group(), craft: new Group(),
      craftInsetCamera: new PerspectiveCamera(42, 1.25, EARTH_RADIUS_AU * .01, 400),
      element: { clientWidth: 1000, clientHeight: 700, getBoundingClientRect: () => ({ top: 0 }) },
    });
    scene.craft.visible = false;
    const position = scene.camera.position.clone(), quaternion = scene.camera.quaternion.clone();
    const fov = scene.camera.fov, target = scene.controls.target.clone();
    scene.setCraftVisible(true);
    await Promise.resolve();
    scene.renderCraftInset();
    expect(scene.craftInsetVisible).toBe(true);
    expect(renderer.render).toHaveBeenCalledWith(scene.scene, scene.craftInsetCamera);
    expect(renderer.setViewport.mock.lastCall?.[0]).toEqual(viewport);
    expect(renderer.setScissor.mock.lastCall?.[0]).toEqual(scissor);
    expect(renderer.setScissorTest.mock.lastCall).toEqual([false]);
    expect(scene.camera.position.distanceTo(position)).toBe(0);
    expect(scene.camera.quaternion.angleTo(quaternion)).toBe(0);
    expect(scene.camera.fov).toBe(fov);
    expect(scene.controls.target.distanceTo(target)).toBe(0);
    expect(scene.craft.position.toArray()).toEqual(prepared[0].spacecraft);
    expect(scene.craft.visible).toBe(false);
    scene.setCraftVisible(false);
    expect(scene.craftInsetVisible).toBe(false);
    expect(scene.craftInset.hidden).toBe(true);
  });
  it('positions 24 selectable target markers and hides them in observation and spacecraft modes', () => {
    const scene = sceneState();
    scene.element = { clientWidth: 1000, clientHeight: 700 };
    scene.asteroidButtons = bodies.filter(body => body.kind === 'asteroid').map(body => ({
      body, el: { hidden: true, style: {}, classList: { toggle: vi.fn() }, setAttribute: vi.fn() },
    }));
    scene.camera.up.set(0, 0, 1);
    scene.camera.lookAt(0, 0, 0);
    scene.camera.updateMatrixWorld();
    scene.updateAsteroidButtons();
    expect(scene.asteroidButtons).toHaveLength(24);
    const chosen = scene.asteroidButtons.find((button: any) => button.body.id === scene.chosen);
    expect(chosen.el.hidden).toBe(false);
    expect(chosen.el.setAttribute).toHaveBeenCalledWith('aria-pressed', 'true');
    const point = new Vector3(...interpolate(chosen.body.samples, utcToTdb(scene.mjd))).project(scene.camera);
    expect(parseFloat(chosen.el.style.left)).toBeCloseTo((point.x + 1) * 500, 8);
    expect(parseFloat(chosen.el.style.top)).toBeCloseTo((1 - point.y) * 350, 8);
    for (const [observer, craftView] of [[true, false], [false, true]]) {
      scene.observer = observer; scene.craftView = craftView;
      scene.updateAsteroidButtons();
      expect(scene.asteroidButtons.every((button: any) => button.el.hidden)).toBe(true);
    }
  });
});
