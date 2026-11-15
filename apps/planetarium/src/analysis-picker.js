/* SPDX-License-Identifier: AGPL-3.0-only */
import { bindSkyClickAnalysis, targetAtSkyPoint } from './sky-click.js';
import { fieldRegionAroundTarget } from './analysis-region.js';

// The preview is the same north-up tangent-plane field passed to the analysis API,
// projected onto the current sky view. It is not a fixed-size decorative box.
export function createAnalysisPicker({ engine, canvas, onTarget, onSelection, canInteract, notify }) {
  const doc = canvas.ownerDocument;
  const button = doc.querySelector('#analysis-pick');
  const size = doc.querySelector('#analysis-field-size');
  const hint = doc.querySelector('#analysis-pick-hint');
  const overlay = doc.querySelector('#analysis-picker-overlay');
  const outline = doc.querySelector('#analysis-picker-outline');
  const crosshair = doc.querySelector('#analysis-picker-crosshair');
  const label = doc.querySelector('#analysis-picker-label');
  const skyHint = doc.querySelector('#sky-hint');
  let active = false;
  let inside = false;
  let point;
  let animation;
  let lastDraw = 0;
  const normalHint = '일반 클릭은 별·별자리 정보를 표시합니다. 분석하려면 버튼을 누른 뒤 네모 영역을 선택하세요.';
  const fieldSize = () => Number(size.value);
  const fieldLabel = () => `${fieldSize() / 60}′ × ${fieldSize() / 60}′`;
  // SVGElement does not reflect `.hidden` like HTMLElement does.
  const hideOverlay = hidden => overlay.toggleAttribute('hidden', hidden);

  function regionAt(position) {
    const target = targetAtSkyPoint(engine, position, canvas);
    if (!target) return null;
    const region = fieldRegionAroundTarget(engine, { ...target, label: '선택한 네모 영역' }, canvas, fieldSize());
    const rect = canvas.getBoundingClientRect();
    return region?.points.every(p => p.x >= 0 && p.y >= 0 && p.x <= rect.width && p.y <= rect.height) ? region : null;
  }

  function draw() {
    if (!active || !inside || !point || !canInteract()) { hideOverlay(true); return; }
    const region = regionAt(point);
    if (!region) { hideOverlay(true); return; }
    const rect = canvas.getBoundingClientRect();
    const origin = canvas.offsetParent?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    overlay.setAttribute('style', `left:${rect.left - origin.left}px;top:${rect.top - origin.top}px;right:auto;bottom:auto;width:${rect.width}px;height:${rect.height}px`);
    overlay.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    outline.setAttribute('points', region.points.map(p => `${p.x},${p.y}`).join(' '));
    const { x, y } = region.center;
    crosshair.setAttribute('d', `M${x - 6},${y}h12 M${x},${y - 6}v12`);
    label.setAttribute('x', String(Math.max(12, Math.min(rect.width - 180, x + 16))));
    label.setAttribute('y', String(Math.max(24, Math.min(rect.height - 20, y - 16))));
    label.textContent = `${fieldLabel()} · 클릭하여 분석`;
    hideOverlay(false);
  }

  function animate(time) {
    if (!active) return;
    if (time - lastDraw >= 40) { draw(); lastDraw = time; }
    animation = requestAnimationFrame(animate);
  }

  function makeFieldVisible() {
    // At a whole-sky scale a 3 arcminute field is below one screen pixel.
    // Zoom only when needed; the actual selected region never silently grows.
    const previewFov = fieldSize() / 3600 * 20 * Math.PI / 180;
    if (engine.core.fov > previewFov) {
      engine.zoomTo(previewFov, 0.3);
      notify(`분석 범위 ${fieldLabel()}가 보이도록 확대했습니다. 드래그로 이동한 뒤 네모 영역을 클릭하세요.`);
    }
  }

  function setActive(value) {
    if (value && !canInteract()) return;
    active = value;
    button.setAttribute('aria-pressed', String(active));
    doc.body.classList.toggle('analysis-picking', active);
    skyHint.textContent = active ? '네모 영역 클릭하여 분석 · Esc로 취소 · 드래그로 이동'
      : '클릭하여 천체 정보 · 드래그로 하늘 이동 · 스크롤로 확대 / 축소';
    hint.textContent = active
      ? `분석 범위 ${fieldLabel()} · 네모를 원하는 곳에 놓고 클릭하세요. Esc 또는 버튼을 다시 누르면 취소됩니다.`
      : normalHint;
    cancelAnimationFrame(animation);
    hideOverlay(true);
    if (active) {
      const rect = canvas.getBoundingClientRect();
      point = { x: rect.width / 2, y: rect.height / 2 };
      inside = true;
      makeFieldVisible();
      canvas.focus({ preventScroll: true });
      draw();
      animation = requestAnimationFrame(animate);
    }
  }

  function analyzeAt(position) {
    if (!active || !canInteract()) return;
    const region = regionAt(position);
    if (!region) {
      notify('네모 전체가 하늘 안에 들어오도록 위치를 옮겨 주세요.');
      return;
    }
    setActive(false);
    onTarget(region.target);
  }

  button.disabled = false;
  size.disabled = false;
  hint.textContent = normalHint;
  button.addEventListener('click', () => setActive(!active));
  size.addEventListener('change', () => {
    if (!active) return;
    hint.textContent = `분석 범위 ${fieldLabel()} · 클릭하여 분석 / Esc로 취소`;
    makeFieldVisible();
    draw();
  });
  canvas.addEventListener('pointermove', event => {
    const rect = canvas.getBoundingClientRect();
    point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    inside = true;
    if (active) draw();
  }, { passive: true });
  canvas.addEventListener('pointerleave', () => { inside = false; hideOverlay(true); });
  canvas.addEventListener('pointerdown', event => {
    const rect = canvas.getBoundingClientRect();
    point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    inside = true;
    if (active) draw();
  }, { passive: true });
  doc.addEventListener('keydown', event => {
    if (active && event.key === 'Escape' && canInteract()) {
      event.preventDefault();
      setActive(false);
      button.focus({ preventScroll: true });
    }
  });
  canvas.addEventListener('keydown', event => {
    if (active && event.key === 'Enter' && point) {
      event.preventDefault();
      analyzeAt(point);
    }
  });
  doc.addEventListener('visibilitychange', () => { if (doc.hidden && active) setActive(false); });
  bindSkyClickAnalysis({ engine, canvas, canAnalyze: canInteract, isAnalysisMode: () => active,
    onSelection, onTarget: (_target, position) => analyzeAt(position) });
  return { cancel: () => setActive(false), get active() { return active; } };
}
