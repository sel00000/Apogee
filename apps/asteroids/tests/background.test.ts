// @ts-nocheck — vitest runs this under Node; the app tsconfig has no Node types
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CLASSES, daysSinceRef, keplerPosition } from "../src/background";
import { interpolate } from "../src/math";

const bin = readFileSync(new URL("../public/data/background.bin", import.meta.url));
const f = new Float32Array(bin.buffer, bin.byteOffset, bin.byteLength / 4);
const bodies: { id: string; samples: number[][] }[] = JSON.parse(
  readFileSync(new URL("../public/data/bodies.json", import.meta.url), "utf8"),
).bodies ?? JSON.parse(readFileSync(new URL("../public/data/bodies.json", import.meta.url), "utf8"));

describe("background belt (SBDB elements, two-body)", () => {
  it("places the analysed asteroids where JPL Horizons has them", () => {
    // numbered asteroid N is row N-1; compare with the numerical Horizons ephemeris in bodies.json
    for (const id of ["433", "10", "16", "624"]) {
      const body = bodies.find((b) => b.id === id);
      if (!body) continue;
      const el = f.subarray((Number(id) - 1) * 7, Number(id) * 7);
      const mid = body.samples[Math.floor(body.samples.length / 2)][0]; // MJD TDB
      const k = keplerPosition(el, daysSinceRef(mid));
      const j = interpolate(body.samples, mid);
      const err = Math.hypot(k[0] - j[0], k[1] - j[1], k[2] - j[2]);
      const r = Math.hypot(...j);
      // two-body from the SBDB epoch vs full N-body: well under 1 % of the heliocentric distance
      expect(err / r).toBeLessThan(0.01);
    }
  });
});

it("ships all 40,000 numbered bodies with finite elliptic orbital elements and valid classes", () => {
  const classes = readFileSync(new URL("../public/data/background-class.bin", import.meta.url));
  expect(classes.length).toBe(40000);
  expect(f.length).toBe(40000 * 7);
  for (let i = 0; i < classes.length; i++) {
    const el = f.subarray(i * 7, i * 7 + 7);
    expect(Array.from(el).every(Number.isFinite)).toBe(true);
    expect(el[0]).toBeGreaterThan(0);
    expect(el[1]).toBeGreaterThanOrEqual(0);
    expect(el[1]).toBeLessThan(1);
    expect(classes[i]).toBeLessThan(CLASSES.length);
  }
});
