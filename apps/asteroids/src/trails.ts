import { t } from "./i18n";
import type { ImageTrail, TrailPoint } from "./types";
export function visibleTrail(trail: ImageTrail | undefined): TrailPoint[] {
  return (
    trail?.points.filter(
      (p) => p.inside && Number.isFinite(p.x) && Number.isFinite(p.y),
    ) ?? []
  );
}
/** Endpoints refer to the full time sequence, never to the currently displayed frame. */
export function trailEndpoints(trail: ImageTrail | undefined): TrailPoint[] {
  if (!trail?.points.length) return [];
  const ordered = [...trail.points].sort((a, b) => a.mjd - b.mjd || a.order - b.order);
  return [ordered[0], ...(ordered.length > 1 ? [ordered[ordered.length - 1]] : [])];
}
/** Motion on the image: the first and last exposures as two rings joined by straight segments
 *  through every on-image exposure (real JPL positions at each exposure time), the traversed part
 *  solid and the rest dashed. The current exposure is a gold ring; `glide` lets it slide along the
 *  path from the previous exposure instead of jumping. Coordinates never come from another grid. */
export function drawTrail(
  ctx: CanvasRenderingContext2D,
  trail: ImageTrail | undefined,
  width: number,
  height: number,
  size = 512,
  glide?: { x: number; y: number },
) {
  const points = visibleTrail(trail),
    current = trail?.points.find((p) => p.id === trail.currentId);
  if (!current) return;
  const xy = (p: TrailPoint) => [((p.x! + 0.5) * size) / width, ((p.y! + 0.5) * size) / height];
  const AMBER = "#e0a458", SAND = "rgba(194,173,142,.75)", GOLD = "#f2cf6b", INK = "rgba(6,8,12,.85)";
  ctx.save();
  ctx.lineCap = "round";
  // straight segments between consecutive on-image exposures (never bridging a gap outside the field)
  for (let i = 1; i < (trail?.points.length ?? 0); i++) {
    const a = trail!.points[i - 1], b = trail!.points[i];
    if (!a.inside || !b.inside) continue;
    const [x, y] = xy(a), [u, v] = xy(b);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(u, v);
    ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.stroke();
    const done = b.order <= current.order;
    ctx.strokeStyle = done ? AMBER : SAND;
    ctx.lineWidth = done ? 1.6 : 1.1;
    ctx.setLineDash(done ? [] : [4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // end rings come from the whole sequence; an endpoint outside the image is not pinned to the edge
  const onImage = (p?: TrailPoint) => (p && p.inside && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null);
  const [e0, e1] = trailEndpoints(trail);
  const first = onImage(e0), last = onImage(e1);
  const ring = (x: number, y: number, r: number, color: string, w: number) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = INK; ctx.lineWidth = w + 3; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  };
  const label = (text: string, x: number, y: number, color: string) => {
    ctx.font = "600 11px -apple-system, 'Apple SD Gothic Neo', sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeText(text, x, y);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  };
  // intermediate exposures: small dots on the line
  for (const p of points) {
    if (p === first || p === last) continue;
    const [x, y] = xy(p);
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fillStyle = p.order <= current.order ? AMBER : SAND; ctx.fill();
  }
  // the two end rings
  if (first) { const [x, y] = xy(first); ring(x, y, 8, AMBER, 1.6); label(t("o.trailFirst"), x + 12, y - 10, AMBER); }
  if (last && last !== first) { const [x, y] = xy(last); ring(x, y, 8, SAND, 1.6); label(t("o.trailLast"), x + 12, y - 10, SAND); }
  // the current exposure: a gold ring that glides along the path
  if (current.inside && Number.isFinite(current.x) && Number.isFinite(current.y)) {
    const [cx, cy] = glide ? [glide.x, glide.y] : xy(current);
    ring(cx, cy, 11, GOLD, 2);
    label(`${current.order}`, cx + 15, cy + 12, GOLD);
  }
  // keep the source cores visible
  ctx.globalCompositeOperation = "destination-out";
  for (const p of points) {
    const [x, y] = xy(p);
    ctx.beginPath(); ctx.arc(x, y, p.id === current.id ? 4 : 1.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
/** Pixel position (canvas units) of the current exposure, for gliding between frames. */
export function currentPoint(trail: ImageTrail | undefined, width: number, height: number, size = 512) {
  const c = trail?.points.find((p) => p.id === trail.currentId);
  if (!c || !c.inside || !Number.isFinite(c.x) || !Number.isFinite(c.y)) return null;
  return { x: ((c.x! + 0.5) * size) / width, y: ((c.y! + 0.5) * size) / height };
}
export function trailDescription(trail: ImageTrail | undefined) {
  if (!trail) return t("tr.none");
  if (trail.points.length === 1)
    return t("tr.single");
  const visible = visibleTrail(trail).length,
    outside = trail.points.length - visible;
  return t("tr.count", { order: String(trail.points.find((p) => p.id === trail.currentId)?.order), total: trail.points.length, visible, outside: outside ? t("tr.outside", { n: outside }) : "" });
}
