/* SPHEREx Sky Lab planetarium — SPDX-License-Identifier: AGPL-3.0-only */
import { capitals } from './capitals.js';
import { constellationNames } from './constellation-names.js';
import { createAnalysisController } from './analysis.js';
import { createAnalysisPicker } from './analysis-picker.js';
import { integrationPaused, registerIntegration, shareView } from './integration.js';
import { sanitizeViewState } from './view-state.js';
import { mountSupplemental } from './supplemental.js';
let analysisPicker = null;

const $ = (selector) => document.querySelector(selector);
const rad = Math.PI / 180;
const base = new URL('../', import.meta.url);
const asset = (path) => new URL(path, base).href;
const presets = {
  seoul: { name: '서울', country: '대한민국', cityEnglish: 'Seoul', countryCode: 'KR', latitude: 37.5665, longitude: 126.9780, elevation: 38 },
  jinju: { name: '진주', country: '대한민국', cityEnglish: 'Jinju', countryCode: 'KR', latitude: 35.1806, longitude: 128.1076, elevation: 28 },
  busan: { name: '부산', country: '대한민국', cityEnglish: 'Busan', countryCode: 'KR', latitude: 35.1796, longitude: 129.0756, elevation: 30 },
};
for (const [id, place] of Object.entries(presets)) place.id = id;
const countryNamesEnglish = new Intl.DisplayNames(['en'], { type: 'region' });
const countryAliases = { AU: '호주', KR: '한국 South Korea', KP: '북한 North Korea', US: 'USA 미합중국', GB: 'UK', ZA: '남아공 남아프리카공화국', AE: 'UAE', SA: '사우디' };
const capitalLocations = capitals.map((capital) => ({ ...capital, name: `${capital.country} · ${capital.city}`, countryEnglish: countryNamesEnglish.of(capital.countryCode), aliases: countryAliases[capital.countryCode], elevation: capital.elevation ?? 0 }))
  .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
const locations = new Map([...Object.values(presets), ...capitalLocations].map((place) => [place.id, place]));
const customStorageKey = 'stellarium-web-lab.custom-location';
let customLocation = { latitude: presets.seoul.latitude, longitude: presets.seoul.longitude };
try {
  const saved = JSON.parse(localStorage.getItem(customStorageKey));
  if (saved && Number.isFinite(saved.latitude) && Number.isFinite(saved.longitude) && Math.abs(saved.latitude) <= 90 && Math.abs(saved.longitude) <= 180) customLocation = saved;
} catch { /* Coordinates remain usable when browser storage is unavailable. */ }
const objects = [
  { name: '달', id: 'Moon', aliases: ['moon', '달'], type: '지구의 위성', fov: 6 },
  { name: '태양', id: 'Sun', aliases: ['sun', '태양', '해'], type: '항성', fov: 8 },
  { name: '수성', id: 'Mercury', aliases: ['mercury', '수성'], type: '행성', fov: 12 },
  { name: '금성', id: 'Venus', aliases: ['venus', '금성', '샛별'], type: '행성', fov: 12 },
  { name: '화성', id: 'Mars', aliases: ['mars', '화성'], type: '행성', fov: 12 },
  { name: '목성', id: 'Jupiter', aliases: ['jupiter', '목성'], type: '행성', fov: 8 },
  { name: '토성', id: 'Saturn', aliases: ['saturn', '토성'], type: '행성', fov: 8 },
  { name: '천왕성', id: 'Uranus', aliases: ['uranus', '천왕성'], type: '행성', fov: 12 },
  { name: '해왕성', id: 'Neptune', aliases: ['neptune', '해왕성'], type: '행성', fov: 12 },
  { name: '북극성', id: 'Polaris', aliases: ['polaris', '북극성'], type: '항성', fov: 24 },
  { name: '시리우스', id: 'Sirius', aliases: ['sirius', '시리우스'], type: '항성', fov: 24 },
  { name: '베가', id: 'Vega', aliases: ['vega', '베가', '직녀성'], type: '항성', fov: 24 },
  { name: '알타이르', id: 'Altair', aliases: ['altair', '알타이르', '견우성'], type: '항성', fov: 24 },
  { name: '베텔게우스', id: 'Betelgeuse', aliases: ['betelgeuse', '베텔게우스'], type: '항성', fov: 24 },
  { name: '안드로메다 은하', id: 'M 31', aliases: ['m31', 'm 31', 'andromeda', '안드로메다'], type: '은하 · M 31', fov: 8 },
  { name: '오리온 성운', id: 'M 42', aliases: ['m42', 'm 42', 'orion', '오리온 성운'], type: '성운 · M 42', fov: 5 },
  { name: '플레이아데스', id: 'M 45', aliases: ['m45', 'm 45', 'pleiades', '플레이아데스', '좀생이별'], type: '산개성단 · M 45', fov: 10 },
];
let stel;
let currentLocation = { ...presets.seoul };
const MAX_TIME_SPEED = 1_000_000;
const TIME_SPEED_HINT = '입력 후 Enter 또는 다른 칸 클릭 · 음수는 역방향';
let speedInputDirty = false;
let toastTimer;
let startupTimer;
let statusTimer;
let dssAdded = false;
let ready = false;
let timeInputDirty = false;
let coordinateMode = 'horizon';
let coordinateChangeId = 0;
let coordinateTransition = false;
let viewMode = 'sky';
let viewTransition = false;
let savedSkyView = null;
const MOLLWEIDE_PROJECTION = 5;
const normalize = (value) => value.toLocaleLowerCase().replace(/\s+/g, '').trim();

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5500);
}

function toLocalInput(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fail(message, error) {
  ready = false;
  clearTimeout(startupTimer);
  clearInterval(statusTimer);
  for (const button of document.querySelectorAll('.view-controls button')) button.disabled = true;
  $('#loading-overlay').hidden = false;
  $('#loading-overlay').classList.add('error');
  $('#loading-message').textContent = message;
  $('#retry-button').hidden = false;
  $('#engine-status').textContent = '연결 확인 필요';
  $('#engine-status').dataset.state = 'error';
  $('#app-controls').disabled = true;
  if (error) console.error(error);
}

function changeLocation(location) {
  currentLocation = { ...location };
  stel.observer.latitude = location.latitude * rad;
  stel.observer.longitude = location.longitude * rad;
  stel.observer.elevation = location.elevation ?? 0;
  $('#latitude').value = String(location.latitude);
  $('#longitude').value = String(location.longitude);
  $('#location-status').textContent = `${location.name} · ${Math.abs(location.latitude).toFixed(2)}°${location.latitude >= 0 ? 'N' : 'S'} ${Math.abs(location.longitude).toFixed(2)}°${location.longitude >= 0 ? 'E' : 'W'}`;
  // Nearby bodies have observer-dependent positions even while time is paused.
  analysis.updateSelection();
  updateSelectionMagnitude();
}

function populateLocations(query = '') {
  const select = $('#location-preset');
  const previous = select.value || 'seoul';
  const match = (place) => !query || normalize([place.name, place.country, place.city, place.countryCode, place.cityEnglish, place.countryEnglish, place.aliases].filter(Boolean).join(' ')).includes(normalize(query));
  select.replaceChildren(new Option('사용자 위치 · 위도/경도 입력', 'custom'));
  const addGroup = (label, places) => {
    if (!places.length) return;
    const group = document.createElement('optgroup');
    group.label = label;
    for (const place of places) group.append(new Option(place.name, place.id));
    select.append(group);
  };
  const nearby = Object.values(presets).filter(match);
  const matches = capitalLocations.filter(match);
  addGroup('빠른 위치 · 대한민국', nearby);
  addGroup('국가·지역별 수도', matches);
  const selected = locations.get(previous);
  if (selected && ![...nearby, ...matches].some((place) => place.id === previous)) addGroup('현재 선택한 위치', [selected]);
  select.value = previous;
  $('#location-search-status').textContent = query ? `${nearby.length + matches.length}개 위치 검색됨` : `국가·지역별 수도 ${capitalLocations.length}곳`;
}

function saveCustomLocation(latitude, longitude) {
  customLocation = { latitude, longitude };
  try { localStorage.setItem(customStorageKey, JSON.stringify(customLocation)); } catch { /* Storage is optional. */ }
}

function syncTime() {
  const date = stel.MJD2date(stel.observer.utc);
  $('#time-status').textContent = new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    timeZoneName: 'short',
  }).format(date);
  if (!timeInputDirty && document.activeElement !== $('#observation-time')) $('#observation-time').value = toLocalInput(date);
  $('#fov-status').textContent = `${(stel.core.fov / rad).toFixed(1)}°`;
  $('#map-fov').textContent = `${(stel.core.fov / rad).toFixed(1)}°`;
  syncCoordinates();
  // Update changing values without rebuilding names, descriptions or the card.
  // This follows moving bodies during forward/reverse time playback.
  analysis.updateSelection();
  updateSelectionMagnitude();
}

function centerDirection(frame) {
  return stel.convertFrame(stel.observer, 'VIEW', frame, [0, 0, -1, 0]);
}

function setFovImmediately(fov) {
  // The engine's duration=0 path leaves an older zoom animation active.
  // A near-instant target replaces it so startup/reset cannot snap back.
  stel.core.fov = fov;
  stel.zoomTo(fov, 0.001);
}

function formatRightAscension(angle) {
  // Round before splitting so a minute/second rollover never displays 60.
  const ticks = Math.round(stel.anp(angle) * 43200000 / Math.PI) % 86400000;
  const seconds = ticks / 1000;
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(Math.floor(seconds / 3600))}h ${pad(Math.floor(seconds / 60) % 60)}m ${(seconds % 60).toFixed(3).padStart(6, '0')}s`;
}

function syncCoordinates() {
  const equatorial = coordinateMode === 'equatorial';
  const [longitude, latitude] = stel.c2s(centerDirection(equatorial ? 'ASTROM' : 'OBSERVED'));
  $('#coordinate-longitude-label').textContent = equatorial ? '적경 RA' : '방위각 Az';
  $('#coordinate-latitude-label').textContent = equatorial ? '적위 Dec' : '고도 Alt';
  $('#coordinate-longitude').textContent = equatorial ? formatRightAscension(longitude) : `${(stel.anp(longitude) / rad).toFixed(3)}°`;
  $('#coordinate-latitude').textContent = `${latitude < 0 ? '−' : '+'}${Math.abs(latitude / rad).toFixed(equatorial ? 6 : 3)}°`;
  $('#coordinate-reference').textContent = equatorial ? '화면 중심 · ICRS' : '화면 중심 · 지평 좌표';
}

async function setCoordinateMode(mode, { updateGrid = true } = {}) {
  if (coordinateTransition || !['horizon', 'equatorial'].includes(mode) || (viewMode === 'allsky' && mode !== 'equatorial')) return;
  coordinateTransition = true;
  syncViewControls();
  try {
    const changeId = ++coordinateChangeId;
    const direction = centerDirection('ICRF');
    // Stop a previous object-tracking animation before changing the mount axes.
    stel.core.lock = null;
    stel.lookAt(centerDirection('MOUNT'), 0);
    coordinateMode = mode;
    const equatorial = mode === 'equatorial';
    stel.core.mount_frame = equatorial ? stel.FRAME_ICRF : stel.FRAME_OBSERVED;
    $('#coordinate-system').value = mode;
    $('#equatorial-target').hidden = !equatorial;
    $('#center-marker').hidden = !equatorial;
    $('#toggle-coordinates').setAttribute('aria-pressed', String(equatorial));
    $('#toggle-coordinates').setAttribute('aria-label', equatorial ? '지평 좌표계로 전환' : '천구 좌표계로 전환');
    $('#coordinate-hint').textContent = equatorial
      ? '격자·표시·입력·분석 좌표는 ICRS 기준입니다. 지평선 아래는 지표면을 끄고 보세요.'
      : '관측 위치의 지평선을 기준으로 방위각과 고도를 표시합니다.';
    if (updateGrid) {
      $('#layer-equatorial').checked = equatorial;
      $('#layer-azimuthal').checked = !equatorial;
      layer('equatorial', equatorial);
      layer('azimuthal', !equatorial);
    }
    // The engine refreshes its mount transform during the animation frame.
    // Keep the same celestial point centered after that transform is available.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (changeId !== coordinateChangeId) return;
    stel.lookAt(stel.convertFrame(stel.observer, 'ICRF', 'MOUNT', direction), 0);
    await new Promise(requestAnimationFrame);
    syncCoordinates();
  } finally {
    coordinateTransition = false;
    syncViewControls();
  }
}

function syncViewControls() {
  const allsky = viewMode === 'allsky';
  const busy = !ready || coordinateTransition || viewTransition;
  document.body.classList.toggle('allsky-view', allsky);
  $('#app-controls').disabled = busy;
  $('#sky-canvas').inert = busy;
  for (const button of document.querySelectorAll('.view-controls button, [data-view], #map-full-view')) button.disabled = busy;
  for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === viewMode));
  $('#toggle-allsky').setAttribute('aria-pressed', String(allsky));
  $('#toggle-allsky').setAttribute('aria-label', allsky ? '하늘 보기로 돌아가기' : '전천 지도로 전환');
  $('#toggle-coordinates').disabled = busy || allsky;
  $('#toggle-ground').disabled = busy || allsky;
  $('#coordinate-system').disabled = allsky;
  $('#layer-landscape').disabled = allsky;
  $('#layer-atmosphere').disabled = allsky;
  $('#map-banner').hidden = !allsky;
  $('#reset-view').title = allsky ? '전천 지도 전체 보기' : '시야 초기화';
  $('#analysis-pick').disabled = busy;
  $('#analysis-field-size').disabled = busy;
  $('#sky-hint').textContent = document.body.classList.contains('analysis-picking')
    ? '네모 영역 클릭하여 분석 · Esc로 취소 · 드래그로 이동'
    : `클릭하여 천체 정보 · 드래그로 ${allsky ? '지도' : '하늘'} 이동 · 스크롤로 확대 / 축소`;
  if (allsky) $('#coordinate-hint').textContent = '360° 천구를 펼친 지도입니다. 표시·입력·분석 좌표는 ICRS 기준이며, 지형과 대기는 숨깁니다.';
  fitSkyCanvas();
}

function fitSkyCanvas() {
  const canvas = $('#sky-canvas');
  const marker = $('#center-marker');
  if (viewMode !== 'allsky') {
    for (const property of ['left', 'top', 'right', 'bottom', 'width', 'height']) canvas.style.removeProperty(property);
    marker.style.removeProperty('left');
    marker.style.removeProperty('top');
    return;
  }
  const panelOpen = !document.body.classList.contains('panel-closed') && innerWidth > 760;
  const left = panelOpen ? $('#control-panel').getBoundingClientRect().right + 24 : 16;
  $('#map-banner').style.left = `${left}px`;
  const right = innerWidth < 760 ? 64 : 96;
  const top = $('.topbar').getBoundingClientRect().bottom + 96;
  const bottom = innerHeight - $('.observation-status').getBoundingClientRect().top + 24;
  const availableWidth = Math.max(80, innerWidth - left - right);
  const availableHeight = Math.max(40, innerHeight - top - bottom);
  // Mollweide's full-sky ellipse is 2:1. Fit it without cropping either pole.
  const width = Math.min(availableWidth, availableHeight * 2);
  const height = width / 2;
  const x = left + (availableWidth - width) / 2;
  const y = top + (availableHeight - height) / 2;
  Object.assign(canvas.style, { left: `${x}px`, top: `${y}px`, right: 'auto', bottom: 'auto', width: `${width}px`, height: `${height}px` });
  marker.style.left = `${x + width / 2}px`;
  marker.style.top = `${y + height / 2}px`;
}

async function setViewMode(mode) {
  if (viewTransition || coordinateTransition || !['sky', 'allsky'].includes(mode) || mode === viewMode) return;
  viewTransition = true;
  syncViewControls();
  try {
    if (mode === 'allsky') {
      savedSkyView = {
        coordinateMode, direction: centerDirection('ICRF'), fov: stel.core.fov, projection: stel.core.projection, cardinals: stel.core.cardinals.visible,
        layers: Object.fromEntries([...document.querySelectorAll('[data-layer]')].map((input) => [input.dataset.layer, input.checked])),
      };
      await setCoordinateMode('equatorial');
      viewMode = 'allsky';
      stel.core.projection = MOLLWEIDE_PROJECTION;
      stel.core.cardinals.visible = false;
      for (const name of ['landscape', 'atmosphere', 'azimuthal']) {
        $(`[data-layer="${name}"]`).checked = false;
        layer(name, false);
      }
      syncViewControls();
      resetView();
      if (innerWidth < 760) setPanel(false);
    } else {
      viewMode = 'sky';
      setFovImmediately(Math.min(savedSkyView.fov, 150 * rad));
      stel.core.projection = savedSkyView.projection;
      stel.core.cardinals.visible = savedSkyView.cardinals;
      await setCoordinateMode(savedSkyView.coordinateMode, { updateGrid: false });
      for (const [name, enabled] of Object.entries(savedSkyView.layers)) {
        $(`[data-layer="${name}"]`).checked = enabled;
        layer(name, enabled);
      }
      stel.lookAt(stel.convertFrame(stel.observer, 'ICRF', 'MOUNT', savedSkyView.direction), 0);
      setFovImmediately(Math.min(savedSkyView.fov, 150 * rad));
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    syncTime();
  } finally {
    viewTransition = false;
    syncViewControls();
  }
}

function goToEquatorialCoordinates(event) {
  event.preventDefault();
  const ra = $('#target-ra').valueAsNumber;
  const dec = $('#target-dec').valueAsNumber;
  if (!Number.isFinite(ra) || ra < 0 || ra > 24 || !Number.isFinite(dec) || Math.abs(dec) > 90) {
    toast('적경은 0~24시간, 적위는 −90~+90°로 입력하세요.');
    return;
  }
  const direction = stel.s2c((ra % 24) * 15 * rad, dec * rad);
  stel.core.selection = null;
  stel.core.lock = null;
  // lookAt's direction follows the active mount, including equatorial mode.
  stel.lookAt(stel.convertFrame(stel.observer, 'ASTROM', 'MOUNT', direction), 0.5);
  renderSelection();
  toast(`적경 ${ra % 24}h · 적위 ${dec}°로 이동합니다.`);
}

function setSpeed(speed) {
  if (!Number.isFinite(speed)) return;
  const limitedSpeed = Math.max(-MAX_TIME_SPEED, Math.min(MAX_TIME_SPEED, speed));
  speedInputDirty = false;
  $('#time-speed-input').value = String(limitedSpeed);
  $('#time-speed-input').removeAttribute('aria-invalid');
  $('#time-speed-hint').textContent = TIME_SPEED_HINT;
  stel.core.time_speed = limitedSpeed;
  syncSpeedControls();
}

function syncSpeedControls() {
  const speed = stel.core.time_speed;
  $('#time-backward').classList.toggle('is-active', speed < 0);
  $('#time-stop').setAttribute('aria-pressed', String(speed === 0));
  $('#time-forward').classList.toggle('is-active', speed > 0);
  $('#time-backward').disabled = speed <= -MAX_TIME_SPEED;
  $('#time-forward').disabled = speed >= MAX_TIME_SPEED;
  $('#time-state').textContent = speed === 0 ? '정지' : speed === 1 ? '실시간' : speed > 0 ? '정방향' : '역방향';
  const magnitude = Math.abs(speed);
  const multiplier = magnitude > 0 && magnitude < 0.001
    ? Number(magnitude.toPrecision(6)).toExponential()
    : magnitude.toLocaleString('ko-KR', { maximumSignificantDigits: 6 });
  $('#time-multiplier').textContent = `×${multiplier}`;
  $('#time-speed').title = `현재 시간 배속: ${speed}`;
  if (!speedInputDirty && document.activeElement !== $('#time-speed-input')) $('#time-speed-input').value = String(speed);
}

function applyTypedSpeed(reportError = true) {
  if (!ready) return;
  const input = $('#time-speed-input');
  const speed = input.valueAsNumber;
  if (!Number.isFinite(speed) || Math.abs(speed) > MAX_TIME_SPEED) {
    input.setAttribute('aria-invalid', 'true');
    $('#time-speed-hint').textContent = '배속은 −1,000,000~1,000,000 사이의 숫자로 입력하세요.';
    if (reportError) input.reportValidity();
    return;
  }
  setSpeed(speed);
}

function stepTimeSpeed(direction) {
  let speed = stel.core.time_speed;
  // Match Stellarium's 10-fold time-step controls through reverse, stop and +1.
  if (direction > 0) {
    if (speed >= 1) speed *= 10;
    else if (speed < -1) speed /= 10;
    else speed = speed >= 0 ? 1 : 0;
  } else {
    if (speed > 1) speed /= 10;
    else if (speed <= -1) speed *= 10;
    else speed = speed <= 0 ? -1 : 0;
  }
  setSpeed(speed);
}

function resetView() {
  ++coordinateChangeId;
  stel.core.selection = null;
  stel.core.lock = null;
  const direction = coordinateMode === 'equatorial'
    ? stel.convertFrame(stel.observer, 'ASTROM', 'MOUNT', stel.s2c(0, 0))
    : stel.s2c(0, 15 * rad);
  stel.lookAt(direction, 0);
  if (viewMode === 'allsky') setFovImmediately(360 * rad);
  else stel.zoomTo(100 * rad, 0.5);
  renderSelection();
}

function layer(name, enabled) {
  if (viewMode === 'allsky' && ['landscape', 'atmosphere'].includes(name)) enabled = false;
  const c = stel.core;
  switch (name) {
    case 'constellations': c.constellations.lines_visible = enabled; break;
    case 'labels': c.constellations.labels_visible = enabled; break;
    case 'atmosphere': c.atmosphere.visible = enabled; break;
    case 'landscape':
      c.landscapes.visible = enabled;
      c.landscapes.fog_visible = enabled;
      syncGroundControls();
      break;
    case 'equatorial': c.lines.equatorial.visible = enabled; break;
    case 'azimuthal': c.lines.azimuthal.visible = enabled; break;
    case 'dss':
      if (enabled && !dssAdded) {
        c.dss.addDataSource({ url: 'https://irsa.ipac.caltech.edu/data/hips/CDS/DSS2/color' });
        dssAdded = true;
      }
      c.dss.visible = enabled;
      if (enabled) toast('DSS 실제 관측 영상: 시야를 10° 이하로 확대하세요. 인터넷 연결이 필요합니다.');
      break;
  }
}

function syncGroundControls() {
  const enabled = Boolean(stel.core.landscapes.visible);
  $('#layer-landscape').checked = enabled;
  $('#toggle-ground').setAttribute('aria-pressed', String(enabled));
  const label = `지표면 ${enabled ? '끄기' : '켜기'} (G)`;
  $('#toggle-ground').setAttribute('aria-label', label);
  $('#toggle-ground').title = label;
}

function toggleGround() {
  if (!ready) return;
  if (viewMode === 'allsky') return toast('전천 지도에서는 지표면을 숨깁니다. 하늘 보기로 돌아가면 복원됩니다.');
  const enabled = !stel.core.landscapes.visible;
  layer('landscape', enabled);
  toast(enabled ? '지표면을 켰습니다.' : '지표면을 껐습니다. 지평선 아래의 하늘도 볼 수 있습니다.');
}

function getObject(id) {
  return stel.getObj(`NAME ${id}`) || stel.getObj(id);
}

function updateSelectionMagnitude() {
  const object = stel.core.selection;
  const magnitude = object ? object.getInfo('vmag', stel.observer) : NaN;
  const field = $('#selection-magnitude');
  const text = Number.isFinite(magnitude) ? `겉보기 등급 ${magnitude.toFixed(2)}` : '';
  if (field.textContent !== text) field.textContent = text;
  field.hidden = !text;
}

function renderSelection() {
  const object = stel.core.selection;
  $('#selection-panel').hidden = !object;
  if (!object) { analysis.updateSelection(); updateSelectionMagnitude(); return; }
  const names = object.designations().map((name) => name.replace(/^NAME /, ''));
  const known = objects.find((item) => names.includes(item.id));
  const constellation = names.length === 1 ? constellationNames[names[0]] : null;
  $('#selection-name').textContent = known?.name ?? constellation ?? names[0] ?? '선택한 천체';
  const rows = [];
  if (constellation) rows.push('별자리');
  else if (known?.type) rows.push(known.type);
  if (names.length) rows.push(names.slice(0, 3).join(' · '));
  $('#selection-details').textContent = rows.join('\n');
  updateSelectionMagnitude();
  analysis.updateSelection();
}

function selectObject(item) {
  if (!ready) return;
  const object = getObject(item.id);
  if (!object) {
    toast('현재 포함된 카탈로그에서 찾지 못했습니다. 데이터 로딩 후 다시 시도하거나 달·화성·M 31을 검색하세요.');
    return;
  }
  stel.core.selection = object;
  stel.pointAndLock(object, 0.8);
  stel.zoomTo((item.fov ?? 12) * rad, 0.8);
  $('#search-input').value = item.name ?? item.id;
  $('#search-results').replaceChildren();
  renderSelection();
  if (window.innerWidth < 720) setPanel(false);
  toast(viewMode === 'allsky' ? `${item.name ?? item.id}(으)로 확대했습니다. ‘전체 보기’를 누르면 전천 지도로 돌아갑니다.` : `${item.name ?? item.id}(으)로 이동했습니다. 지평선 아래 천체는 지형을 끄면 볼 수 있습니다.`);
}

function search(query) {
  const normalized = normalize(query);
  const container = $('#search-results');
  container.replaceChildren();
  if (!normalized) return;
  const matches = objects.filter((item) => item.aliases.some((alias) => normalize(alias).includes(normalized)) || normalize(item.name).includes(normalized));
  for (const item of matches.slice(0, 6)) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-result';
    const label = document.createElement('span');
    const detail = document.createElement('small');
    label.textContent = item.name;
    detail.textContent = item.type;
    button.append(label, detail);
    button.addEventListener('click', () => selectObject(item));
    li.append(button);
    container.append(li);
  }
  if (!matches.length) {
    const li = document.createElement('li');
    li.className = 'search-hint';
    li.textContent = '추천 목록에 없습니다. 영문 이름 또는 M 31 같은 번호를 입력하고 Enter를 누르세요.';
    container.append(li);
  }
}

function setPanel(open) {
  document.body.classList.toggle('panel-closed', !open);
  $('#toggle-panel').setAttribute('aria-expanded', String(open));
  $('#control-panel').inert = !open;
  fitSkyCanvas();
}

async function applySharedView(value = new URL(location.href).searchParams) {
  const params = sanitizeViewState(value);
  // A newly requested direction must release the retained native tracking lock;
  // otherwise the next engine update would snap back to the previous object.
  if (params.has('ra') || params.has('yaw') || params.has('pitch')) {
    stel.core.lock = null; stel.core.selection = null; renderSelection();
  }
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  if (params.has('lat') && params.has('lon') && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    const sharedPlace = locations.get(params.get('place'));
    if (sharedPlace && Math.abs(sharedPlace.latitude - lat) < 0.00002 && Math.abs(sharedPlace.longitude - lon) < 0.00002) {
      changeLocation(sharedPlace);
      $('#location-preset').value = sharedPlace.id;
    } else {
      changeLocation({ id: 'custom', name: '사용자 위치', latitude: lat, longitude: lon, elevation: 0 });
      customLocation = { latitude: lat, longitude: lon };
      $('#location-preset').value = 'custom';
    }
  }
  const time = new Date(params.get('time') ?? '');
  if (Number.isFinite(time.getTime()) && time.getFullYear() >= 1900 && time.getFullYear() <= 2100) stel.observer.utc = stel.date2MJD(time.getTime());
  if (params.get('view') === 'allsky') await setViewMode('allsky');
  else if (params.get('view') === 'sky') await setViewMode('sky');
  if (params.has('frame') && viewMode !== 'allsky') await setCoordinateMode(params.get('frame'));
  if (params.has('speed')) setSpeed(Number(params.get('speed')));
  for (const [key, min, max, apply] of [
    ['fov', 0.2, viewMode === 'allsky' ? 360 : 150, (value) => { setFovImmediately(value * rad); }],
    ['yaw', -360, 360, (value) => { stel.observer.yaw = value * rad; }],
    ['pitch', -90, 90, (value) => { stel.observer.pitch = value * rad; }],
  ]) {
    const value = Number(params.get(key));
    if (params.has(key) && Number.isFinite(value) && value >= min && value <= max) apply(value);
  }
  const sharedLayers = params.get('layers');
  // Analysis links back with astrometric ICRS coordinates in degrees. Keep them independent
  // of translated labels and of the observer's horizon / time settings.
  const targetRa = Number(params.get('ra'));
  const targetDec = Number(params.get('dec'));
  if (params.get('ra')?.trim() && params.get('dec')?.trim() && Number.isFinite(targetRa) && Number.isFinite(targetDec) && Math.abs(targetDec) <= 90) {
    await setCoordinateMode('equatorial');
    const direction = stel.s2c(((targetRa % 360 + 360) % 360) * rad, targetDec * rad);
    stel.lookAt(stel.convertFrame(stel.observer, 'ASTROM', 'MOUNT', direction), 0);
  }
  if (sharedLayers !== null) {
    const names = new Set(sharedLayers.split(','));
    for (const input of document.querySelectorAll('[data-layer]')) {
      input.checked = names.has(input.dataset.layer);
    }
  }
}

function serializeView() {
  const yawDegrees = ((stel.observer.yaw / rad + 180) % 360 + 360) % 360 - 180;
  return {
    lat: currentLocation.latitude.toFixed(5), lon: currentLocation.longitude.toFixed(5),
    place: currentLocation.id ?? 'custom', frame: coordinateMode, view: viewMode,
    time: stel.MJD2date(stel.observer.utc).toISOString(), speed: String(stel.core.time_speed),
    fov: (stel.core.fov / rad).toFixed(6), yaw: yawDegrees.toFixed(6), pitch: (stel.observer.pitch / rad).toFixed(6),
    layers: [...document.querySelectorAll('[data-layer]:checked')].map(input => input.dataset.layer).join(','),
  };
}

async function restoreView(query) {
  if (!ready) throw new Error('천구가 아직 준비되지 않았습니다.');
  await applySharedView(query);
  for (const input of document.querySelectorAll('[data-layer]')) layer(input.dataset.layer, input.checked);
  syncViewControls(); syncTime(); renderSelection();
}

async function initializeOpeningView() {
  stel.observer.utc = stel.date2MJD(Date.now());
  setSpeed(1);
  resetView();
  await applySharedView();
  const initial = sanitizeViewState(new URL(location.href).searchParams);
  // A fresh visit starts at the present time with ground visible. Explicit
  // shared states keep their chosen layers/time; an all-sky map has no ground.
  if (!initial.toString()) $('#layer-landscape').checked = true;
  else if (viewMode === 'allsky') {
    $('#layer-landscape').checked = false; $('#layer-atmosphere').checked = false;
  }
  for (const input of document.querySelectorAll('[data-layer]')) layer(input.dataset.layer, input.checked);
}

function setupControls() {
  for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => setViewMode(button.dataset.view));
  $('#toggle-allsky').addEventListener('click', () => setViewMode(viewMode === 'allsky' ? 'sky' : 'allsky'));
  $('#map-full-view').addEventListener('click', resetView);
  window.addEventListener('resize', fitSkyCanvas);
  $('#coordinate-system').addEventListener('change', (event) => setCoordinateMode(event.target.value));
  $('#toggle-coordinates').addEventListener('click', () => setCoordinateMode(coordinateMode === 'equatorial' ? 'horizon' : 'equatorial'));
  $('#equatorial-target').addEventListener('submit', goToEquatorialCoordinates);
  $('#search-input').addEventListener('input', (event) => search(event.target.value));
  $('#search-input').addEventListener('keydown', (event) => {
    if (event.key === 'Escape') $('#search-results').replaceChildren();
    if (event.key === 'ArrowDown') { event.preventDefault(); $('#search-results button')?.focus(); }
  });
  $('#search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const query = $('#search-input').value.trim();
    if (!query) return;
    const item = objects.find((entry) => normalize(entry.name) === normalize(query) || entry.aliases.some((alias) => normalize(alias) === normalize(query)));
    selectObject(item ?? { id: query, name: query });
  });
  $('#location-preset').addEventListener('change', (event) => {
    if (event.target.value === 'custom') {
      $('#latitude').value = customLocation.latitude;
      $('#longitude').value = customLocation.longitude;
      $('#latitude').focus();
      return;
    }
    const place = locations.get(event.target.value);
    if (!place) return;
    changeLocation(place);
    toast(`${place.name}의 위치를 적용했습니다.`);
  });
  $('#location-search').addEventListener('input', (event) => populateLocations(event.target.value.trim()));
  $('#location-search').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); $('#location-preset').focus(); }
  });
  for (const id of ['#latitude', '#longitude']) $(id).addEventListener('input', () => { $('#location-preset').value = 'custom'; });
  $('#location-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const latitude = $('#latitude').valueAsNumber;
    const longitude = $('#longitude').valueAsNumber;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return toast('위도는 −90~90°, 경도는 −180~180°로 입력하세요.');
    const preset = locations.get($('#location-preset').value);
    if (!preset) saveCustomLocation(latitude, longitude);
    changeLocation({ id: preset?.id ?? 'custom', name: preset?.name ?? '사용자 위치', latitude, longitude, elevation: preset?.elevation ?? 0 });
    toast('관측 위치를 변경했습니다.');
  });
  $('#observation-time').addEventListener('input', () => { timeInputDirty = true; });
  $('#time-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const date = new Date($('#observation-time').value);
    if (!Number.isFinite(date.getTime()) || date.getFullYear() < 1900 || date.getFullYear() > 2100) return toast('1900~2100년 사이의 날짜를 입력하세요.');
    stel.observer.utc = stel.date2MJD(date.getTime());
    timeInputDirty = false;
    setSpeed(0);
    syncTime();
  });
  $('#time-backward').addEventListener('click', () => stepTimeSpeed(-1));
  $('#time-stop').addEventListener('click', () => setSpeed(0));
  $('#time-forward').addEventListener('click', () => stepTimeSpeed(1));
  $('#time-speed-input').addEventListener('input', () => {
    speedInputDirty = true;
    $('#time-speed-input').removeAttribute('aria-invalid');
    $('#time-speed-hint').textContent = TIME_SPEED_HINT;
  });
  $('#time-speed-form').addEventListener('submit', (event) => {
    event.preventDefault();
    applyTypedSpeed();
  });
  $('#time-speed-input').addEventListener('change', () => {
    if (speedInputDirty) applyTypedSpeed(false);
  });
  $('#time-now').addEventListener('click', () => {
    timeInputDirty = false;
    stel.observer.utc = stel.date2MJD(Date.now());
    setSpeed(1);
    syncTime();
    toast('현재시간으로 돌아왔습니다. 실시간 ×1로 재생합니다.');
  });
  stel.core.change('time_speed', syncSpeedControls);
  for (const input of document.querySelectorAll('[data-layer]')) input.addEventListener('change', () => layer(input.dataset.layer, input.checked));
  $('#toggle-ground').addEventListener('click', toggleGround);
  document.addEventListener('keydown', (event) => {
    if (integrationPaused() || document.documentElement.dataset.skyTutorialActive === 'true' || !ready || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || $('#help-dialog').open || $('#analysis-dialog').open) return;
    if (event.target instanceof HTMLElement && (event.target.closest('input, textarea, select') || event.target.isContentEditable)) return;
    if (event.code !== 'KeyG' && event.key.toLowerCase() !== 'g') return;
    event.preventDefault();
    toggleGround();
  });
  $('#quality-select').addEventListener('change', (event) => { stel.maxPixelRatio = { performance: 1, balanced: 1.5, detail: 2 }[event.target.value]; });
  $('#zoom-in').addEventListener('click', () => stel.zoomTo(Math.max(0.2 * rad, stel.core.fov * 0.7), 0.3));
  $('#zoom-out').addEventListener('click', () => stel.zoomTo(Math.min((viewMode === 'allsky' ? 360 : 150) * rad, stel.core.fov / 0.7), 0.3));
  $('#reset-view').addEventListener('click', resetView);
  $('#clear-selection').addEventListener('click', () => { stel.core.selection = null; stel.core.lock = null; renderSelection(); });
  $('#copy-link').addEventListener('click', async () => {
    const state = serializeView();
    if (shareView(state)) return;
    const url = new URL(base);
    url.search = new URLSearchParams(state).toString();
    try { await navigator.clipboard.writeText(url.href); toast('같은 위치·시간·시야를 여는 링크를 복사했습니다.'); }
    catch { window.prompt('이 주소를 복사하세요.', url.href); }
  });
  stel.core.change('selection', renderSelection);
}

async function onReady(engine) {
  try {
    stel = engine;
    // Expose the engine for local integration and scientific extension work.
    window.stellarium = engine;
    const c = stel.core;
    const sky = asset('skydata/');
    c.stars.addDataSource({ url: sky + 'stars' });
    c.skycultures.addDataSource({ url: sky + 'skycultures/western', key: 'western' });
    c.dsos.addDataSource({ url: sky + 'dso' });
    c.landscapes.addDataSource({ url: sky + 'landscapes/guereins', key: 'guereins' });
    c.milkyway.addDataSource({ url: asset('assets/spherex-hips') });
    for (const [body, key] of [['moon', 'moon'], ['sun', 'sun'], ['moon', 'default']]) c.planets.addDataSource({ url: sky + 'surveys/sso/' + body, key });
    c.constellations.show_only_pointed = false;
    populateLocations();
    changeLocation(presets.seoul);
    await initializeOpeningView();
    setupControls();
    const fonts = await Promise.allSettled([
      stel.setFont('regular', asset('fonts/NotoSans-Regular.ttf')),
      stel.setFont('bold', asset('fonts/NotoSans-Bold.ttf')),
    ]);
    if (fonts.some((result) => result.status === 'rejected')) console.warn('외부 폰트를 불러오지 못해 엔진의 기본 폰트를 사용합니다.');
    clearTimeout(startupTimer);
    ready = true;
    analysisPicker = createAnalysisPicker({
      engine: stel, canvas: $('#sky-canvas'), onTarget: analysis.open, onSelection: renderSelection, notify: toast,
      canInteract: () => !integrationPaused() && document.documentElement.dataset.skyTutorialActive !== 'true' && ready && !coordinateTransition && !viewTransition && !$('#help-dialog').open && !$('#analysis-dialog').open,
    });
    syncViewControls();
    $('#loading-overlay').hidden = true;
    $('#engine-status').textContent = '하늘 탐색 중';
    $('#engine-status').dataset.state = 'ready';
    syncTime();
    registerIntegration({
      getState: () => ({ ready, viewMode, coordinateMode, query: serializeView(), selected: $('#selection-name').textContent, selection: !!stel.core.selection, statusPolling: !!statusTimer, rendering: $('#sky-canvas').dataset.rendering }),
      restoreState: restoreView,
      onPauseChanged: syncRendering,
      focusObject: id => selectObject(objects.find(item => item.id === id) || { id, name: id }),
    });
    syncRendering();
    mountSupplemental(async (ra, dec, label) => {
      await setCoordinateMode('equatorial');
      stel.core.selection = null; stel.core.lock = null; renderSelection();
      stel.lookAt(stel.convertFrame(stel.observer, 'ASTROM', 'MOUNT', stel.s2c(ra * rad, dec * rad)), .8);
      stel.zoomTo(12 * rad, .8); toast(`${label} 관측 좌표로 이동했습니다.`);
    }).catch(error => console.warn('Supplemental observation links', error));
    if (window.innerWidth < 720) setPanel(false);
  } catch (error) { fail('하늘을 초기화하지 못했습니다. 새로고침 후 다시 시도해 주세요.', error); }
}

for (const button of document.querySelectorAll('.view-controls button')) button.disabled = true;
$('#toggle-panel').addEventListener('click', () => setPanel(document.body.classList.contains('panel-closed')));
$('#help-button').addEventListener('click', () => $('#help-dialog').showModal());
$('#close-help').addEventListener('click', () => $('#help-dialog').close());
$('#help-dialog').addEventListener('click', (event) => { if (event.target === $('#help-dialog')) $('#help-dialog').close(); });
$('#retry-button').addEventListener('click', () => location.reload());
$('#fullscreen-button').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { toast('이 브라우저에서는 전체 화면을 사용할 수 없습니다.'); }
});
$('#sky-canvas').addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  ready = false;
  fail('그래픽 연결이 중단되었습니다. 다른 무거운 탭을 닫고 다시 시작해 주세요.');
});

async function start() {
  if (location.protocol === 'file:') return fail('Start-Web.cmd를 실행해 주세요. WebAssembly는 HTTP 서버에서 열어야 합니다.');
  if (!window.WebAssembly) return fail('WebAssembly를 지원하는 최신 Chrome 또는 Edge에서 열어 주세요.');
  const probe = document.createElement('canvas');
  const context = probe.getContext('webgl') || probe.getContext('experimental-webgl');
  if (!context) return fail('WebGL을 사용할 수 없습니다. 브라우저의 그래픽 가속을 켜고 다시 시작해 주세요.');
  context.getExtension('WEBGL_lose_context')?.loseContext();
  startupTimer = setTimeout(() => fail('로딩이 지연되고 있습니다. 서버 연결을 확인하고 다시 시도해 주세요.'), 45000);
  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = asset('engine/stellarium-web-engine.js');
      script.onload = resolve;
      script.onerror = () => reject(new Error('Engine script failed to load'));
      document.head.append(script);
    });
    $('#loading-message').textContent = '천체 엔진과 하늘 데이터를 불러오는 중…';
    const engine = window.StelWebEngine({
      wasmFile: asset('engine/stellarium-web-engine.wasm'), canvas: $('#sky-canvas'), maxPixelRatio: 1.5,
      translateFn: (_domain, text) => text,
      onReady,
      onAbort: (reason) => fail('천체 엔진을 실행하지 못했습니다. 브라우저와 WASM 파일을 확인해 주세요.', reason),
    });
    if (engine?.catch) engine.catch((error) => fail('WebAssembly를 불러오지 못했습니다. 서버 연결을 확인해 주세요.', error));
  } catch (error) { fail('엔진 파일을 찾을 수 없습니다. npm run build 후 다시 실행해 주세요.', error); }
}
function syncRendering() {
  // Keep the sky and its selection in memory, but stop GPU/CPU work while covered.
  const paused = document.hidden || $('#analysis-dialog').open || document.documentElement.dataset.skyTutorialActive === 'true' || integrationPaused();
  if (paused && analysisPicker?.active) analysisPicker.cancel();
  clearInterval(statusTimer); statusTimer = null;
  if (ready && !paused) statusTimer = setInterval(syncTime, 500);
  if (!stel?.setRenderPaused) return;
  stel.setRenderPaused(paused);
  $('#sky-canvas').dataset.rendering = paused ? 'paused' : 'running';
}
const analysis = createAnalysisController({ getEngine: () => stel, notify: toast, onVisibilityChange: syncRendering });
document.addEventListener('visibilitychange', syncRendering);
window.addEventListener('sky-tutorial-visibility', syncRendering);
window.addEventListener('pagehide', () => stel?.setRenderPaused?.(true));
window.addEventListener('pageshow', syncRendering);
start();
