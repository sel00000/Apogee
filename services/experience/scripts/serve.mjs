import { spawn } from 'node:child_process';
import { createReadStream, realpathSync } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { pipeline } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ORIGINAL_ORIGIN = 'https://sojourner.artificialisabel.com';
const DEFAULT_WEB_ROOT = fileURLToPath(new URL('../../../apps/experience/web/', import.meta.url));
const DEFAULT_PORT = 0;
const LIVE_FEEDS = new Set(['system', 'spacecraft', 'asteroids', 'satellites', 'solar']);
const PUBLIC_DIRECTORIES = new Set(['assets', 'data', 'audio', 'video', 'fonts', 'images', 'textures', 'models']);
const MIME_TYPES = new Map(Object.entries({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.ktx2': 'image/ktx2',
  '.hdr': 'image/vnd.radiance',
  '.exr': 'image/x-exr',
  '.bin': 'application/octet-stream',
  '.f32': 'application/octet-stream',
  '.f64': 'application/octet-stream',
  '.basis': 'application/octet-stream',
}));
const FORWARDED_RESPONSE_HEADERS = [
  'content-type', 'content-length', 'content-encoding', 'content-range',
  'accept-ranges', 'cache-control', 'etag', 'last-modified', 'expires', 'vary', 'retry-after',
];

function sendText(request, response, status, message, headers = {}) {
  if (response.destroyed || response.writableEnded) return;
  const body = `${message}\n`;
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

function requestPath(requestUrl) {
  // Validate before URL parsing, which would otherwise remove dot segments.
  if (!requestUrl?.startsWith('/') || requestUrl.startsWith('//') || requestUrl.includes('#')) return null;
  const encodedPath = requestUrl.split('?')[0];
  let pathname;
  try { pathname = decodeURIComponent(encodedPath); } catch { return null; }
  if (/[\\%\x00-\x1f\x7f:]/u.test(pathname)) return null;
  if (pathname.split('/').some(segment => segment.startsWith('.'))) return null;
  return pathname;
}

function liveRoute(pathname) {
  if (LIVE_FEEDS.has(pathname.slice('/api/live/'.length)) && pathname.startsWith('/api/live/')) return true;
  if (!pathname.startsWith('/api/live/body/')) return false;
  // Preserve the client's encoded numeric IDs and designations such as "DES=2026 VJ13;".
  const id = pathname.slice('/api/live/body/'.length);
  return id.length <= 160 && (/^[A-Za-z0-9_+;.-]+$/u.test(id) || /^DES=[A-Za-z0-9_+ .-]+;$/u.test(id));
}

function publicAsset(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const extension = path.extname(pathname).toLowerCase();
  if (extension === '.md' && segments[0] !== 'data') return false;
  return MIME_TYPES.has(extension)
    && (segments.length === 1 || PUBLIC_DIRECTORIES.has(segments[0]));
}

function contained(root, file) {
  const relative = path.relative(root, file);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function byteRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/u.exec(value);
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last))) return null;
  const start = first === null ? Math.max(0, size - last) : first;
  const end = first === null || last === null ? size - 1 : Math.min(last, size - 1);
  return start <= end && start < size ? { start, end } : null;
}

async function serveLocal(request, response, pathname, webRoot) {
  let filename;
  let info;
  try {
    filename = await realpath(path.resolve(webRoot, `.${pathname === '/' ? '/index.html' : pathname}`));
    if (!contained(webRoot, filename)) {
      sendText(request, response, 403, 'This path is outside the public website.');
      return true;
    }
    info = await stat(filename);
    if (info.isDirectory()) {
      filename = await realpath(path.join(filename, 'index.html'));
      if (!contained(webRoot, filename)) {
        sendText(request, response, 403, 'This path is outside the public website.');
        return true;
      }
      info = await stat(filename);
    }
    if (!info.isFile()) {
      sendText(request, response, 404, 'Public file not found.');
      return true;
    }
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false;
    sendText(request, response, error.code === 'EACCES' ? 403 : 500, 'Unable to read this public file.');
    return true;
  }

  let status = 200;
  let range;
  const headers = {
    'Content-Type': MIME_TYPES.get(path.extname(filename).toLowerCase()) ?? 'application/octet-stream',
    'Content-Length': info.size,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache',
    'Last-Modified': info.mtime.toUTCString(),
    'X-Content-Type-Options': 'nosniff',
  };
  if (request.method === 'GET' && request.headers.range) {
    range = byteRange(request.headers.range, info.size);
    if (!range) {
      sendText(request, response, 416, 'Requested byte range is not available.', { 'Content-Range': `bytes */${info.size}` });
      return true;
    }
    status = 206;
    headers['Content-Range'] = `bytes ${range.start}-${range.end}/${info.size}`;
    headers['Content-Length'] = range.end - range.start + 1;
  }
  response.writeHead(status, headers);
  if (request.method === 'HEAD' || info.size === 0) response.end();
  else pipeline(createReadStream(filename, range), response, () => {});
  return true;
}

function validatedUpstream(value) {
  const origin = new URL(value);
  const loopbackFixture = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
    && ['http:', 'https:'].includes(origin.protocol);
  if ((origin.origin !== ORIGINAL_ORIGIN && !loopbackFixture) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('The upstream must be the original HTTPS site or a loopback test fixture.');
  }
  return origin;
}

function proxyOriginal(request, response, upstreamOrigin, isLive, timeoutMs) {
  // Native HTTP streams preserve compressed bytes and their Content-Length.
  // Only these public request headers cross the bridge; cookies/auth never do.
  const headers = { 'accept-encoding': 'identity' };
  if (request.headers.accept) headers.accept = request.headers.accept;
  if (request.headers.range && !isLive) headers.range = request.headers.range;
  if (isLive) {
    headers['cache-control'] = 'no-cache';
    headers.pragma = 'no-cache';
  }
  const transport = upstreamOrigin.protocol === 'https:' ? https : http;
  let timedOut = false;
  const upstream = transport.request({
    protocol: upstreamOrigin.protocol,
    hostname: upstreamOrigin.hostname.replace(/^\[|\]$/gu, ''),
    port: upstreamOrigin.port || undefined,
    path: request.url,
    method: isLive ? 'GET' : request.method,
    headers,
  });
  const timeout = () => {
    timedOut = true;
    upstream.destroy(new Error('Upstream timed out.'));
  };
  const headerDeadline = setTimeout(timeout, timeoutMs);
  upstream.setTimeout(timeoutMs, timeout);
  upstream.on('response', remote => {
    clearTimeout(headerDeadline);
    const outgoing = { 'X-Content-Type-Options': 'nosniff' };
    for (const header of FORWARDED_RESPONSE_HEADERS) {
      if (remote.headers[header] !== undefined) outgoing[header] = remote.headers[header];
    }
    if (isLive) outgoing['cache-control'] = 'no-store';
    if (remote.headers.location) {
      let destination;
      try { destination = new URL(remote.headers.location, new URL(request.url, upstreamOrigin)); } catch { /* Reject malformed redirects below. */ }
      if (!destination || destination.origin !== upstreamOrigin.origin) {
        remote.resume();
        sendText(request, response, 502, 'Upstream redirected outside the original site.');
        return;
      }
      outgoing.location = destination.pathname + destination.search + destination.hash;
    }
    response.writeHead(remote.statusCode, outgoing);
    if (request.method === 'HEAD') {
      remote.resume();
      remote.on('error', () => {});
      response.end();
    } else {
      pipeline(remote, response, () => {});
    }
  });
  upstream.on('error', () => {
    clearTimeout(headerDeadline);
    if (response.headersSent) response.destroy();
    else sendText(request, response, timedOut ? 504 : 502, timedOut ? 'The original upstream site timed out.' : 'The original upstream site could not be reached.');
  });
  response.on('close', () => {
    if (!response.writableFinished) {
      clearTimeout(headerDeadline);
      upstream.destroy();
    }
  });
  upstream.end();
}

/** Serve only web/. The upstream override is restricted to local test fixtures. */
export function createSojournerServer({ webRoot = process.env.SPHEREX_EXPERIENCE_ROOT || DEFAULT_WEB_ROOT, upstreamOrigin = ORIGINAL_ORIGIN, proxyTimeoutMs = 180_000 } = {}) {
  const root = realpathSync(webRoot);
  const upstream = validatedUpstream(upstreamOrigin);
  return http.createServer((request, response) => {
    const run = async () => {
      if (!['GET', 'HEAD'].includes(request.method)) {
        sendText(request, response, 405, 'Only GET and HEAD are supported.', { Allow: 'GET, HEAD' });
        return;
      }
      const pathname = requestPath(request.url);
      if (pathname === null) {
        sendText(request, response, 400, 'Invalid public website path.');
        return;
      }
      if (pathname.startsWith('/api/')) {
        if (liveRoute(pathname)) proxyOriginal(request, response, upstream, true, proxyTimeoutMs);
        else sendText(request, response, 404, 'This API route is not part of the public live bridge.');
        return;
      }
      if (await serveLocal(request, response, pathname, root)) return;
      if (publicAsset(pathname)) proxyOriginal(request, response, upstream, false, proxyTimeoutMs);
      else sendText(request, response, 404, 'Public file not found.');
    };
    run().catch(() => {
      if (response.headersSent) response.destroy();
      else sendText(request, response, 500, 'The local website server could not complete this request.');
    });
  });
}

// Neutral service name; keep the original export for the recovered server's tests.
export const createServer = createSojournerServer;

export async function startServer({ port = process.env.PORT ?? DEFAULT_PORT, ...options } = {}) {
  if (!/^\d+$/u.test(String(port)) || Number(port) > 65535) throw new Error('PORT must be an integer from 0 to 65535.');
  const server = createSojournerServer(options);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(Number(port), '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  const actualPort = server.address().port;
  const close = () => new Promise((resolve, reject) => {
    server.closeAllConnections();
    if (!server.listening) return resolve();
    server.close(error => error ? reject(error) : resolve());
  });
  return { server, port: actualPort, url: `http://127.0.0.1:${actualPort}`, close };
}

function openBrowser(url) {
  let command;
  let args;
  if (process.platform === 'win32' || process.env.WSL_DISTRO_NAME) {
    command = process.platform === 'win32' ? 'cmd' : 'cmd.exe';
    args = ['/d', '/c', 'start', '', url];
  } else {
    command = process.platform === 'darwin' ? 'open' : 'xdg-open';
    args = [url];
  }
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => console.log(`Open this address in your browser: ${url}`));
  child.on('exit', code => {
    if (code) console.log(`Open this address in your browser: ${url}`);
  });
  child.unref();
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22 or later is required.');
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--open') continue;
      if (args[i] === '--port' && args[i + 1] !== undefined) options.port = args[++i];
      else if (args[i] === '--root' && args[i + 1]) options.webRoot = path.resolve(args[++i]);
      else throw new Error('Usage: node services/experience/scripts/serve.mjs [--open] [--port N] [--root WEB_ROOT]');
    }
    const { server, url } = await startServer(options);
    console.log(`SOJOURNER is running at ${url}/`);
    console.log(`Live data and uncopied public media use ${ORIGINAL_ORIGIN} (internet required).`);
    console.log('Keep this window open. Press Ctrl+C to stop.');
    if (process.argv.includes('--open')) openBrowser(`${url}/`);
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.once(signal, () => {
        server.closeAllConnections();
        server.close(() => process.exit(0));
      });
    }
  } catch (error) {
    console.error(error.code === 'EADDRINUSE' ? 'That port is already in use. Set PORT to another number and run again.' : error.message);
    process.exitCode = 1;
  }
}
