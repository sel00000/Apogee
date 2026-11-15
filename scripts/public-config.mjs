import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export function serviceAddress(value, name) {
  if (typeof value !== 'string') throw new Error(`${name} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed) return '';
  const local = trimmed.startsWith('/') && !trimmed.startsWith('//');
  let url;
  try { url = new URL(trimmed, local ? 'https://config.invalid' : undefined); }
  catch { throw new Error(`${name} must be an HTTPS service address or an absolute path.`); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((!local && url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must not contain credentials, query parameters, fragments, or insecure remote HTTP.`);
  }
  return local ? url.pathname.replace(/\/$/, '') || '/' : url.href.replace(/\/$/, '');
}

export async function publicConfig(root, env = process.env) {
  let saved = {};
  try { saved = JSON.parse(await readFile(join(root, 'deployment/public.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return {
    version: '5.0.0',
    apiBase: serviceAddress(env.SPHEREX_API_BASE ?? saved.apiBase ?? '', 'apiBase'),
    experienceUrl: serviceAddress(env.SPHEREX_EXPERIENCE_URL ?? saved.experienceUrl ?? '', 'experienceUrl'),
    localServices: false,
  };
}
