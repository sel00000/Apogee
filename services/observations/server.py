#!/usr/bin/env python3
"""Local observation worker: POST /api/patch starts/retries, GET polls.
Generated artifacts: /api/observations/data/patches/<id>/meta.json.
No application source, raw FITS cache, or arbitrary local files are public.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
import math
import mimetypes
import os
import queue
import re
import shutil
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse
from runtime import PATCH_DIR, CACHE_DIR

MAX_QUEUE, MAX_JOBS, MAX_BODY = 8, 128, 8192
SUCCESS_TTL, EMPTY_TTL, FAILED_TTL = 24 * 3600, 15 * 60, 60
RETENTION_SECONDS = 7 * 24 * 3600
last_pruned = 0.0
jobs: dict[str, dict] = {}
work: queue.Queue = queue.Queue(maxsize=MAX_QUEUE)
lock = threading.RLock()
DEPENDENCIES = ('numpy', 'astropy', 'pyvo', 'requests', 'PIL', 'reproject', 'astroquery')


class JobError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


class JobCancelled(Exception):
    pass


def missing_dependencies() -> list[str]:
    return [name for name in DEPENDENCIES if importlib.util.find_spec(name) is None]


def patch_id(ra: float, dec: float, fov: float) -> str:
    # Include the full supported field precision so unequal regions never share a cache key.
    return re.sub(r'[^0-9a-z_pm]', '', f'r{ra:.6f}_d{dec:+.6f}_f{fov:.6f}'.replace('+', 'p').replace('-', 'm').replace('.', '_'))


def validate_input(value: dict) -> tuple[float, float, float]:
    if not isinstance(value, dict):
        raise JobError('JSON object required')
    try:
        if any(isinstance(value.get(k), bool) for k in ('ra', 'dec', 'fov')):
            raise ValueError()
        ra, dec, fov = float(value['ra']), float(value['dec']), float(value.get('fov', .1))
    except (KeyError, TypeError, ValueError):
        raise JobError('RA, Dec and field must be finite numbers') from None
    if not all(math.isfinite(x) for x in (ra, dec, fov)) or not (0 <= ra < 360 and -90 <= dec <= 90 and .025 <= fov <= .5):
        raise JobError('RA 0–360°, Dec −90–90°, field 0.025–0.5°')
    return ra, dec, fov


def _view(pid: str, state: dict) -> dict:
    return dict(id=pid, url=f'/api/observations/data/patches/{pid}/meta.json', **state, queue=work.qsize())


def _cached(pid: str, now: float) -> dict | None:
    path = PATCH_DIR / pid / 'meta.json'
    try:
        meta = json.loads(path.read_text(encoding='utf-8'))
        status = meta.get('status', 'done')
        if status == 'ok':
            status = 'done'
        if status not in ('done', 'no_data', 'fetch_failed'):
            return None
        ttl = SUCCESS_TTL if status == 'done' else EMPTY_TTL if status == 'no_data' else FAILED_TTL
        if now - path.stat().st_mtime > ttl or (status == 'done' and not meta.get('visits')):
            return None
        return dict(status=status, message=meta.get('status_detail', ''), cached=True, updatedAt=path.stat().st_mtime)
    except (OSError, ValueError, TypeError):
        return None


def prune_runtime(now: float | None = None) -> None:
    """Remove only old, inactive result/cache children inside the declared roots."""
    now = time.time() if now is None else now
    with lock:
        active = {pid for pid, state in jobs.items() if state['status'] in ('queued', 'running')}
    for base in (PATCH_DIR, CACHE_DIR / 'patches'):
        if not base.is_dir():
            continue
        resolved_base = base.resolve()
        for child in base.iterdir():
            # Resolve and contain each recursive removal; never follow junctions/symlinks.
            resolved = child.resolve()
            if child.name in active or child.is_symlink() or resolved.parent != resolved_base or not child.is_dir():
                continue
            try:
                meta = child / 'meta.json'
                touched = max(child.stat().st_mtime, meta.stat().st_mtime if meta.exists() else 0)
                if now - touched > RETENTION_SECONDS:
                    shutil.rmtree(resolved)
            except OSError:
                # A concurrently read or locked artifact can be retried at the next pass.
                continue


def patch_status(ra: float, dec: float, fov: float, retry: bool = False, *, create: bool = True) -> dict:
    global last_pruned
    ra, dec, fov = validate_input(dict(ra=ra, dec=dec, fov=fov))
    pid, now = patch_id(ra, dec, fov), time.time()
    with lock:
        if now - last_pruned > 3600:
            prune_runtime(now)
            last_pruned = now
        state = jobs.get(pid)
        if state and state['status'] in ('queued', 'running'):
            return _view(pid, state.copy())
        if state and state['status'] in ('failed', 'fetch_failed', 'cancelled') and not retry:
            return _view(pid, state.copy())
        cached = None if retry else _cached(pid, now)
        if cached:
            return _view(pid, cached)
        if not create:
            raise JobError('Observation job unavailable. Start or retry the request.', 404)
        missing = missing_dependencies()
        if missing:
            raise JobError('Observation dependencies unavailable: ' + ', '.join(missing) + '. Run project setup.', 503)
        if work.full():
            raise JobError('Observation queue is full. Try again after the current jobs finish.', 429)
        while len(jobs) >= MAX_JOBS:
            old = next((k for k, v in jobs.items() if v['status'] not in ('queued', 'running')), None)
            if old is None:
                raise JobError('Observation job capacity reached.', 429)
            jobs.pop(old)
        state = dict(status='queued', message='대기 중', done=0, total=0, createdAt=now, updatedAt=now)
        jobs[pid] = state
        work.put_nowait((pid, ra, dec, fov))
        return _view(pid, state.copy())


def cancel_job(pid: str) -> dict:
    with lock:
        state = jobs.get(pid)
        if not state:
            raise JobError('Observation job not found', 404)
        if state['status'] in ('queued', 'running'):
            state.update(status='cancelled', message='취소됨', updatedAt=time.time())
        return _view(pid, state.copy())


def run_job(item: tuple) -> None:
    pid, ra, dec, fov = item
    with lock:
        if jobs.get(pid, {}).get('status') == 'cancelled':
            return
        jobs[pid].update(status='running', updatedAt=time.time())
    def progress(message: str, done: int, total: int) -> None:
        with lock:
            if jobs[pid]['status'] == 'cancelled':
                raise JobCancelled()
            jobs[pid].update(status='running', message=message, done=done, total=total, updatedAt=time.time())
    try:
        import patch as pipeline
        result = pipeline.bake_patch(ra, dec, fov, progress)
        with lock:
            if jobs[pid]['status'] != 'cancelled':
                jobs[pid].update(status='done' if result['status'] == 'ok' else result['status'],
                                 message=result.get('detail', ''), updatedAt=time.time())
    except JobCancelled:
        pass
    except Exception as error:
        with lock:
            if jobs[pid]['status'] != 'cancelled':
                jobs[pid].update(status='failed', message=f'{type(error).__name__}: {error}', updatedAt=time.time())


def worker() -> None:
    while True:
        item = work.get()
        try:
            run_job(item)
        finally:
            work.task_done()


def resolve(name: str) -> dict:
    if not isinstance(name, str) or not name.strip() or len(name) > 160:
        raise JobError('A target name of 1–160 characters is required')
    import bake
    value = bake.simbad_lookup(name.strip())
    return dict(name=value['main_id'], ra=value['ra'], dec=value['dec'], frame='ICRS', coordinateEpoch='J2000',
                properMotion=dict(raCosDecMasYr=value.get('pmra'), decMasYr=value.get('pmdec')),
                note=f"SIMBAD [{value['server']}] ICRS catalogue coordinates, epoch J2000")


def normalized_path(path: str) -> str:
    prefix = '/api/observations/'
    if path.startswith(prefix):
        rest = path[len(prefix):]
        return '/' + rest if rest.startswith('data/') else '/api/' + rest
    return path


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: bytes, content_type: str) -> None:
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        if code == 429:
            self.send_header('Retry-After', '5')
        self.end_headers()
        if self.command != 'HEAD':
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def _json(self, code: int, value: dict) -> None:
        self._send(code, json.dumps(value, ensure_ascii=False, allow_nan=False).encode('utf-8'), 'application/json; charset=utf-8')

    def _trusted_request(self) -> bool:
        if self.client_address[0] not in ('127.0.0.1', '::1', '::ffff:127.0.0.1') or self.headers.get('Sec-Fetch-Site') == 'cross-site':
            return False
        try:
            if urlparse('http://' + self.headers.get('Host', '')).hostname not in ('localhost', '127.0.0.1', '::1'):
                return False
        except ValueError:
            return False
        origin = self.headers.get('Origin')
        if origin:
            allowed = set(filter(None, os.environ.get('SPHEREX_ALLOWED_ORIGINS', '').split(',')))
            try:
                if urlparse(origin).hostname not in ('localhost', '127.0.0.1', '::1') and origin not in allowed:
                    return False
            except ValueError:
                return False
        return True

    def _dispatch(self) -> None:
        if not self._trusted_request():
            return self._json(403, dict(error='Use the application gateway to access this local service.'))
        parsed = urlparse(self.path)
        path = normalized_path(unquote(parsed.path))
        query = {k: v[0] for k, v in parse_qs(parsed.query).items()}
        try:
            if path == '/api/health' and self.command in ('GET', 'HEAD'):
                missing = missing_dependencies()
                return self._json(200, dict(ok=True, available=not missing, missing=missing, queue=work.qsize(), maxQueue=MAX_QUEUE))
            if path == '/api/resolve' and self.command == 'GET':
                return self._json(200, resolve(query.get('name', '')))
            if path == '/api/patch' and self.command in ('GET', 'POST'):
                value = query if self.command == 'GET' else self._read_json()
                ra, dec, fov = validate_input(value)
                retry = value.get('retry') is True or value.get('retry') == '1'
                return self._json(200, patch_status(ra, dec, fov, retry=retry and self.command == 'POST'))
            if path.startswith('/api/jobs/') and self.command == 'DELETE':
                return self._json(200, cancel_job(path.rsplit('/', 1)[1]))
            if self.command in ('GET', 'HEAD') and path.startswith('/data/patches/'):
                return self._artifact(path[len('/data/patches/'):])
            return self._json(404, dict(error='Unknown observation endpoint'))
        except JobError as error:
            return self._json(error.status, dict(error=str(error)))
        except (ValueError, KeyError, TypeError) as error:
            return self._json(400, dict(error=str(error)))
        except Exception as error:
            return self._json(502, dict(error=f'{type(error).__name__}: {error}'))

    def _read_json(self) -> dict:
        if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
            raise JobError('Use Content-Type: application/json', 415)
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            raise JobError('Invalid content length') from None
        if not 0 < length <= MAX_BODY:
            raise JobError('Request body is empty or too large', 413)
        self.connection.settimeout(10)
        return json.loads(self.rfile.read(length))

    def _artifact(self, relative: str) -> None:
        if '\\' in relative or '\x00' in relative or any(p.startswith('.') for p in relative.split('/')):
            raise JobError('Invalid result path', 403)
        path = (PATCH_DIR / relative).resolve()
        if not path.is_relative_to(PATCH_DIR.resolve()) or path.suffix not in ('.json', '.png', '.f32') or not path.is_file():
            raise JobError('Result not found', 404)
        return self._send(200, path.read_bytes(), mimetypes.guess_type(path.name)[0] or 'application/octet-stream')

    do_GET = _dispatch
    do_HEAD = _dispatch
    do_POST = _dispatch
    do_DELETE = _dispatch

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write((fmt % args) + '\n')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='127.0.0.1', choices=('127.0.0.1', 'localhost'))
    parser.add_argument('--port', type=int, default=int(os.environ.get('SPHEREX_OBSERVATIONS_PORT', '8000')))
    args = parser.parse_args()
    threading.Thread(target=worker, daemon=True).start()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print('SPHEREX_OBSERVATIONS_READY=' + json.dumps(dict(port=server.server_port, host='127.0.0.1')), flush=True)
    print(f'Observation service: http://{args.host}:{server.server_port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
