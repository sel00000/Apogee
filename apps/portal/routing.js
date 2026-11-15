/** The shell owns navigation. Child paths are deployment-relative, never source paths. */
export const VIEWS = Object.freeze({
  home: ['SPHEREx FOR EVERYONE', '모두를 위한 SPHEREx'],
  planetarium: ['EXPLORE THE SKY', '플라네타리움'],
  analysis: ['READ THE OBSERVATIONS', 'SPHEREx 분석'],
  asteroids: ['FOLLOW THE MOVEMENT', '소행성 분석'],
  experience: ['A JOURNEY THROUGH SPACE', '우주 탐험'],
});
export const HOME_ANCHORS = new Set(['about', 'mission', 'light', 'sky']);

export function parseRoute(hash = '') {
  const raw = String(hash).replace(/^#/, '').slice(0, 8192);
  const split = raw.indexOf('?');
  const name = (split < 0 ? raw : raw.slice(0, split)) || 'home';
  const params = new URLSearchParams(split < 0 ? '' : raw.slice(split + 1));
  params.delete('embed');
  if (name === 'moving') {
    if (!params.has('tab')) params.set('tab', 'observations');
    return { view: 'asteroids', params, anchor: null };
  }
  if (HOME_ANCHORS.has(name)) return { view: 'home', params: new URLSearchParams(), anchor: name };
  return { view: Object.hasOwn(VIEWS, name) ? name : 'home', params, anchor: null };
}

export function routeHash(view, values = {}) {
  if (!Object.hasOwn(VIEWS, view)) throw new TypeError('Unknown application view.');
  const params = values instanceof URLSearchParams ? new URLSearchParams(values) : new URLSearchParams();
  if (!(values instanceof URLSearchParams)) {
    for (const [key, value] of Object.entries(values || {})) {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    }
  }
  params.delete('embed');
  return `#${view}${params.size ? '?' + params : ''}`;
}

export function analysisParams(target) {
  if (!target || typeof target !== 'object') throw new TypeError('분석할 대상을 선택해 주세요.');
  const params = new URLSearchParams();
  const prepared = target.preparedTargetId ?? target.target;
  if (typeof prepared === 'string' && /^[a-z0-9_-]{1,64}$/.test(prepared)) params.set('target', prepared);
  else {
    const ra = target.raDeg ?? target.ra, dec = target.decDeg ?? target.dec;
    if (typeof ra !== 'number' || typeof dec !== 'number' || !Number.isFinite(ra) || !Number.isFinite(dec) || Math.abs(dec) > 90) {
      throw new TypeError('유효한 적경·적위가 필요합니다. 이동 천체는 소행성 분석에서 선택해 주세요.');
    }
    // Apparent solar-system coordinates must not masquerade as an ICRS field.
    if (target.frame && !['ICRS', 'ASTROM'].includes(target.frame)) {
      throw new TypeError('이동 천체의 겉보기 위치는 고정 좌표 분석에 바로 사용할 수 없습니다. 천구에서 스피어x 데이터 분석으로 영역을 선택해 주세요.');
    }
    params.set('ra', String(ra >= 0 && ra < 360 ? ra : ((ra % 360) + 360) % 360));
    params.set('dec', String(dec));
  }
  const label = target.name ?? target.label;
  if (typeof label === 'string') params.set('label', label.slice(0, 160));
  if (['motion', 'variable', 'spectrum', 'provenance'].includes(target.tab)) params.set('tab', target.tab);
  for (const key of ['frame', 'coordinateEpoch', 'timeScale', 'observer']) {
    if (typeof target[key] === 'string' && target[key].length <= 80) params.set(key, target[key]);
  }
  for (const key of ['epoch', 'predictionMjd', 'observationMjd']) {
    if (Number.isFinite(target[key])) params.set(key, String(target[key]));
  }
  const fov = target.fovDeg ?? (Number.isFinite(target.fovArcsec) ? target.fovArcsec / 3600 : undefined);
  if (Number.isFinite(fov) && fov > 0 && fov <= 180) params.set('fov', String(fov));
  if (target.moving) params.set('moving', '1');
  return params;
}

export function childURL(view, params, base) {
  if (!['analysis', 'asteroids', 'planetarium'].includes(view)) throw new TypeError('Unknown child application.');
  const url = new URL(`${view}/`, base);
  for (const [key, value] of params) if (key !== 'embed') url.searchParams.set(key, value);
  url.searchParams.set('embed', '1');
  if (view === 'analysis' && !url.searchParams.has('target') && !url.searchParams.has('ra') && !url.searchParams.has('q')) url.searchParams.set('target', 'barnard');
  return url;
}

export function trustedFrameMessage(event, frame, expectedOrigin) {
  return !!frame?.contentWindow && event.source === frame.contentWindow && event.origin === expectedOrigin &&
    !!event.data && typeof event.data === 'object';
}
