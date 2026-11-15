import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parentOriginFrom, createExperienceBridge } from '../../../apps/experience/web/integration.js';

const portal = 'http://127.0.0.1:4173';
function location(query = '') { return { href: `http://127.0.0.1:4174/?embed=1&parentOrigin=${encodeURIComponent(portal)}${query}` }; }
function fixture(callbacks = {}) {
  let handler, timer, cleared = false;
  const messages = [], activity = [];
  const parent = { postMessage(message, origin) { messages.push({ ...message, origin }); } };
  const win = { parent, location: location(),
    addEventListener(type, fn) { if (type === 'message') handler = fn; },
    removeEventListener(type, fn) { if (type === 'message' && handler === fn) handler = null; },
    setInterval(fn) { timer = fn; return 1; }, clearInterval() { cleared = true; },
  };
  const state = { ready: true, exporting: false, canSave: true };
  const bridge = createExperienceBridge(win, { getState: () => state, setActive: value => activity.push(value), save: () => true, ...callbacks }, { referrer: `${portal}/#experience` });
  const receive = (data, origin = portal, source = parent) => handler?.({ data, origin, source });
  return { bridge, state, receive, messages, activity, poll: () => timer(), cleared: () => cleared, hasHandler: () => !!handler };
}

test('only explicit HTTP(S) portal origins matching referrer enable the bridge', () => {
  assert.equal(parentOriginFrom(location(), `${portal}/#experience`), portal);
  assert.equal(parentOriginFrom(location(), 'https://unrelated.example/'), null);
  for (const value of ['*', 'null', 'javascript:alert(1)', 'https://example.com/path', 'https://user@example.com', 'file:///C:/x']) {
    assert.equal(parentOriginFrom({ href: `http://127.0.0.1/?embed=1&parentOrigin=${encodeURIComponent(value)}` }), null);
  }
  assert.equal(parentOriginFrom({ href: 'http://127.0.0.1/' }), null);
});

test('messages require exact parent window and origin; malformed activation is ignored', async () => {
  const f = fixture();
  await f.receive({ type: 'spherex-experience-set-active', active: false }, 'https://evil.example');
  await f.receive({ type: 'spherex-experience-set-active', active: false }, portal, {});
  await f.receive({ type: 'spherex-experience-set-active', active: 'false' });
  assert.deepEqual(f.activity, []);
  await f.receive({ type: 'spherex-experience-set-active', active: false });
  assert.deepEqual(f.activity, [false]);
  assert.equal(f.messages.at(-1).active, false);
  assert.ok(f.messages.every(message => message.origin === portal));
});

test('exit saves before pausing and acknowledges actual save result', async () => {
  const order = [];
  const f = fixture({ save() { order.push('save'); return false; }, setActive(active) { order.push(active); } });
  await f.receive({ type: 'spherex-experience-exit', requestId: 'exit-1' });
  assert.deepEqual(order, ['save', false]);
  const reply = f.messages.find(message => message.type === 'spherex-experience-exit-ready');
  assert.equal(reply.requestId, 'exit-1');
  assert.equal(reply.saved, false);
});

test('export blocks exit and external pause without interrupting a recording', async () => {
  const f = fixture({ save() { throw new Error('Must not save during export'); } });
  f.state.exporting = true;
  await f.receive({ type: 'spherex-experience-exit', requestId: 'film' });
  assert.equal(f.messages.at(-1).reason, 'export_in_progress');
  await f.receive({ type: 'spherex-experience-set-active', active: false, requestId: 'pause' });
  assert.deepEqual(f.activity, []);
  assert.ok(f.messages.some(message => message.type === 'spherex-experience-pause-blocked'));
  assert.equal(f.messages.at(-1).canExit, false);
});

test('failed save keeps the scene active and can be retried', async () => {
  const f = fixture({ save() { throw new Error('storage unavailable'); } });
  await f.receive({ type: 'spherex-experience-exit', requestId: 'save' });
  assert.equal(f.messages.at(-1).type, 'spherex-experience-exit-blocked');
  assert.equal(f.messages.at(-1).reason, 'save_failed');
  assert.deepEqual(f.activity, []);
});

test('state updates are bounded and cleanup removes listener and interval', () => {
  const f = fixture();
  const initial = f.messages.length;
  f.poll();
  assert.equal(f.messages.length, initial);
  f.state.ready = false;
  f.poll();
  assert.equal(f.messages.length, initial + 1);
  f.bridge.dispose();
  assert.equal(f.cleared(), true);
  assert.equal(f.hasHandler(), false);
  f.poll();
  assert.equal(f.messages.length, initial + 1);
});

test('runtime render gate and full export lifecycle are connected to the adapter', async () => {
  const source = await readFile(new URL('../../../apps/experience/web/app.GFXWGZEC.js', import.meta.url), 'utf8');
  assert.equal(source.split('// SPHEREX_PORTAL_INTEGRATION_V1').length, 2);
  assert.match(source, /if\(document\.hidden\|\|Au\|\|globalThis\.__spherexExperiencePaused\)/);
  assert.match(source, /Ka \|\| ct\?\.exportController \|\| ct\?\.exportNavigation/);
  assert.match(source, /gt\?\.setHidden\(document\.hidden \|\| globalThis\.__spherexExperiencePaused\)/);
});
