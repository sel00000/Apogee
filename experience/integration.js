/** Portal protocol only. The simulation and its Records frame stay on one origin. */
export function parentOriginFrom(location, referrer = '') {
  try {
    const params = new URL(location.href).searchParams;
    if (params.get('embed') !== '1') return null;
    const raw = params.get('parentOrigin');
    if (!raw) return null;
    const origin = new URL(raw);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== raw) return null;
    if (referrer && new URL(referrer).origin !== origin.origin) return null;
    return origin.origin;
  } catch { return null; }
}

export function createExperienceBridge(win, callbacks, { referrer = '', intervalMs = 500 } = {}) {
  const origin = parentOriginFrom(win.location, referrer);
  if (!origin || win.parent === win) return { dispose() {}, publish() {} };
  let active = true, disposed = false, lastState = '', exiting = false;
  const send = (type, payload = {}) => win.parent.postMessage({ type, ...payload }, origin);
  function state() {
    const value = callbacks.getState();
    return {
      ready: !!value.ready, exporting: !!value.exporting, active,
      canSave: !!value.canSave, canExit: !value.exporting,
    };
  }
  function publish(force = false) {
    if (disposed) return;
    const value = state(), encoded = JSON.stringify(value);
    if (force || encoded !== lastState) {
      lastState = encoded;
      send('spherex-experience-state', value);
    }
  }
  async function receive(event) {
    if (disposed || event.source !== win.parent || event.origin !== origin) return;
    const message = event.data;
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') return;
    const requestId = typeof message.requestId === 'string' && message.requestId.length <= 120 ? message.requestId : undefined;
    if (message.type === 'spherex-experience-status') return publish(true);
    if (message.type === 'spherex-experience-set-active') {
      if (typeof message.active !== 'boolean') return;
      if (!message.active && state().exporting) {
        send('spherex-experience-pause-blocked', { requestId, reason: 'export_in_progress' });
        return publish(true);
      }
      active = message.active;
      callbacks.setActive(active);
      return publish(true);
    }
    if (message.type !== 'spherex-experience-exit' || !requestId || exiting) return;
    if (state().exporting) {
      send('spherex-experience-exit-blocked', { requestId, reason: 'export_in_progress' });
      return;
    }
    exiting = true;
    try {
      // Saving may be intentionally unavailable during the opening or simulated flight.
      // The caller receives the actual save result instead of a fabricated success.
      const saved = !!(await callbacks.save());
      active = false;
      callbacks.setActive(false);
      send('spherex-experience-exit-ready', { requestId, saved });
      publish(true);
    } catch {
      send('spherex-experience-exit-blocked', { requestId, reason: 'save_failed' });
    } finally { exiting = false; }
  }
  win.addEventListener('message', receive);
  const timer = win.setInterval(publish, intervalMs);
  publish(true);
  return {
    publish,
    dispose() {
      if (disposed) return;
      disposed = true;
      win.clearInterval(timer);
      win.removeEventListener('message', receive);
    },
  };
}

export function installExperienceIntegration(callbacks, win = window) {
  const doc = win.document;
  const bridge = createExperienceBridge(win, callbacks, { referrer: doc.referrer });
  win.addEventListener('pagehide', () => bridge.dispose(), { once: true });
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/integration.css';
  doc.head.append(link);
  const button = doc.createElement('button');
  button.id = 'spherex-experience-info';
  button.lang = 'ko';
  button.type = 'button';
  button.textContent = '우주 탐험 · 체험 안내';
  button.setAttribute('aria-haspopup', 'dialog');
  const dialog = doc.createElement('dialog');
  dialog.id = 'spherex-experience-info-dialog';
  dialog.lang = 'ko';
  dialog.setAttribute('aria-labelledby', 'spherex-experience-title');
  dialog.innerHTML = `<h2 id="spherex-experience-title">행성과 우주를 탐험해 보세요</h2>
    <p>천체 위치 자료를 바탕으로 구성한 비행 체험입니다. 실제 우주선 조종이나 SPHEREx 측정·분석 결과를 보여주는 화면은 아닙니다.</p>
    <p><kbd>W</kbd> 전진 · <kbd>S</kbd> 감속/후진 · <kbd>A</kbd>/<kbd>D</kbd> 또는 드래그로 방향 조절 · <kbd>Shift</kbd>/<kbd>Space</kbd> 상하 이동 · <kbd>X</kbd> 제동</p>
    <p>발견한 천체는 <strong>RECORDS</strong>에서 다시 볼 수 있습니다. 비행 기록은 이 브라우저에 저장됩니다. 영상 내보내기가 끝난 뒤 다른 화면으로 이동해 주세요.</p>
    <p class="experience-credit">원작 SOJOURNER — <a href="https://sojourner.artificialisabel.com/" target="_blank" rel="noopener noreferrer">artificial.isabel</a><br>위치 자료·모델 출처: 앱의 Field Notes와 <a href="/data/asset-sources.json" target="_blank" rel="noopener noreferrer">자산 출처 목록</a></p>
    <form method="dialog"><button type="submit" autofocus>탐험으로 돌아가기</button></form>`;
  let pausedForInfo = false;
  button.addEventListener('click', () => {
    pausedForInfo = !callbacks.getState().exporting;
    if (pausedForInfo) callbacks.setInfoOpen?.(true);
    dialog.showModal();
  });
  dialog.addEventListener('close', () => {
    if (pausedForInfo) callbacks.setInfoOpen?.(false);
    pausedForInfo = false;
    button.focus({ preventScroll: true });
  });
  dialog.addEventListener('keydown', event => event.stopPropagation());
  doc.body.append(button, dialog);
  return bridge;
}
