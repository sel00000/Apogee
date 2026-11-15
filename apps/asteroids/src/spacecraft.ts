import { Matrix4, Quaternion, Vector3 } from 'three';
export const EARTH_RADIUS_AU = 6371 / 149597870.7;
/** Illustrative AU size, not the physical size of SPHEREx. GLB boresight +Y, panel normal -Z. */
export const CRAFT_SCALE = EARTH_RADIUS_AU * 0.12;
export function spacecraftAttitude(position: Vector3, pointing: Vector3) {
  const y = pointing.clone().normalize();
  const sun = position.clone().negate().normalize();
  const panel = sun.clone().addScaledVector(y, -sun.dot(y));
  if (panel.lengthSq() < 1e-12) {
    panel.copy(Math.abs(y.z) < .9 ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0));
    panel.addScaledVector(y, -panel.dot(y));
  }
  panel.normalize();
  const z = panel.clone().negate(), x = new Vector3().crossVectors(y, z).normalize();
  return {
    quaternion: new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z)),
    sunAngle: Math.acos(Math.max(-1, Math.min(1, sun.dot(panel)))) * 180 / Math.PI,
  };
}
/** A side-on close-up at real heliocentric coordinates. Earth remains on its orbit. */
export function craftCameraPose(position: Vector3, earth: Vector3, pointing: Vector3, aspect = 1) {
  const outward = position.clone().sub(earth).normalize();
  const side = new Vector3().crossVectors(pointing, outward);
  if (side.lengthSq() < 1e-12) side.crossVectors(outward, Math.abs(outward.z) < .9 ? new Vector3(0,0,1) : new Vector3(1,0,0));
  side.normalize();
  // Either side preserves the Earth/craft separation; prefer the illuminated hemisphere.
  if (side.dot(earth) > 0) side.negate();
  const target = earth.clone().lerp(position, .28);
  const radius = Math.max(EARTH_RADIUS_AU * 1.35, position.distanceTo(target) + CRAFT_SCALE);
  const fov = 42, halfAngle = Math.atan(Math.tan(fov * Math.PI / 360) * Math.min(1, aspect));
  const distance = radius / Math.sin(halfAngle) * 1.25;
  return {position: target.clone().addScaledVector(side, distance), target,
    up: new Vector3().crossVectors(side, outward).normalize(), fov};
}
