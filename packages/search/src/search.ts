import { createSearchService, type SearchChoice, type SearchOptions, type SearchSelection } from './service';
export { createSearchService, selectionFromItem, bodyChoices, readSesamePosition } from './service';
export { parseCoords } from './core/intent';
export { createSkySearch } from './core/search';
export { validateIndexData } from './core/index';
export type { SearchSelection, SearchChoice, SearchOptions } from './service';

export type SearchAction = 'planetarium' | 'analysis' | 'asteroids';
export interface MountOptions extends SearchOptions {
  onSelect: (selection: SearchSelection, action: SearchAction) => void;
  signal?: AbortSignal;
}

const CSS = `
.sx-search{color:#ecf2ff;font:inherit;width:100%;position:relative;--sx-search-line:rgba(174,198,235,.2)}
.sx-search *{box-sizing:border-box}.sx-search [hidden]{display:none!important}
.sx-search form{display:flex;gap:8px;margin:0}.sx-search label{display:block;font-size:13px;color:#c7d4ed;margin:0 0 8px}
.sx-search input{flex:1;min-width:0;padding:13px 14px;border:1px solid var(--sx-search-line);border-radius:12px;background:#10182a;color:inherit;font:inherit;outline:none}
.sx-search input:focus{border-color:#9ebcff;box-shadow:0 0 0 3px #8baaff22}
.sx-search button{font:inherit;color:inherit;cursor:pointer;border:1px solid var(--sx-search-line);border-radius:10px;background:#17233a;padding:10px 14px}
.sx-search button:hover{background:#263958}.sx-search button:focus-visible{outline:2px solid #b0c9ff;outline-offset:3px}.sx-search button:disabled{opacity:.5;cursor:default}
.sx-search .sx-search-submit{background:#dbe8ff;color:#152035;font-weight:700;white-space:nowrap}
.sx-search .sx-search-status{color:#aabbd8;font-size:12px;line-height:1.6;margin:10px 0;min-height:20px}
.sx-search .sx-search-status[data-error]{color:#ffb8ae}
.sx-search .sx-search-results{list-style:none;margin:0;padding:0;max-height:38vh;overflow:auto;border-top:1px solid var(--sx-search-line)}
.sx-search .sx-search-result{display:block;text-align:left;width:100%;border:0;border-bottom:1px solid var(--sx-search-line);border-radius:0;padding:12px 10px;background:transparent}
.sx-search .sx-search-result[aria-selected=true]{background:#253656}.sx-search .sx-search-result strong{display:block;font-size:14px;font-weight:600;overflow-wrap:anywhere}
.sx-search .sx-search-result small{display:block;margin-top:5px;color:#aabbd8;line-height:1.5;font-size:11px;overflow-wrap:anywhere}
.sx-search .sx-search-choice{padding:16px;background:#0d1729;border:1px solid var(--sx-search-line);border-radius:12px;margin-top:12px}
.sx-search .sx-search-choice p{font-size:12px;color:#b4c4df;line-height:1.7;margin:8px 0 12px;overflow-wrap:anywhere}
.sx-search .sx-search-actions{display:flex;gap:8px;flex-wrap:wrap}.sx-search .sx-search-help{font-size:11px;color:#8fa2c0;line-height:1.7;margin:12px 0 0}
@media(max-width:480px){.sx-search input{font-size:14px;padding:12px 9px}.sx-search button{padding:10px}.sx-search .sx-search-actions button{flex:1}.sx-search .sx-search-results{max-height:32vh}}
`;
let sequence = 0;

/** Shell-owned, lazy-search UI. No routing or scientific processing is started until an action is chosen. */
export function mountSearch(host: HTMLElement, options: MountOptions) {
  if (!host || !options?.onSelect) throw new Error('검색을 표시할 요소와 선택 처리기가 필요합니다.');
  const doc = host.ownerDocument;
  if (!doc.getElementById('spherex-search-style')) {
    const style = doc.createElement('style'); style.id = 'spherex-search-style'; style.textContent = CSS; doc.head.append(style);
  }
  const id = `sx-search-${++sequence}`;
  const root = doc.createElement('section'); root.className = 'sx-search';
  root.innerHTML = `<label for="${id}-input">천체 이름 · 한글/영문 · 천구 좌표</label>
    <form role="search"><input id="${id}-input" type="search" autocomplete="off" spellcheck="false" maxlength="160"
      role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-results"
      placeholder="예: 바너드별, M31, 433 Eros, 10.684, 41.269" data-tutorial-search-input>
      <button class="sx-search-submit" type="submit">검색</button></form>
    <p class="sx-search-status" role="status" aria-live="polite">검색 목록을 준비하고 있습니다.</p>
    <ul class="sx-search-results" id="${id}-results" role="listbox" aria-label="천체 검색 결과" hidden></ul>
    <section class="sx-search-choice" aria-label="선택한 천체" hidden></section>
    <p class="sx-search-help">좌표는 ICRS/J2000 기준 도 단위 또는 시·분·초로 입력하세요. 예: 05:35:17.3 −05:23:28<br>이동 천체는 날짜·관측자에 맞는 위치 확인이 필요합니다.</p>`;
  host.replaceChildren(root);
  const input = root.querySelector('input')! as HTMLInputElement;
  const form = root.querySelector('form')!;
  const status = root.querySelector('.sx-search-status')! as HTMLElement;
  const list = root.querySelector('ul')!;
  const choice = root.querySelector('.sx-search-choice')! as HTMLElement;
  const events = new AbortController();
  const service = createSearchService(options);
  let destroyed = false, composing = false, generation = 0, active = -1;
  let choices: SearchChoice[] = [];
  let selectedChoice: SearchChoice | undefined;
  let running: AbortController | undefined;
  let loadReady = false;

  const say = (text: string, error = false) => {
    if (destroyed) return;
    status.textContent = text; status.toggleAttribute('data-error', error);
  };
  const cancel = () => {generation++; running?.abort(); running = undefined; form.removeAttribute('aria-busy');};
  const setActive = (index: number) => {
    active = index;
    const nodes = list.querySelectorAll<HTMLButtonElement>('[role=option]');
    nodes.forEach((node, i) => node.setAttribute('aria-selected', String(i === active)));
    if (active >= 0 && nodes[active]) {input.setAttribute('aria-activedescendant', nodes[active].id); nodes[active].scrollIntoView({block: 'nearest'});}
    else input.removeAttribute('aria-activedescendant');
  };
  const close = () => {
    cancel(); list.hidden = true; choice.hidden = true; selectedChoice = undefined; input.setAttribute('aria-expanded', 'false'); setActive(-1);
  };
  const selectAction = (selected: SearchChoice, action: SearchAction) => {
    cancel();
    options.onSelect({...selected.selection}, action);
  };
  const choose = (index: number) => {
    const selected = choices[index]; if (!selected || destroyed) return;
    cancel(); setActive(index); selectedChoice = selected; choice.replaceChildren(); choice.hidden = false;
    const title = doc.createElement('strong'); title.textContent = selected.label;
    const detail = doc.createElement('p'); detail.textContent = selected.detail;
    const actions = doc.createElement('div'); actions.className = 'sx-search-actions';
    const add = (text: string, action: SearchAction) => {
      const button = doc.createElement('button'); button.type = 'button'; button.textContent = text;
      button.dataset.action = action; actions.append(button);
    };
    if (selected.selection.kind === 'asteroid') add('소행성 분석 열기', 'asteroids');
    else {
      add('천구에서 보기', 'planetarium');
      if (selected.selection.kind === 'sky') add('SPHEREx 자료 분석', 'analysis');
    }
    choice.append(title, detail, actions);
    actions.querySelector('button')?.focus({preventScroll: true});
  };
  const render = (items: SearchChoice[]) => {
    if (destroyed) return;
    choices = items; selectedChoice = undefined; list.replaceChildren(); choice.hidden = true; setActive(-1);
    list.hidden = items.length === 0; input.setAttribute('aria-expanded', String(items.length > 0));
    items.forEach((item, i) => {
      const li = doc.createElement('li'); li.setAttribute('role', 'presentation');
      const button = doc.createElement('button'); button.type = 'button'; button.className = 'sx-search-result';
      button.id = `${id}-option-${i}`; button.setAttribute('role', 'option'); button.setAttribute('aria-selected', 'false');
      button.dataset.index = String(i);
      const title = doc.createElement('strong'); title.textContent = item.label;
      const detail = doc.createElement('small'); detail.textContent = item.detail;
      button.append(title, detail); li.append(button); list.append(li);
    });
  };
  const suggest = () => {
    if (!loadReady || composing || destroyed) return;
    render(service.suggest(input.value));
    say(input.value.trim() ? '후보를 고르거나 검색을 눌러 외부 목록까지 조회하세요.' : '천체 이름이나 좌표를 입력하세요.');
  };
  const ready = service.ready().then(() => {
    if (!destroyed) {loadReady = true; suggest();}
  }).catch(error => {say(`검색 목록을 불러오지 못했습니다. 검색을 눌러 다시 시도하세요. ${error.message}`, true);});
  const search = async (text?: string) => {
    if (destroyed || composing) return;
    if (text !== undefined) input.value = text;
    cancel(); const current = generation; running = new AbortController(); const request = running;
    const timer = setTimeout(() => request.abort(new DOMException('검색 시간이 초과되었습니다. 다시 시도하세요.', 'TimeoutError')), 20000);
    render([]); form.setAttribute('aria-busy', 'true'); say('천체를 찾고 있습니다…');
    try {
      const result = await service.search(input.value, request.signal);
      if (destroyed || current !== generation) return;
      loadReady = true; render(result.items); say(result.message, result.partial && !result.items.length);
    } catch (error) {
      if (destroyed || current !== generation) return;
      const e = error as Error;
      if (e.name !== 'AbortError') say(e.message || '검색을 완료하지 못했습니다. 다시 시도하세요.', true);
    } finally {
      clearTimeout(timer);
      if (current === generation) {running = undefined; form.removeAttribute('aria-busy');}
    }
  };
  form.addEventListener('submit', event => {event.preventDefault(); if (!composing) void search();}, {signal: events.signal});
  list.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-index]');
    if (button && list.contains(button)) choose(Number(button.dataset.index));
  }, {signal: events.signal});
  choice.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
    if (button && selectedChoice && choice.contains(button)) selectAction(selectedChoice, button.dataset.action as SearchAction);
  }, {signal: events.signal});
  input.addEventListener('input', () => {cancel(); suggest();}, {signal: events.signal});
  input.addEventListener('compositionstart', () => {composing = true; cancel();}, {signal: events.signal});
  input.addEventListener('compositionend', () => {composing = false; suggest();}, {signal: events.signal});
  input.addEventListener('keydown', event => {
    if (event.isComposing || composing || event.keyCode === 229) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!choices.length || list.hidden) return;
      event.preventDefault(); setActive((active + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length);
    } else if (event.key === 'Enter' && active >= 0 && !list.hidden) {event.preventDefault(); choose(active);}
    else if (event.key === 'Escape' && (!list.hidden || !choice.hidden || running)) {event.preventDefault(); event.stopPropagation(); close(); say('검색을 닫았습니다. 다시 입력해 검색할 수 있습니다.');}
  }, {signal: events.signal});
  const destroy = () => {
    if (destroyed) return;
    destroyed = true; cancel(); events.abort(); options.signal?.removeEventListener('abort', destroy); root.remove();
  };
  if (options.signal?.aborted) destroy(); else options.signal?.addEventListener('abort', destroy, {once: true});
  return {ready, search, close, destroy, focus: () => {if (!destroyed) input.focus();},
    setValue: (value: string) => {if (!destroyed) {input.value = value; cancel(); suggest();}}};
}
