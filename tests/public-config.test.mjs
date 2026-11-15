import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publicConfig, serviceAddress } from '../scripts/public-config.mjs';

test('public service settings keep deployment prefixes and exclude secrets', () => {
  assert.equal(serviceAddress(' https://api.example.org/skylab/ ', 'apiBase'), 'https://api.example.org/skylab');
  assert.equal(serviceAddress('/backend/', 'apiBase'), '/backend');
  assert.equal(serviceAddress('http://127.0.0.1:4173', 'apiBase'), 'http://127.0.0.1:4173');
  for (const value of ['https://user:secret@example.org', 'https://example.org/?token=secret', 'http://example.org', '//example.org', 'javascript:alert(1)']) {
    assert.throws(() => serviceAddress(value, 'apiBase'));
  }
});

test('checked-in endpoints are used and environment overrides do not enable local services', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spherex-config-'));
  try {
    await mkdir(join(dir, 'deployment'));
    await writeFile(join(dir, 'deployment/public.json'), JSON.stringify({ apiBase: 'https://api.example.org', experienceUrl: 'https://experience.example.org' }));
    const config = await publicConfig(dir, { SPHEREX_API_BASE: 'https://test.example.org/service/' });
    assert.equal(config.apiBase, 'https://test.example.org/service');
    assert.equal(config.experienceUrl, 'https://experience.example.org');
    assert.equal(config.localServices, false);
    await writeFile(join(dir, 'deployment/public.json'), '{invalid');
    await assert.rejects(publicConfig(dir, {}), SyntaxError);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
