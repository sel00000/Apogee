// Small, self-contained teaching diagrams. All plotted measurements are invented examples.
const SVG_NS = 'http://www.w3.org/2000/svg';
let nextId = 0;

export function frequencyTHz(wavelengthMicron) {
  if (!Number.isFinite(wavelengthMicron) || wavelengthMicron <= 0) return NaN;
  return 299.792458 / wavelengthMicron;
}

export function syntheticFlux(wavelengthMicron) {
  const x = wavelengthMicron;
  return 10 + 40 * Math.exp(-((x - 1.2) ** 2) / 0.12)
    + 30 * Math.exp(-((x - 4.2) ** 2) / 0.5)
    - 5 * Math.exp(-((x - 2.4) ** 2) / 0.03);
}

export function uncertaintyExample(count) {
  const n = Math.max(1, Math.min(100, Math.round(Number(count) || 1)));
  const independent = 1 / Math.sqrt(n);
  const shared = 0.3;
  return { n, flux: 10, independent, shared, total: Math.hypot(independent, shared) };
}

export function normalizeRA(degrees) {
  return ((degrees % 360) + 360) % 360;
}

/** Keep labels at their normal CSS size when a narrow card scales down its SVG. */
export function diagramLabelScale(bounds) {
  const scale = Math.min(bounds.width / 440, bounds.height / 172);
  return scale > 0 && Number.isFinite(scale) ? Math.max(1, 1 / scale) : 1;
}

/** Default SVG xMidYMid meet geometry, used when a browser cannot provide an SVG CTM. */
export function fitViewBoxPoint(clientX, clientY, bounds, width = 440, height = 172) {
  const scale = Math.min(bounds.width / width, bounds.height / height);
  if (!(scale > 0) || !Number.isFinite(scale)) return null;
  return {
    x: (clientX - bounds.left - (bounds.width - width * scale) / 2) / scale,
    y: (clientY - bounds.top - (bounds.height - height * scale) / 2) / scale,
  };
}

export function clientToDiagramPoint(svg, clientX, clientY) {
  try {
    const matrix = svg.getScreenCTM?.();
    if (matrix && svg.createSVGPoint) {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const local = point.matrixTransform(matrix.inverse());
      if (Number.isFinite(local.x) && Number.isFinite(local.y)) return { x: local.x, y: local.y };
    }
  } catch { /* Hidden or detached SVGs may have no invertible transform. */ }
  return fitViewBoxPoint(clientX, clientY, svg.getBoundingClientRect());
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function svgNode(tag, attrs = {}, text) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  if (text !== undefined) el.textContent = text;
  return el;
}

function addSvg(parent, tag, attrs, text) {
  const el = svgNode(tag, attrs, text);
  parent.append(el);
  return el;
}

function scaffold(container, title, description) {
  const root = node('section', 'sv-visual');
  root.setAttribute('aria-label', title);
  const heading = node('div', 'sv-visual-heading');
  heading.append(node('span', 'sv-label', '직접 살펴보기'), node('strong', '', title));
  root.append(heading);
  const svg = svgNode('svg', { class: 'sv-diagram', viewBox: '0 0 440 172', role: 'img', 'aria-label': description });
  const graphic = svgNode('g');
  svg.append(graphic);
  root.append(svg);
  const caption = node('p', 'sv-caption');
  caption.id = `sv-caption-${++nextId}`;
  svg.setAttribute('aria-describedby', caption.id);
  root.append(caption);
  const controls = node('div', 'sv-controls');
  const output = node('output', 'sv-readout');
  output.setAttribute('aria-live', 'polite');
  output.setAttribute('aria-atomic', 'true');
  const note = node('p', 'sv-note');
  root.append(controls, output, note);
  container.replaceChildren(root);
  const events = [];
  const resizeLabels = (bounds) => svg.style.setProperty('--sv-label-scale', String(diagramLabelScale(bounds)));
  resizeLabels(svg.getBoundingClientRect());
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) if (entry.target === svg) resizeLabels(entry.contentRect);
    });
    observer.observe(svg);
    events.push(() => observer.disconnect());
  }
  function on(el, event, callback) {
    el.addEventListener(event, callback);
    events.push(() => el.removeEventListener(event, callback));
  }
  return { root, svg, graphic, caption, controls, output, note, on,
    destroy() { events.forEach((off) => off()); if (root.parentNode === container) root.remove(); } };
}

function range(ctx, label, { min, max, step = 1, value }) {
  const id = `sv-input-${++nextId}`;
  const wrap = node('div', 'sv-range');
  const name = node('label', '', label);
  name.htmlFor = id;
  const input = node('input');
  Object.assign(input, { id, type: 'range', min: String(min), max: String(max), step: String(step), value: String(value) });
  wrap.append(name, input);
  ctx.controls.append(wrap);
  return input;
}

function button(ctx, text, callback) {
  const el = node('button', 'sv-button', text);
  el.type = 'button';
  ctx.on(el, 'click', callback);
  ctx.controls.append(el);
  return el;
}

function label(g, x, y, text, className = 'sv-text', anchor = 'start') {
  return addSvg(g, 'text', { x, y, class: className, 'text-anchor': anchor }, text);
}

function hatch(svg) {
  const id = `sv-hatch-${++nextId}`;
  const defs = addSvg(svg, 'defs');
  const pattern = addSvg(defs, 'pattern', { id, width: 7, height: 7, patternUnits: 'userSpaceOnUse' });
  addSvg(pattern, 'rect', { width: 7, height: 7, fill: '#182b3a' });
  addSvg(pattern, 'path', { d: 'M-2 2 L2 -2 M0 7 L7 0 M5 9 L9 5', stroke: '#a7b7c9', 'stroke-width': 1.5 });
  return `url(#${id})`;
}

function wavelength(container, options) {
  const ctx = scaffold(container, '파장은 빛의 물결 사이 간격', '파장 슬라이더를 움직이면 물결의 마루 사이 간격이 달라지는 원리 그림');
  const slider = range(ctx, '파장 λ (마이크로미터)', { min: 75, max: 500, value: 120 });
  const update = () => {
    const lambda = Number(slider.value) / 100;
    const g = ctx.graphic;
    g.replaceChildren();
    addSvg(g, 'line', { x1: 22, y1: 92, x2: 418, y2: 92, class: 'sv-grid' });
    const spacing = lambda * 46;
    const start = 31;
    let path = '';
    for (let x = 22; x <= 418; x += 2) {
      const y = 92 - 31 * Math.cos((x - start) * Math.PI * 2 / spacing);
      path += `${x === 22 ? 'M' : 'L'}${x},${y.toFixed(2)} `;
    }
    addSvg(g, 'path', { d: path, class: 'sv-wave' });
    addSvg(g, 'line', { x1: start, y1: 41, x2: start + spacing, y2: 41, class: 'sv-wavelength-mark' });
    for (const x of [start, start + spacing]) addSvg(g, 'line', { x1: x, y1: 35, x2: x, y2: 50, class: 'sv-wavelength-mark' });
    label(g, 220, 28, `λ = ${lambda.toFixed(2)} µm`, 'sv-gold-text', 'middle');
    label(g, 22, 151, '짧은 간격', 'sv-muted-text');
    label(g, 418, 151, '긴 간격', 'sv-muted-text', 'end');
    slider.setAttribute('aria-valuetext', `${lambda.toFixed(2)} 마이크로미터`);
    ctx.output.textContent = options.track === 'research'
      ? `λ ${lambda.toFixed(2)} µm · ν ${frequencyTHz(lambda).toFixed(2)} THz · 진공에서 λν = c`
      : `${lambda.toFixed(2)} µm — 숫자가 커질수록 물결 사이 간격이 길어져요.`;
    ctx.svg.setAttribute('aria-label', `파장 ${lambda.toFixed(2)} 마이크로미터의 물결 간격 원리 그림`);
  };
  ctx.on(slider, 'input', update);
  ctx.note.textContent = 'µm는 100만 분의 1미터입니다. 그림의 물결 크기와 색은 설명을 위한 표시입니다.';
  update();
  return ctx.destroy;
}

function spectrum(container, options) {
  const ctx = scaffold(container, '그래프에서 한 점 읽기', '가로축 파장, 세로축 Fν 플럭스 밀도인 설명용 가상 스펙트럼');
  const slider = range(ctx, '읽을 파장 (µm)', { min: 75, max: 500, value: 120 });
  const sx = (lambda) => 48 + (lambda - 0.75) / 4.25 * 366;
  const sy = (flux) => 140 - flux / 65 * 105;
  const update = () => {
    const lambda = Number(slider.value) / 100;
    const flux = syntheticFlux(lambda);
    const g = ctx.graphic;
    g.replaceChildren();
    for (const f of [0, 20, 40, 60]) {
      addSvg(g, 'line', { x1: 48, y1: sy(f), x2: 414, y2: sy(f), class: 'sv-grid' });
      label(g, 39, sy(f) + 4, String(f), 'sv-muted-text', 'end');
    }
    for (const x of [1, 2, 3, 4, 5]) label(g, sx(x), 156, String(x), 'sv-muted-text', 'middle');
    label(g, 48, 19, 'Fν (mJy)', 'sv-text');
    let path = '';
    for (let i = 0; i <= 160; i++) {
      const x = 0.75 + 4.25 * i / 160;
      path += `${i ? 'L' : 'M'}${sx(x).toFixed(2)},${sy(syntheticFlux(x)).toFixed(2)} `;
    }
    addSvg(g, 'path', { d: path, class: 'sv-spectrum' });
    addSvg(g, 'line', { x1: sx(lambda), y1: 28, x2: sx(lambda), y2: 140, class: 'sv-cursor' });
    addSvg(g, 'circle', { cx: sx(lambda), cy: sy(flux), r: 5, class: 'sv-selected' });
    slider.setAttribute('aria-valuetext', `${lambda.toFixed(2)} 마이크로미터에서 ${flux.toFixed(1)} 밀리얀스키`);
    ctx.output.textContent = `λ ${lambda.toFixed(2)} µm에서 Fν ${flux.toFixed(1)} mJy`;
  };
  ctx.on(slider, 'input', update);
  ctx.on(ctx.svg, 'click', (event) => {
    const point = clientToDiagramPoint(ctx.svg, event.clientX, event.clientY);
    if (!point || point.x < 48 || point.x > 414 || point.y < 28 || point.y > 140) return;
    const { x } = point;
    slider.value = String(Math.round(Math.max(0.75, Math.min(5, 0.75 + (x - 48) / 366 * 4.25)) * 100));
    update();
  });
  ctx.caption.textContent = '설명용 가상 자료 · 가로축: 파장 λ (µm) · 세로축: Fν (mJy)';
  ctx.note.textContent = options.track === 'research'
    ? 'Fν는 주파수당 플럭스 밀도입니다. 영상의 MJy/sr와 조리개 측광의 mJy는 같은 단위가 아닙니다.'
    : '가로축은 시간이 아니라 파장입니다. 봉우리는 그 파장 부근의 빛이 상대적으로 강하다는 뜻이에요.';
  update();
  return ctx.destroy;
}

function sky(container, options) {
  const ctx = scaffold(container, '하늘에도 주소가 있어요', '적경이 왼쪽으로, 적위가 위쪽으로 증가하는 단순 좌표 원리 그림');
  const slider = range(ctx, '적경 RA (도)', { min: 0, max: 359, value: 120 });
  const update = () => {
    const ra = normalizeRA(Number(slider.value));
    const g = ctx.graphic;
    g.replaceChildren();
    const left = 50, right = 410, top = 27, bottom = 139;
    for (let i = 0; i <= 4; i++) {
      const x = left + (right - left) * i / 4;
      const y = top + (bottom - top) * i / 4;
      addSvg(g, 'line', { x1: x, y1: top, x2: x, y2: bottom, class: 'sv-grid' });
      addSvg(g, 'line', { x1: left, y1: y, x2: right, y2: y, class: 'sv-grid' });
    }
    label(g, left, 17, '적위 +90°', 'sv-muted-text');
    label(g, left, 157, '−90°', 'sv-muted-text');
    label(g, right, 157, '적경 0°', 'sv-muted-text', 'end');
    label(g, 220, 157, '← 적경 증가', 'sv-text', 'middle');
    const x = right - ra;
    const y = top + (90 - 30) / 180 * (bottom - top);
    addSvg(g, 'line', { x1: x, y1: top, x2: x, y2: bottom, class: 'sv-cursor' });
    addSvg(g, 'line', { x1: left, y1: y, x2: right, y2: y, class: 'sv-cursor' });
    addSvg(g, 'circle', { cx: x, cy: y, r: 7, class: 'sv-selected' });
    label(g, 410, 17, '적위는 +30°로 고정', 'sv-gold-text', 'end');
    slider.setAttribute('aria-valuetext', `적경 ${ra}도, 적위 북쪽 30도`);
    ctx.output.textContent = options.track === 'research'
      ? `RA ${ra}° = ${(ra / 15).toFixed(2)}h · Dec +30° · ICRS 좌표 예시`
      : `하늘 주소: 적경 ${ra}°, 적위 +30°`;
  };
  ctx.on(slider, 'input', update);
  ctx.note.textContent = '좌표 개념을 펼쳐 그린 예시입니다. 실제 화면의 투영·시야 방향과는 다를 수 있습니다.';
  update();
  return ctx.destroy;
}

function region(container) {
  const ctx = scaffold(container, '한 점 주변의 네모 영역', '선택한 천구 좌표를 중심으로 한 정사각형 분석 영역의 원리 그림');
  const wrap = node('label', 'sv-select');
  wrap.append(node('span', '', '분석 영역 한 변'));
  const select = node('select');
  for (const value of [2, 3, 5, 10]) {
    const option = node('option', '', `${value}′`);
    option.value = String(value);
    select.append(option);
  }
  select.value = '3';
  wrap.append(select);
  ctx.controls.append(wrap);
  const update = () => {
    const minutes = Number(select.value);
    const g = ctx.graphic;
    g.replaceChildren();
    const stars = [[61,35],[91,126],[120,62],[158,111],[187,37],[220,86],[265,44],[280,126],[316,76],[369,38],[385,130]];
    for (let i = 0; i < stars.length; i++) addSvg(g, 'circle', { cx: stars[i][0], cy: stars[i][1], r: i === 5 ? 4.5 : 1.8, class: i === 5 ? 'sv-selected' : 'sv-star' });
    const size = minutes * 11.8;
    addSvg(g, 'rect', { x: 220 - size / 2, y: 86 - size / 2, width: size, height: size, rx: 2, class: 'sv-region' });
    addSvg(g, 'line', { x1: 208, y1: 86, x2: 232, y2: 86, class: 'sv-cursor' });
    addSvg(g, 'line', { x1: 220, y1: 74, x2: 220, y2: 98, class: 'sv-cursor' });
    label(g, 220, 17, `${minutes}′ × ${minutes}′`, 'sv-gold-text', 'middle');
    label(g, 220, 165, '클릭한 위치 = 영역의 중심', 'sv-text', 'middle');
    ctx.output.textContent = `${minutes}′ × ${minutes}′ · 한 변 ${(minutes / 60).toFixed(3)}° · 1° = 60′`;
  };
  ctx.on(select, 'change', update);
  ctx.note.textContent = '별이 없는 곳도 좌표로 선택할 수 있습니다. 그 영역에 SPHEREx 관측 자료가 있어야 분석할 수 있어요.';
  update();
  return ctx.destroy;
}

function timeline(container) {
  const ctx = scaffold(container, '날짜를 비교하기 전에 조건 확인', '서로 다른 두 날짜의 파장 조건이 맞을 때만 숫자를 비교하는 가상 예시');
  const pattern = hatch(ctx.svg);
  let mismatch = false;
  const toggle = button(ctx, '다른 파장으로 바꿔 보기', () => { mismatch = !mismatch; update(); });
  const update = () => {
    const g = ctx.graphic;
    g.replaceChildren();
    for (const [x, name, wave, value] of [[16,'관측 A','1.20 µm','10.0'],[168,'관측 B',mismatch?'2.20 µm':'1.20 µm','12.0']]) {
      addSvg(g, 'rect', { x, y: 25, width: 122, height: 102, rx: 10, class: 'sv-panel' });
      label(g, x + 61, 48, name, 'sv-text', 'middle');
      label(g, x + 61, 72, wave, 'sv-gold-text', 'middle');
      label(g, x + 61, 105, `${value} mJy`, 'sv-big-text', 'middle');
    }
    label(g, 151, 84, '→', 'sv-text', 'middle');
    label(g, 311, 84, '→', 'sv-text', 'middle');
    addSvg(g, 'rect', { x: 330, y: 25, width: 94, height: 102, rx: 10, class: mismatch ? 'sv-result-mask' : 'sv-result', ...(mismatch ? { fill: pattern } : {}) });
    label(g, 377, 63, mismatch ? '보류' : '차이', 'sv-text', 'middle');
    label(g, 377, 96, mismatch ? '—' : '+2.0', 'sv-big-text', 'middle');
    toggle.textContent = mismatch ? '같은 조건으로 돌아가기' : '다른 파장으로 바꿔 보기';
    toggle.setAttribute('aria-pressed', String(mismatch));
    ctx.output.textContent = mismatch ? '파장이 다른 두 밝기를 빼면 변광처럼 오해할 수 있어요. 여기서는 비교하지 않습니다.' : '예시에서는 비교 조건을 같게 두었습니다. 차이 +2.0 mJy 자체가 변광 확정은 아닙니다.';
  };
  ctx.caption.textContent = '설명용 가상 자료 · 응답·오차 등 다른 조건은 같다고 가정합니다.';
  ctx.note.textContent = '실제 자료에서는 채널 번호뿐 아니라 파장 응답·품질·오차를 함께 확인합니다.';
  update();
  return ctx.destroy;
}

function mask(container) {
  const ctx = scaffold(container, '빗금은 0이 아니라 “비교할 수 없음”', '관측 영상 일부의 제외된 픽셀을 빗금으로 표시한 가상 예시');
  const pattern = hatch(ctx.svg);
  let reasons = true;
  const toggle = button(ctx, '사유 숨기기', () => { reasons = !reasons; update(); });
  const update = () => {
    const g = ctx.graphic;
    g.replaceChildren();
    for (let row = 0; row < 4; row++) for (let col = 0; col < 9; col++) {
      const invalid = (col < 2 && row < 2) || (col === 6 && row >= 1) || (col >= 7 && row === 3);
      const distance = Math.hypot(row - 1.5, col - 4);
      addSvg(g, 'rect', { x: 20 + col * 23, y: 29 + row * 27, width: 22, height: 26,
        fill: invalid ? pattern : `hsl(191 30% ${Math.max(12, 73 - distance * 18)}%)` });
    }
    label(g, 255, 43, reasons ? '제외 이유의 예' : '공통 안내', 'sv-gold-text');
    for (const [i, text] of (reasons ? ['범위 밖', '파장 불일치', '품질 불량'] : ['빗금 = 제외', '검정 = 낮은 값', '0과 구별']).entries()) label(g, 255, 70 + i * 26, text, 'sv-text');
    label(g, 20, 157, '설명용 픽셀 그림', 'sv-muted-text');
    toggle.textContent = reasons ? '사유 숨기기' : '제외 사유 보기';
    toggle.setAttribute('aria-pressed', String(reasons));
    ctx.output.textContent = reasons
      ? '제외 이유의 예: 관측 범위 밖, 공통 파장 없음, 포화·품질 불량. 제외된 픽셀을 0으로 채워 평균이나 밝기 차이를 계산하면 안 됩니다.'
      : '빗금은 비교에서 제외된 값입니다. 검정은 낮은 밝기일 수 있으며, 빗금과 같은 뜻이 아닙니다. 제외된 값을 0으로 바꾸지 마세요.';
  };
  ctx.note.textContent = '실제 뷰어에서는 “사유 보기”를 펼치거나 픽셀에 마우스를 올려 이유를 확인하세요.';
  update();
  return ctx.destroy;
}

function uncertainty(container, options) {
  const ctx = scaffold(container, '반복 관측으로 줄어드는 오차와 남는 오차', '독립 오차는 관측 횟수의 제곱근에 따라 줄지만 공유 오차는 남는 가상 모형');
  const slider = range(ctx, '평균에 넣을 독립 측정 수', { min: 1, max: 25, value: 1 });
  const update = () => {
    const v = uncertaintyExample(slider.value);
    const g = ctx.graphic;
    g.replaceChildren();
    const sx = (flux) => 230 + (flux - 10) * 125;
    for (const flux of [9, 9.5, 10, 10.5, 11]) {
      addSvg(g, 'line', { x1: sx(flux), y1: 33, x2: sx(flux), y2: 130, class: 'sv-grid' });
      label(g, sx(flux), 149, String(flux), 'sv-muted-text', 'middle');
    }
    for (const [y, error, name, css] of [[60,v.independent,'①','sv-stat-error'],[108,v.total,'②','sv-total-error']]) {
      addSvg(g, 'line', { x1: sx(10 - error), y1: y, x2: sx(10 + error), y2: y, class: css });
      for (const x of [sx(10 - error),sx(10 + error)]) addSvg(g, 'line', { x1: x, y1: y - 7, x2: x, y2: y + 7, class: css });
      addSvg(g, 'circle', { cx: sx(10), cy: y, r: 4, class: 'sv-selected' });
      label(g, 18, y + 4, name, 'sv-text');
    }
    label(g, 230, 167, '예시 평균 밝기 (mJy)', 'sv-muted-text', 'middle');
    ctx.output.textContent = `N=${v.n} · 독립 오차 ±${v.independent.toFixed(2)} · 공유 오차 포함 ±${v.total.toFixed(2)} mJy`;
    slider.setAttribute('aria-valuetext', `독립 측정 ${v.n}개`);
  };
  ctx.caption.textContent = '① 위·민트색: 독립 오차 / ② 아래·금색: 공유 오차 포함';
  ctx.on(slider, 'input', update);
  ctx.note.textContent = options.track === 'research'
    ? '설명용 가정: σstat=1 mJy, 완전히 공유된 σsys=0.3 mJy. σ²mean=σ²stat/N+σ²sys. 실제 오차의 상관 구조는 별도로 검증해야 합니다.'
    : '같은 기기에서 함께 생기는 오차는 반복해도 그대로 남을 수 있어요. 이 그림은 실제 관측값이 아닌 설명용 모형입니다.';
  update();
  return ctx.destroy;
}

function provenance(container, options) {
  const ctx = scaffold(container, '결과에서 원본까지 따라가기', '원본 영상, 좌표와 파장, 측정, 결과와 출처로 이어지는 분석 기록 흐름');
  const names = ['원본 영상','좌표·파장','측정·오차','결과·출처'];
  const simple = ['어느 날짜에 찍었는지, 관측 ID와 원본 링크를 남겨요.','어디를, 어떤 파장으로 봤는지 확인해요.','밝기와 함께 불확실성, 제외 이유를 기록해요.','결과와 근거를 JSON·CSV로 저장해 다시 확인해요.'];
  const research = ['노출 ID·릴리스·처리 태그·실제 사용한 노출 목록을 보존합니다.','ICRS/WCS, 파장·채널·대역폭과 보정 파일 식별자를 확인합니다.','원본 VARIANCE, ePSF, 측광 설정·품질·계통오차 항을 확인합니다.','결과·보류 판정과 보정 출처·SHA256을 함께 내보내 재현성을 확보합니다.'];
  let active = 0;
  const buttons = names.map((name, i) => button(ctx, `${i + 1}. ${name}`, () => { active = i; update(); }));
  ctx.controls.classList.add('sv-stages');
  const update = () => {
    const g = ctx.graphic;
    g.replaceChildren();
    names.forEach((name, i) => {
      const x = 10 + i * 110;
      addSvg(g, 'rect', { x, y: 48, width: 91, height: 69, rx: 12, class: i === active ? 'sv-stage-active' : 'sv-panel' });
      label(g, x + 45.5, 73, `0${i + 1}`, i === active ? 'sv-gold-text' : 'sv-muted-text', 'middle');
      label(g, x + 45.5, 98, name, 'sv-text', 'middle');
      if (i < 3) label(g, x + 100, 88, '→', 'sv-muted-text', 'middle');
      buttons[i].setAttribute('aria-pressed', String(active === i));
    });
    label(g, 220, 151, '숫자와 함께 근거를 남깁니다', 'sv-gold-text', 'middle');
    ctx.output.textContent = (options.track === 'research' ? research : simple)[active];
  };
  ctx.note.textContent = '이 안내를 마치고 분석 도구의 “출처” 탭에서 실제 기록을 확인해 보세요.';
  update();
  return ctx.destroy;
}

const visualizers = { sky, region, timeline, wavelength, spectrum, mask, uncertainty, provenance };

/** Mount one accessible teaching diagram. No network requests or real session state changes. */
export function mountVisual(container, kind, options = {}) {
  if (!container || typeof container.replaceChildren !== 'function') return () => {};
  const render = Object.hasOwn(visualizers, kind) ? visualizers[kind] : null;
  if (!render) { container.replaceChildren(); return () => {}; }
  return render(container, { track: options.track === 'research' ? 'research' : 'beginner', step: options.step });
}
