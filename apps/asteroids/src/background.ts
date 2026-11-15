import * as T from "three";

/** Orbit classes in the order written by scripts/fetch_background.py. */
export const CLASSES = ["MBA", "IMB", "OMB", "MCA", "AMO", "APO", "ATE", "IEO", "TJN", "CEN", "TNO", "AST", "HYA", "PAA"] as const;
/** Display groups: colour and the legend wording. */
export const GROUPS = [
  { key: "main", label: "소행성대", color: 0xbfa98a, classes: ["MBA", "IMB", "AST", "HYA", "PAA"] },
  { key: "outer", label: "바깥 소행성대·힐다", color: 0xe0a458, classes: ["OMB"] },
  { key: "mars", label: "화성 근접", color: 0xd98e8e, classes: ["MCA"] },
  { key: "neo", label: "지구 근접", color: 0xff7a59, classes: ["AMO", "APO", "ATE", "IEO"] },
  { key: "trojan", label: "목성 트로이", color: 0xa8c69f, classes: ["TJN"] },
  { key: "far", label: "켄타우로스·해왕성 너머", color: 0x7fc8a9, classes: ["CEN", "TNO"] },
] as const;
export const groupOf = (cls: string) => Math.max(0, GROUPS.findIndex((g) => (g.classes as readonly string[]).includes(cls)));

const K = 0.01720209895; // Gaussian gravitational constant, rad/day (AU, solar masses)
/** Days of TDB since JD 2460000 for a scene time in MJD TDB. */
export const daysSinceRef = (mjdTdb: number) => mjdTdb + 2400000.5 - 2460000;

/** Two-body heliocentric ecliptic J2000 position (AU) from osculating elements.
 *  el = [a, e, i°, Ω°, ω°, M°, epoch − 2460000 (JD TDB)]. Same maths as the vertex shader. */
export function keplerPosition(el: ArrayLike<number>, days: number): [number, number, number] {
  const [a, e, iDeg, omDeg, wDeg, maDeg, epoch] = Array.from(el);
  const d = Math.PI / 180;
  let M = (maDeg * d + (K / Math.pow(a, 1.5)) * (days - epoch)) % (2 * Math.PI);
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const [cO, sO, cw, sw, ci, si] = [Math.cos(omDeg * d), Math.sin(omDeg * d), Math.cos(wDeg * d), Math.sin(wDeg * d), Math.cos(iDeg * d), Math.sin(iDeg * d)];
  return [
    (cO * cw - sO * sw * ci) * x + (-cO * sw - sO * cw * ci) * y,
    (sO * cw + cO * sw * ci) * x + (-sO * sw + cO * cw * ci) * y,
    sw * si * x + cw * si * y,
  ];
}

const vertexShader = `
attribute vec3 el0;   // a, e, i
attribute vec3 el1;   // node, peri, mean anomaly (deg)
attribute float epoch;
attribute float grp;
uniform float days;
uniform float pixelRatio;
uniform float appear;
uniform vec3 colors[6];
varying vec3 vColor;
varying float vAlpha;
const float K = 0.01720209895;
const float D = 0.017453292519943295;
void main() {
  float a = el0.x, e = el0.y;
  float M = mod(el1.z * D + K / pow(a, 1.5) * (days - epoch), 6.283185307179586);
  float E = e < 0.8 ? M : 3.141592653589793;
  for (int k = 0; k < 6; k++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
  float x = a * (cos(E) - e), y = a * sqrt(1.0 - e * e) * sin(E);
  float cO = cos(el1.x * D), sO = sin(el1.x * D), cw = cos(el1.y * D), sw = sin(el1.y * D), ci = cos(el0.z * D), si = sin(el0.z * D);
  vec3 p = vec3((cO * cw - sO * sw * ci) * x + (-cO * sw - sO * cw * ci) * y,
                (sO * cw + cO * sw * ci) * x + (-sO * sw + cO * cw * ci) * y,
                sw * si * x + cw * si * y);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  int g = int(grp + 0.5);
  vColor = colors[g];
  // the belt fades in radially on first load: inner orbits first, then outward
  // The completed reveal includes distant Trojans/Centaurs/TNOs too.
  float reveal = appear >= 1.0 ? 1.0 : clamp(appear * 6.0 - a * 0.9, 0.0, 1.0);
  bool rare = g >= 3;
  vAlpha = (rare ? 0.95 : 0.55) * reveal;
  gl_PointSize = (rare ? 2.6 : 1.7) * pixelRatio;
}`;
const fragmentShader = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  if (r > 0.5) discard;
  gl_FragColor = vec4(vColor, vAlpha * smoothstep(0.5, 0.1, r));
}`;

/** 40 000 real numbered asteroids (NASA/JPL SBDB), propagated on the GPU every frame. */
export class BackgroundBelt {
  points: T.Points | null = null;
  count = 0;
  counts: number[] = GROUPS.map(() => 0);
  private material = new T.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    uniforms: {
      days: { value: 0 },
      pixelRatio: { value: Math.min(devicePixelRatio, 2) },
      appear: { value: 0 },
      colors: { value: GROUPS.map((g) => new T.Color(g.color)) },
    },
  });
  async load(base: string, signal?: AbortSignal) {
    const [el, cls] = await Promise.all([
      fetch(`${base}data/background.bin`, {signal}).then((r) => { if (!r.ok) throw Error(`background.bin ${r.status}`); return r.arrayBuffer(); }),
      fetch(`${base}data/background-class.bin`, {signal}).then((r) => { if (!r.ok) throw Error(`background-class.bin ${r.status}`); return r.arrayBuffer(); }),
    ]);
    signal?.throwIfAborted();
    const f = new Float32Array(el), c = new Uint8Array(cls), n = c.length;
    if (f.length !== n * 7 || n === 0) throw Error("Invalid background element table");
    this.counts.fill(0);
    const el0 = new Float32Array(n * 3), el1 = new Float32Array(n * 3), epoch = new Float32Array(n), grp = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      el0.set([f[i * 7], f[i * 7 + 1], f[i * 7 + 2]], i * 3);
      el1.set([f[i * 7 + 3], f[i * 7 + 4], f[i * 7 + 5]], i * 3);
      epoch[i] = f[i * 7 + 6];
      const g = groupOf(CLASSES[c[i]] ?? "AST");
      grp[i] = g;
      this.counts[g]++;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute("el0", new T.BufferAttribute(el0, 3));
    geo.setAttribute("el1", new T.BufferAttribute(el1, 3));
    geo.setAttribute("epoch", new T.BufferAttribute(epoch, 1));
    geo.setAttribute("grp", new T.BufferAttribute(grp, 1));
    this.points = new T.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = -1;
    this.count = n;
    return this.points;
  }
  dispose() { this.points?.geometry.dispose(); this.material.dispose(); }
  setTime(mjdTdb: number) { this.material.uniforms.days.value = daysSinceRef(mjdTdb); }
  setPixelRatio(r: number) { this.material.uniforms.pixelRatio.value = r; }
  /** 0 → 1 over the intro; returns true while still animating. */
  setAppear(v: number) { this.material.uniforms.appear.value = v; return v < 1; }
}
