import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { createSojournerServer, startServer } from './serve.mjs';

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  if (!server.listening) return;
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

async function request(origin, requestPath = '/', options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(origin, { ...options, path: requestPath }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

async function fixture(t, upstreamHandler = (_req, res) => res.writeHead(404).end('upstream missing'), options = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sojourner-server-'));
  const webRoot = path.join(directory, 'web');
  await mkdir(webRoot);
  await writeFile(path.join(webRoot, 'index.html'), '<!doctype html><iframe src="/codex-ingame.html"></iframe>');
  await writeFile(path.join(webRoot, 'codex-ingame.html'), '<!doctype html><title>Codex</title>');
  await writeFile(path.join(webRoot, 'app.js'), 'export const scene = "solar";');
  await writeFile(path.join(webRoot, 'style.css'), 'body { background: black; }');
  await writeFile(path.join(webRoot, 'intro.mp4'), '0123456789');
  const upstream = http.createServer(upstreamHandler);
  const upstreamOrigin = await listen(upstream);
  const server = createSojournerServer({ webRoot, upstreamOrigin, ...options });
  const origin = await listen(server);
  t.after(async () => {
    await close(server);
    await close(upstream);
    await rm(directory, { recursive: true, force: true });
  });
  return { directory, webRoot, origin, upstreamOrigin, upstream, server };
}

test('serves original home, iframe, scripts and CSS bytes from the web root', async t => {
  const { origin, webRoot } = await fixture(t);
  await mkdir(path.join(webRoot, 'data'));
  await writeFile(path.join(webRoot, 'data/research.md'), '# Original research\n');
  const cases = [
    ['/', 'text/html; charset=utf-8', '<!doctype html><iframe src="/codex-ingame.html"></iframe>'],
    ['/codex-ingame.html?epoch=live-v1-Uranus', 'text/html; charset=utf-8', '<!doctype html><title>Codex</title>'],
    ['/app.js?v=original', 'text/javascript; charset=utf-8', 'export const scene = "solar";'],
    ['/style.css', 'text/css; charset=utf-8', 'body { background: black; }'],
    ['/data/research.md', 'text/markdown; charset=utf-8', '# Original research\n'],
  ];
  for (const [url, mime, body] of cases) {
    const response = await request(origin, url);
    assert.equal(response.status, 200, url);
    assert.equal(response.headers['content-type'], mime, url);
    assert.equal(response.body.toString(), body, url);
  }
});

test('HEAD reports the local representation length without sending its body', async t => {
  const { origin } = await fixture(t);
  const response = await request(origin, '/intro.mp4', { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert.equal(response.headers['content-type'], 'video/mp4');
  assert.equal(response.headers['content-length'], '10');
  assert.equal(response.headers['accept-ranges'], 'bytes');
  assert.equal(response.body.length, 0);
});

test('serves seekable local media with bounded, open-ended and suffix byte ranges', async t => {
  const { origin } = await fixture(t);
  for (const [range, body, contentRange] of [
    ['bytes=2-5', '2345', 'bytes 2-5/10'],
    ['bytes=7-', '789', 'bytes 7-9/10'],
    ['bytes=-3', '789', 'bytes 7-9/10'],
    ['bytes=8-99', '89', 'bytes 8-9/10'],
  ]) {
    const response = await request(origin, '/intro.mp4', { headers: { Range: range } });
    assert.equal(response.status, 206, range);
    assert.equal(response.headers['content-range'], contentRange, range);
    assert.equal(response.headers['content-length'], String(body.length), range);
    assert.equal(response.body.toString(), body, range);
  }
  for (const range of ['bytes=10-', 'bytes=7-3', 'bytes=-0', 'bytes=0-1,4-5']) {
    const response = await request(origin, '/intro.mp4', { headers: { Range: range } });
    assert.equal(response.status, 416, range);
    assert.equal(response.headers['content-range'], 'bytes */10', range);
  }
});

test('live feeds are freshly fetched despite local snapshots and strip browser credentials', async t => {
  let sequence = 0;
  const { origin, webRoot } = await fixture(t, (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600', 'Set-Cookie': 'upstream=private' });
    res.end(JSON.stringify({ sequence: ++sequence, path: req.url, method: req.method, cookie: req.headers.cookie ?? null, authorization: req.headers.authorization ?? null, conditional: req.headers['if-none-match'] ?? null, cacheControl: req.headers['cache-control'] }));
  });
  await mkdir(path.join(webRoot, 'api/live'), { recursive: true });
  await writeFile(path.join(webRoot, 'api/live/system'), '{"sequence":"stale"}');
  const headers = { Cookie: 'local=secret', Authorization: 'Bearer secret', 'If-None-Match': 'stale' };
  for (const [url, sequence] of [
    ['/api/live/system?epoch=now', 1],
    ['/api/live/system?epoch=now', 2],
    ['/api/live/body/Ceres%3B?epoch=now', 3],
    ['/api/live/body/DES%3D2026%20VJ13%3B?epoch=now&designation=2026%20VJ13', 4],
  ]) {
    const response = await request(origin, url, { headers });
    assert.equal(response.status, 200);
    assert.match(response.headers['cache-control'], /no-store/);
    assert.equal(response.headers['set-cookie'], undefined);
    assert.deepEqual(JSON.parse(response.body), { sequence, path: url, method: 'GET', cookie: null, authorization: null, conditional: null, cacheControl: 'no-cache' });
  }
});

test('missing public media and binary data stream upstream ranges without credentials', async t => {
  const paths = [
    ['/assets/video/arrival.webm?v=original', 'video/webm'],
    ['/data/live/hipparcos-motion.f64?v=original', 'application/octet-stream'],
    ['/data/live/teme-gcrs-2025-2036.f32?v=original', 'application/octet-stream'],
  ];
  const { origin } = await fixture(t, (req, res) => {
    const expected = paths.find(([url]) => url === req.url);
    assert.ok(expected, req.url);
    assert.equal(req.headers.range, 'bytes=2-5');
    assert.equal(req.headers.cookie, undefined);
    assert.equal(req.headers.authorization, undefined);
    res.writeHead(206, { 'Content-Type': expected[1], 'Content-Length': '4', 'Content-Range': 'bytes 2-5/10', 'Accept-Ranges': 'bytes' });
    res.write('23');
    setImmediate(() => res.end('45'));
  });
  for (const [url, mime] of paths) {
    const response = await request(origin, url, { headers: { Range: 'bytes=2-5', Cookie: 'secret', Authorization: 'secret' } });
    assert.equal(response.status, 206, url);
    assert.equal(response.headers['content-type'], mime, url);
    assert.equal(response.headers['content-range'], 'bytes 2-5/10', url);
    assert.equal(response.headers['content-length'], '4', url);
    assert.equal(response.body.toString(), '2345', url);
  }
});

test('upstream compressed bytes retain matching encoding and length', async t => {
  const compressed = gzipSync('export const remote = true;');
  const { origin } = await fixture(t, (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/javascript', 'Content-Encoding': 'gzip', 'Content-Length': String(compressed.length) });
    res.end(compressed);
  });
  const response = await request(origin, '/remote.js');
  assert.equal(response.status, 200);
  assert.equal(response.headers['content-encoding'], 'gzip');
  assert.equal(response.headers['content-length'], String(compressed.length));
  assert.deepEqual(response.body, compressed);
});

test('missing scripts and upstream API failures keep their status and never become the home page', async t => {
  const { origin } = await fixture(t, (req, res) => {
    if (req.url === '/api/live/solar') res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '60' }).end('{"error":"unavailable"}');
    else res.writeHead(404, { 'Content-Type': 'text/plain' }).end('asset not found');
  });
  const missing = await request(origin, '/missing.js');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.toString(), 'asset not found');
  const unavailable = await request(origin, '/api/live/solar');
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers['retry-after'], '60');
  assert.equal(unavailable.body.toString(), '{"error":"unavailable"}');
});

test('upstream HEAD sends no body and same-origin redirects stay on this server', async t => {
  const { origin } = await fixture(t, (req, res) => {
    if (req.url === '/old.css') res.writeHead(302, { Location: `http://${req.headers.host}/new.css?v=1` }).end();
    else {
      assert.equal(req.method, 'HEAD');
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': '123' }).end();
    }
  });
  const head = await request(origin, '/remote.png', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers['content-length'], '123');
  assert.equal(head.body.length, 0);
  const redirect = await request(origin, '/old.css');
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.location, '/new.css?v=1');
});

test('archive paths, traversal, symlink escapes and arbitrary proxy URLs are rejected locally', async t => {
  let upstreamCalls = 0;
  const { origin, directory, webRoot } = await fixture(t, (_req, res) => {
    upstreamCalls++;
    res.writeHead(200).end('must not be reached');
  });
  await writeFile(path.join(directory, 'private.js'), 'archive-private');
  // A directory junction exercises realpath escape checks on Windows without
  // requiring the unrelated Create symbolic links administrator privilege.
  const outside = path.join(directory, 'private-assets');
  await mkdir(outside);
  await writeFile(path.join(outside, 'private.js'), 'archive-private');
  await symlink(outside, path.join(webRoot, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const url of ['/../private.js', '/%2e%2e/private.js', '/%252e%252e/private.js', '/assets%2f..%2f..%2fprivate.js', '/..%5cprivate.js', '/escape/private.js', '/.git/config', '/README.md', '/reports/private.json', '/api/private', '/api/live/body/a%2Fb', '/api/live/body/a/b', '//example.com/evil.js', 'http://example.com/evil.js', '/bad%00.js']) {
    const response = await request(origin, url);
    assert.ok(response.status >= 400 && response.status < 500, `${url}: ${response.status}`);
    assert.ok(!response.body.toString().includes('archive-private'), url);
  }
  assert.equal(upstreamCalls, 0);
});

test('only GET and HEAD are accepted', async t => {
  const { origin } = await fixture(t);
  const response = await request(origin, '/api/live/system', { method: 'POST' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.allow, 'GET, HEAD');
});

test('connection failures and upstream timeouts are explicit gateway errors', async t => {
  const disconnected = await fixture(t);
  await close(disconnected.upstream);
  const failed = await request(disconnected.origin, '/api/live/system');
  assert.equal(failed.status, 502);
  assert.match(failed.body.toString(), /upstream/i);
  const waiting = await fixture(t, () => {}, { proxyTimeoutMs: 30 });
  const timedOut = await request(waiting.origin, '/api/live/system');
  assert.equal(timedOut.status, 504);
});

test('startServer reports the actual ephemeral port and validates its listening boundary', async t => {
  const { webRoot, upstreamOrigin } = await fixture(t);
  const started = await startServer({ webRoot, upstreamOrigin, port: 0 });
  t.after(() => started.close());
  assert.ok(started.port > 0);
  assert.equal(started.url, `http://127.0.0.1:${started.port}`);
  assert.equal((await request(started.url)).status, 200);
  assert.equal(typeof started.close, 'function');
  assert.throws(() => createSojournerServer({ webRoot, upstreamOrigin: 'http://example.com' }), /upstream/i);
  await assert.rejects(startServer({ webRoot, port: -1 }), /port/i);
});
