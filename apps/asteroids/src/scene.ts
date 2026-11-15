import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { interpolate, seed, utcToTdb, skyDirection } from "./math";
import type { Body, Observation } from "./types";
import { orbitPath, asteroidScale } from "./orbits";
import { calibratedPose, planeGeometry, planePoint } from "./sightline";
export class SolarScene {
  private byId: Map<string, Body>;
  renderer: T.WebGLRenderer;
  camera = new T.PerspectiveCamera(45, 1, 0.001, 400);
  scene = new T.Scene();
  controls: OrbitControls;
  private instances: T.InstancedMesh[] = [];
  private planets: T.Mesh[] = [];
  private dummy = new T.Object3D();
  private p = [0, 0, 0];
  private chosen = "";
  private active = true;
  private disposed = false;
  private lifecycle = new AbortController();
  private resizeObserver: ResizeObserver | null = null;
  private path: T.Line | null = null;
  private referencePath: T.Line | null = null;
  private observationPoints: T.Points | null = null;
  private marker: T.Mesh;
  private ray: T.Line;
  private tween: {
    start: number;
    from: T.Vector3;
    to: T.Vector3;
    targetFrom: T.Vector3;
    target: T.Vector3;
    fromQuaternion: T.Quaternion;
    toQuaternion: T.Quaternion;
    fromFov: number;
    toFov: number;
    up: T.Vector3;
  } | null = null;
  private freePose: {
    position: T.Vector3;
    target: T.Vector3;
    up: T.Vector3;
    fov: number;
  } | null = null;
  private photoTexture = new T.CanvasTexture(document.createElement("canvas"));
  private photoMaterial = new T.MeshBasicMaterial({
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    side: T.DoubleSide,
    toneMapped: false,
  });
  private photoPlane = new T.Mesh(new T.BufferGeometry(), this.photoMaterial);
  private trailTexture = new T.CanvasTexture(document.createElement("canvas"));
  private trailMaterial = new T.MeshBasicMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: T.DoubleSide,
    toneMapped: false,
  });
  private trailMesh = new T.Mesh(this.photoPlane.geometry, this.trailMaterial);
  private trailEnabled = true;
  private photoFrame = new T.LineLoop(
    new T.BufferGeometry(),
    new T.LineBasicMaterial({
      color: 0x426e68,
      transparent: true,
      opacity: 0.6,
    }),
  );
  private projectionGroup = new T.Group();
  private photoEnabled = true;
  private warmup: Promise<unknown> = Promise.resolve();
  private observerRange = 1;
  private apparentPosition = new T.Vector3();
  private dirty = true;
  private frame = 0;
  private previous = 0;
  private mjd = 0;
  private playing = false;
  private hidden = false;
  private observer = false;
  private following = false;
  private observation: Observation | undefined;
  private lastTarget: T.Vector3 | null = null;
  private lastOrbit = 0;
  private labels: { body: Body; el: HTMLSpanElement }[] = [];
  private sizes: number[] = [];
  private dtSamples: number[] = [];
  private drawSamples: number[] = [];
  private frameTimes: number[] = [];
  onTick: (dt: number) => void = () => {};
  onSelect: (id: string) => void = () => {};
  onError: (message: string) => void = () => {};
  constructor(
    private element: HTMLElement,
    private bodies: Body[],
  ) {
    this.byId = new Map(bodies.map((b) => [b.id, b]));
    this.renderer = new T.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x090e17);
    element.append(this.renderer.domElement);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(0, -9, 7);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.minDistance = 0.01;
    this.controls.maxDistance = 90;
    this.controls.addEventListener("change", () => this.request());
    this.controls.addEventListener("start", () => {
      this.tween = null;
      this.observer = false;
      this.following = false;
    });
    this.scene.add(new T.HemisphereLight(0xc9dfff, 0x4f413b, 2.4));
    this.scene.add(new T.PointLight(0xffe9b5, 3, 0, 0));
    const sun = new T.Mesh(
      new T.IcosahedronGeometry(0.12, 2),
      new T.MeshBasicMaterial({ color: 0xffd595 }),
    );
    this.scene.add(sun);
    this.photoTexture.colorSpace = T.SRGBColorSpace;
    this.photoTexture.minFilter = this.photoTexture.magFilter = T.NearestFilter;
    this.photoTexture.generateMipmaps = false;
    this.photoMaterial.forceSinglePass = true;
    this.photoMaterial.map = this.photoTexture;
    this.photoPlane.renderOrder = 5;
    this.trailTexture.colorSpace = T.SRGBColorSpace;
    this.trailTexture.minFilter = this.trailTexture.magFilter = T.LinearFilter;
    this.trailTexture.generateMipmaps = false;
    this.trailMaterial.forceSinglePass = true;
    this.trailMaterial.map = this.trailTexture;
    this.trailMesh.renderOrder = 10;
    this.projectionGroup.add(this.photoPlane, this.photoFrame, this.trailMesh);
    this.projectionGroup.visible = false;
    this.scene.add(this.projectionGroup);
    // Real JPL-derived osculating reference ellipses, never circular grid rings.
    for (const kind of ["planet", "asteroid"]) {
      const vertices: number[] = [];
      for (const body of bodies.filter((b) => b.kind === kind)) {
        const points = orbitPath(body.samples[0]);
        for (let i = 1; i < points.length; i++)
          vertices.push(...points[i - 1], ...points[i]);
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute(
        "position",
        new T.Float32BufferAttribute(vertices, 3),
      );
      this.scene.add(
        new T.LineSegments(
          geometry,
          new T.LineBasicMaterial({
            color: kind === "planet" ? 0x6689a3 : 0x3b5c65,
            transparent: true,
            opacity: kind === "planet" ? 0.65 : 0.22,
          }),
        ),
      );
    }
    const rocks = bodies.filter((b) => b.kind === "asteroid");
    for (let k = 0; k < 4; k++) {
      const geo = new T.IcosahedronGeometry(1, k === 3 ? 0 : 1),
        a = geo.getAttribute("position");
      for (let i = 0; i < a.count; i++) {
        const x = a.getX(i),
          y = a.getY(i),
          z = a.getZ(i);
        const r = 1 + 0.16 * Math.sin(x * 12 + y * 7 + z * 19 + k * 3);
        a.setXYZ(
          i,
          x * r * (k === 1 ? 1.65 : 1),
          y * r * (k === 2 ? 1.3 : 1),
          z * r * (k === 2 ? 0.55 : 1),
        );
      }
      geo.computeVertexNormals();
      const group = rocks.filter((b) => seed(b.id) % 4 === k),
        mesh = new T.InstancedMesh(
          geo,
          new T.MeshStandardMaterial({
            color: [0xa1a5ac, 0xa78f77, 0x899b9b, 0x9d929f][k],
            roughness: 1,
            flatShading: true,
          }),
          group.length,
        );
      mesh.userData.ids = group.map((b) => b.id);
      mesh.frustumCulled = false;
      this.instances.push(mesh);
      this.scene.add(mesh);
    }
    for (const body of bodies.filter((b) => b.kind === "planet")) {
      const mesh = new T.Mesh(
        new T.IcosahedronGeometry(
          {
            "199": 0.013,
            "299": 0.025,
            "399": 0.027,
            "499": 0.018,
            "599": 0.065,
            "699": 0.055,
            "799": 0.04,
            "899": 0.038,
          }[body.id] ?? 0.027,
          1,
        ),
        new T.MeshStandardMaterial({
          color: body.color,
          roughness: 1,
          flatShading: true,
        }),
      );
      mesh.userData.id = body.id;
      this.planets.push(mesh);
      this.scene.add(mesh);
    }
    this.marker = new T.Mesh(
      new T.RingGeometry(0.0055, 0.006, 32),
      new T.MeshBasicMaterial({
        color: 0x8ce1cc,
        side: T.DoubleSide,
        depthTest: false,
        transparent: true,
        opacity: 0.9,
      }),
    );
    this.marker.renderOrder = 2;
    this.scene.add(this.marker);
    this.ray = new T.Line(
      new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]),
      new T.LineBasicMaterial({
        color: 0x62b8cf,
        transparent: true,
        opacity: 0.55,
      }),
    );
    this.scene.add(this.ray);
    this.renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.hidden = true;
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.onError(
        "그래픽 연결이 중단되었습니다. 페이지를 새로고침해 복구하세요.",
      );
    });
    let down = [0, 0];
    this.renderer.domElement.addEventListener("pointerdown", (e) => {
      down = [e.clientX, e.clientY];
    });
    this.renderer.domElement.addEventListener("pointerup", (e) => {
      if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const r = this.renderer.domElement.getBoundingClientRect(),
        raycaster = new T.Raycaster();
      raycaster.setFromCamera(
        new T.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        ),
        this.camera,
      );
      const hit = raycaster.intersectObjects(this.instances)[0];
      if (hit && hit.instanceId !== undefined)
        this.onSelect(hit.object.userData.ids[hit.instanceId]);
    });
    this.resizeObserver = new ResizeObserver(() => {
      const w = element.clientWidth,
        h = element.clientHeight;
      if (w <= 0 || h <= 0 || this.disposed) return;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      if (this.observer && !this.tween) this.alignObserver(false);
      this.camera.updateProjectionMatrix();
      this.request();
    });
    this.resizeObserver.observe(element);
    document.addEventListener("visibilitychange", () => {
      this.hidden = document.hidden;
      if (this.hidden) {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
      } else {
        this.previous = 0;
        this.request();
      }
    }, {signal:this.lifecycle.signal});
    for (const b of bodies) {
      const label = document.createElement("span");
      label.className = "body-label";
      label.textContent = b.name;
      label.hidden = true;
      element.append(label);
      this.labels.push({ body: b, el: label });
    }
    const first=bodies.find(body=>body.kind === "asteroid");
    if(!first) throw Error("소행성 궤도 자료가 없습니다.");
    this.setSelected(first.id);
    this.warmup = this.renderer.compileAsync(this.scene, this.camera);
  }
  ready() {
    return this.warmup;
  }
  setObservationTimes(times: number[]) {
    if (this.observationPoints) {
      this.scene.remove(this.observationPoints);
      this.observationPoints.geometry.dispose();
      (this.observationPoints.material as T.Material).dispose();
    }
    const body = this.byId.get(this.chosen)!;
    const points = times.map(
      (t) => new T.Vector3(...interpolate(body.samples, utcToTdb(t))),
    );
    this.observationPoints = new T.Points(
      new T.BufferGeometry().setFromPoints(points),
      new T.PointsMaterial({
        color: 0xf4c18a,
        size: 5,
        sizeAttenuation: false,
        depthTest: false,
      }),
    );
    this.scene.add(this.observationPoints);
    this.request();
  }
  setObservation(
    o: Observation | undefined,
    photo?: HTMLCanvasElement,
    trail?: HTMLCanvasElement,
  ) {
    this.observation = o;
    const f = o?.image?.calibration;
    if (!o?.spacecraft || !f) {
      this.projectionGroup.visible = false;
      return;
    }
    const physical = interpolate(
      this.byId.get(o.objectId)!.samples,
      utcToTdb(o.mjd),
    );
    this.observerRange = new T.Vector3(...physical).distanceTo(
      new T.Vector3(...o.spacecraft),
    );
    this.apparentPosition
      .fromArray(o.spacecraft)
      .addScaledVector(
        new T.Vector3(...skyDirection(o.ra, o.dec)),
        this.observerRange,
      );
    this.photoPlane.geometry.dispose();
    this.photoPlane.geometry = planeGeometry(f);
    this.trailMesh.geometry = this.photoPlane.geometry;
    const n = f.segments,
      corners = [
        f.grid[0],
        f.grid[n],
        f.grid[n * (n + 1) + n],
        f.grid[n * (n + 1)],
      ];
    this.photoFrame.geometry.dispose();
    this.photoFrame.geometry = new T.BufferGeometry().setFromPoints(
      corners.map((p) => new T.Vector3(p[0], p[1], 0)),
    );
    const d = this.observerRange * 0.97;
    this.projectionGroup.position
      .fromArray(o.spacecraft)
      .addScaledVector(new T.Vector3(...f.forward), d);
    this.projectionGroup.quaternion.setFromRotationMatrix(
      new T.Matrix4().makeBasis(
        new T.Vector3(...f.right),
        new T.Vector3(...f.up),
        new T.Vector3(...f.forward).negate(),
      ),
    );
    this.projectionGroup.scale.setScalar(d);
    if (photo) {
      this.photoTexture.image = photo;
      this.photoTexture.needsUpdate = true;
    }
    if (trail) {
      this.trailTexture.image = trail;
      this.trailTexture.needsUpdate = true;
    }
    this.trailMesh.visible = this.trailEnabled;
    this.projectionGroup.visible = this.observer;
    this.photoPlane.visible = this.photoEnabled;
    if (this.observer) this.alignObserver(false);
    this.dirty = true;
    this.request();
  }
  setTrailVisible(visible: boolean) {
    this.trailEnabled = visible;
    this.trailMesh.visible = visible;
    this.trailTexture.needsUpdate = true;
    this.request();
  }
  setPhotoVisible(visible: boolean) {
    this.photoEnabled = visible;
    this.photoPlane.visible = visible;
    this.request();
  }
  setPhotoOpacity(alpha: number) {
    this.photoMaterial.opacity = alpha;
    this.request();
  }
  private alignObserver(animate: boolean) {
    const o = this.observation;
    if (!o?.image?.calibration) return;
    const pose = calibratedPose(
      o,
      o.image.calibration,
      this.observerRange,
      this.camera.aspect,
    );
    if (animate) this.fly(pose);
    else {
      this.tween = null;
      this.camera.position.copy(pose.position);
      this.camera.up.copy(pose.up);
      this.camera.lookAt(pose.target);
      this.camera.fov = pose.fov;
      this.camera.updateProjectionMatrix();
      this.controls.target.copy(pose.target);
    }
  }
  private fly(pose: {
    position: T.Vector3;
    target: T.Vector3;
    up: T.Vector3;
    fov: number;
  }) {
    const end = this.camera.clone();
    end.position.copy(pose.position);
    end.up.copy(pose.up);
    end.lookAt(pose.target);
    this.controls.enabled = false;
    this.tween = {
      start: performance.now(),
      from: this.camera.position.clone(),
      to: pose.position,
      targetFrom: this.controls.target.clone(),
      target: pose.target,
      fromQuaternion: this.camera.quaternion.clone(),
      toQuaternion: end.quaternion.clone(),
      fromFov: this.camera.fov,
      toFov: pose.fov,
      up: pose.up,
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      this.tween.start -= 1100;
    this.request();
  }
  setSelected(id: string) {
    this.chosen = id;
    this.observer = false;
    this.following = false;
    this.tween = null;
    this.controls.enabled = true;
    this.camera.up.set(0, 0, 1);
    this.camera.fov = 45;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.projectionGroup.visible = false;
    this.lastTarget = null;
    this.updatePath();
    this.request();
  }
  private updatePath() {
    if (this.path) {
      this.scene.remove(this.path);
      this.path.geometry.dispose();
      (this.path.material as T.Material).dispose();
    }
    const b = this.byId.get(this.chosen)!;
    if (this.referencePath) {
      this.scene.remove(this.referencePath);
      this.referencePath.geometry.dispose();
      (this.referencePath.material as T.Material).dispose();
    }
    this.referencePath = new T.Line(
      new T.BufferGeometry().setFromPoints(
        orbitPath(b.samples[0]).map((p) => new T.Vector3(...p)),
      ),
      new T.LineBasicMaterial({
        color: 0x65cdb6,
        transparent: true,
        opacity: 0.65,
      }),
    );
    this.scene.add(this.referencePath);
    const points = b.samples
      .filter((_, i) => i % 2 === 0)
      .map((s) => new T.Vector3(s[1], s[2], s[3]));
    this.path = new T.Line(
      new T.BufferGeometry().setFromPoints(points),
      new T.LineBasicMaterial({
        color: 0xb6ffe6,
        transparent: true,
        opacity: 1,
      }),
    );
    this.scene.add(this.path);
  }
  setTime(mjd: number) {
    this.mjd = mjd;
    this.dirty = true;
    this.request();
  }
  setPlaying(value: boolean) {
    this.playing = value;
    this.previous = 0;
    this.request();
  }
  setActive(active: boolean) {
    this.active=active;this.previous=0;
    if(!active){cancelAnimationFrame(this.frame);this.frame=0;}else this.request();
  }
  dispose() {
    if(this.disposed)return;this.disposed=true;this.setActive(false);
    this.lifecycle.abort();this.resizeObserver?.disconnect();this.controls.dispose();
    const geometries=new Set<T.BufferGeometry>(), materials=new Set<T.Material>();
    this.scene.traverse(object=>{
      const mesh=object as T.Mesh;
      if(mesh.geometry)geometries.add(mesh.geometry);
      if(mesh.material)for(const material of (Array.isArray(mesh.material)?mesh.material:[mesh.material]))materials.add(material);
    });
    for(const geometry of geometries)geometry.dispose();
    for(const material of materials)material.dispose();
    this.photoTexture.dispose();this.trailTexture.dispose();this.renderer.dispose();
    this.renderer.domElement.remove();for(const label of this.labels)label.el.remove();
  }
  quality(low: boolean) {
    this.renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio, 1.5));
    this.request();
  }
  view(mode: "system" | "target" | "observer" | "free") {
    if (mode === "observer" && !this.observation?.image?.calibration) {
      this.onError("이 촬영의 WCS 시점이 준비되지 않았습니다.");
      return;
    }
    if (mode === "observer" && !this.observer)
      this.freePose = {
        position: this.camera.position.clone(),
        target: this.controls.target.clone(),
        up: this.camera.up.clone(),
        fov: this.camera.fov,
      };
    this.observer = mode === "observer";
    this.following = mode === "target";
    this.projectionGroup.visible = this.observer;
    this.dirty = true;
    if (this.observer) {
      this.alignObserver(true);
      return;
    }
    const target = new T.Vector3(
      ...interpolate(this.byId.get(this.chosen)!.samples, utcToTdb(this.mjd)),
    );
    this.lastTarget = target.clone();
    if (mode === "free" && this.freePose) {
      this.fly(this.freePose);
      return;
    }
    if (mode === "target")
      this.fly({
        position: target.clone().add(new T.Vector3(0, -0.035, 0.022)),
        target,
        up: new T.Vector3(0, 0, 1),
        fov: 45,
      });
    else
      this.fly({
        position: new T.Vector3(0, -9, 7),
        target: new T.Vector3(),
        up: new T.Vector3(0, 0, 1),
        fov: 45,
      });
  }
  request() {
    if (!this.frame && !this.hidden && this.active && !this.disposed)
      this.frame = requestAnimationFrame((t) => this.render(t));
  }
  private render(t: number) {
    this.frame = 0;
    if (this.disposed || !this.active || this.hidden) return;
    if (this.previous && this.playing) {
      this.frameTimes.push(t - this.previous);
      if (this.frameTimes.length > 600) this.frameTimes.shift();
    }
    const dt = this.previous ? Math.min((t - this.previous) / 1000, 0.1) : 0;
    this.previous = t;
    if (this.playing) this.onTick(dt);
    const begin = performance.now();
    if (this.dirty) {
      this.dirty = false;
      const epoch = utcToTdb(this.mjd);
      for (const mesh of this.instances) {
        const ids: string[] = mesh.userData.ids;
        ids.forEach((id, i) => {
          const b = this.byId.get(id)!;
          interpolate(b.samples, epoch, this.p);
          this.dummy.position.set(...(this.p as [number, number, number]));
          if (this.observer && id === this.chosen)
            this.dummy.position.copy(this.apparentPosition);
          const h = seed(id);
          this.dummy.rotation.set(
            (h % 20) * 0.1,
            (h % 31) * 0.1,
            (h % 17) * 0.1,
          );
          const pixelScale =
            this.observation?.image?.calibration?.radiansPerPixel ?? 0;
          this.dummy.scale.setScalar(
            this.observer
              ? this.observerRange * pixelScale * 0.65
              : asteroidScale(id),
          );
          this.dummy.updateMatrix();
          mesh.setMatrixAt(i, this.dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
      }
      for (const mesh of this.planets) {
        interpolate(this.byId.get(mesh.userData.id)!.samples, epoch, this.p);
        mesh.position.set(...(this.p as [number, number, number]));
      }
      interpolate(this.byId.get(this.chosen)!.samples, epoch, this.p);
      this.marker.position.set(...(this.p as [number, number, number]));
      if (this.observer) this.marker.position.copy(this.apparentPosition);
      this.marker.scale.setScalar(
        this.observer
          ? (this.observerRange *
              (this.observation?.image?.calibration?.radiansPerPixel ?? 0) *
              5) /
              0.006
          : 1,
      );
      this.ray.visible = !this.observer;
      if (this.observationPoints)
        this.observationPoints.visible = !this.observer;
      if (this.following && !this.tween && this.lastTarget) {
        const delta = this.marker.position.clone().sub(this.lastTarget);
        this.camera.position.add(delta);
        this.controls.target.add(delta);
        this.controls.update();
      }
      this.lastTarget = this.marker.position.clone();
      const earth = this.planets.find((b) => b.userData.id === "399")!;
      const a = this.ray.geometry.getAttribute("position");
      a.setXYZ(0, earth.position.x, earth.position.y, earth.position.z);
      a.setXYZ(1, ...(this.p as [number, number, number]));
      a.needsUpdate = true;
      this.ray.geometry.computeBoundingSphere();
    }
    if (this.tween) {
      if (this.following) {
        const delta = this.marker.position.clone().sub(this.tween.target);
        this.tween.to.add(delta);
        this.tween.target.copy(this.marker.position);
      }
      const u = Math.min(1, (t - this.tween.start) / 1100),
        ease = u * u * (3 - 2 * u);
      this.camera.position.lerpVectors(this.tween.from, this.tween.to, ease);
      this.controls.target.lerpVectors(
        this.tween.targetFrom,
        this.tween.target,
        ease,
      );
      this.camera.quaternion.slerpQuaternions(
        this.tween.fromQuaternion,
        this.tween.toQuaternion,
        ease,
      );
      this.camera.fov = Math.exp(
        T.MathUtils.lerp(
          Math.log(this.tween.fromFov),
          Math.log(this.tween.toFov),
          ease,
        ),
      );
      this.camera.updateProjectionMatrix();
      if (u === 1) {
        this.camera.up.copy(this.tween.up);
        this.tween = null;
        this.controls.enabled = !this.observer;
        if (!this.observer) this.controls.update();
      }
    }
    this.marker.visible = !this.observer || !this.trailEnabled;
    this.marker.quaternion.copy(this.camera.quaternion);
    const labelWidth = this.element.clientWidth,
      labelHeight = this.element.clientHeight;
    for (const { body, el } of this.labels) {
      if (body.kind === "asteroid" && body.id !== this.chosen) {
        el.hidden = true;
        continue;
      }
      const p = interpolate(body.samples, utcToTdb(this.mjd));
      const v = (
        this.observer && body.id === this.chosen
          ? this.apparentPosition.clone()
          : new T.Vector3(...p)
      ).project(this.camera);
      el.hidden = v.z < -1 || v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1;
      if (!el.hidden) {
        el.style.left = ((v.x + 1) * labelWidth) / 2 + 8 + "px";
        el.style.top = ((-v.y + 1) * labelHeight) / 2 - 8 + "px";
      }
    }
    this.renderer.render(this.scene, this.camera);
    this.drawSamples.push(performance.now() - begin);
    if (dt > 0) this.dtSamples.push(dt * 1000);
    if (this.dtSamples.length > 600) this.dtSamples.shift();
    if (this.drawSamples.length > 600) this.drawSamples.shift();
    if (this.playing || this.tween) this.request();
  }
  private overlayError() {
    const o = this.observation,
      f = o?.image?.calibration;
    if (!this.observer || this.tween || !o?.image || !o.spacecraft || !f)
      return null;
    const im = o.image,
      p = planePoint(
        f,
        im.predicted[0],
        im.height - 1 - im.predicted[1],
        im.width,
        im.height,
      );
    const direction = new T.Vector3(...f.forward)
      .addScaledVector(new T.Vector3(...f.right), p[0])
      .addScaledVector(new T.Vector3(...f.up), p[1])
      .normalize();
    return (
      direction.distanceTo(new T.Vector3(...skyDirection(o.ra, o.dec))) /
      f.radiansPerPixel
    );
  }
  private screenAlignmentError() {
    const o = this.observation,
      f = o?.image?.calibration;
    if (!this.observer || this.tween || !o?.image || !f) return null;
    const im = o.image,
      p = planePoint(
        f,
        im.predicted[0],
        im.height - 1 - im.predicted[1],
        im.width,
        im.height,
      );
    this.camera.updateMatrixWorld();
    this.projectionGroup.updateMatrixWorld();
    const photo = new T.Vector3(p[0], p[1], 0)
      .applyMatrix4(this.projectionGroup.matrixWorld)
      .project(this.camera);
    const mesh = this.instances.find((m) =>
      m.userData.ids.includes(this.chosen),
    )!;
    const matrix = new T.Matrix4();
    mesh.getMatrixAt(mesh.userData.ids.indexOf(this.chosen), matrix);
    const rock = new T.Vector3()
      .setFromMatrixPosition(matrix)
      .applyMatrix4(mesh.matrixWorld)
      .project(this.camera);
    return Math.hypot(
      ((rock.x - photo.x) * this.element.clientWidth) / 2,
      ((rock.y - photo.y) * this.element.clientHeight) / 2,
    );
  }
  metrics() {
    const sorted = [...this.drawSamples].sort((a, b) => a - b);
    const frames = [...this.frameTimes].sort((a, b) => a - b);
    return {
      frameP95: frames[Math.floor(frames.length * 0.95)] ?? 0,
      drawP95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      frames: this.drawSamples.length,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      scheduled: !!this.frame,
      selectedScreen: (this.observer
        ? this.apparentPosition.clone()
        : new T.Vector3(
            ...interpolate(
              this.byId.get(this.chosen)!.samples,
              utcToTdb(this.mjd),
            ),
          )
      )
        .project(this.camera)
        .toArray(),
      observer: this.observer,
      flying: !!this.tween,
      photoVisible: this.projectionGroup.visible && this.photoPlane.visible,
      photoOpacity: this.photoMaterial.opacity,
      trailVisible: this.projectionGroup.visible && this.trailMesh.visible,
      sharedTrailGeometry: this.trailMesh.geometry === this.photoPlane.geometry,
      cameraPosition: this.camera.position.toArray(),
      cameraQuaternion: this.camera.quaternion.toArray(),
      cameraFov: this.camera.fov,
      overlayErrorPixels: this.overlayError(),
      screenAlignmentError: this.screenAlignmentError(),
      controlsEnabled: this.controls.enabled,
      imageMeshErrorPixels:
        this.observation?.image?.calibration?.maxMeshErrorPixels,
      photoVertices:
        this.photoPlane.geometry.getAttribute("position")?.count ?? 0,
    };
  }
}
