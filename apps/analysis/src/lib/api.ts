// API_BASE is an optional server origin / deployment prefix, not an /api suffix.
import type { TargetMeta } from '../types'
import type { Radec } from './coords'

export const API_BASE: string = ((import.meta.env.VITE_API_BASE as string | undefined) ?? '').replace(/\/$/, '')

let hostingMode: { url: string; localServices: boolean } | null = null

async function requireObservationService(signal?: AbortSignal | null): Promise<void> {
  // An explicit API deployment remains authoritative. The shell configuration is
  // one level above /analysis/, including on /repository/analysis/ Pages URLs.
  if (API_BASE || typeof document === 'undefined') return
  signal?.throwIfAborted()
  const url = new URL('../config.json', document.baseURI).href
  if (hostingMode?.url !== url) {
    try {
      const response = await fetch(url, { cache: 'no-cache', signal })
      if (!response.ok) return
      const config = await response.json()
      if (typeof config?.localServices !== 'boolean') return
      hostingMode = { url, localServices: config.localServices }
    } catch (error) {
      if (signal?.aborted) throw error
      // Missing/unreadable config does not prove static hosting: preserve the
      // real API's validation, availability and network error handling below.
      return
    }
  }
  signal?.throwIfAborted()
  if (hostingMode?.localServices === false) {
    throw new Error('현재 웹사이트에는 새 관측 자료를 처리하는 Python 분석 서버가 연결되어 있지 않습니다. 준비된 대상의 관측·분석 결과는 계속 볼 수 있습니다. 새 좌표 분석은 로컬 프로그램에서 실행하세요.')
  }
}

export interface PatchJob {
  id: string
  url: string
  status: 'queued' | 'running' | 'done' | 'no_data' | 'fetch_failed' | 'failed' | 'cancelled'
  message?: string
  done?: number
  total?: number
  queue?: number
}

export function patchError(job: PatchJob): string | null {
  return job.status === 'failed' || job.status === 'fetch_failed' || job.status === 'cancelled'
    ? job.message || '관측 자료를 받거나 처리하지 못했습니다. 다시 시도할 수 있습니다.' : null
}

async function get<T>(path: string, options: RequestInit = {}): Promise<T> {
  await requireObservationService(options.signal)
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { cache: 'no-cache', ...options })
  } catch (e) {
    if (options.signal?.aborted) throw e
    throw new Error(`관측 분석 서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요. (${(e as Error).message})`)
  }
  const body = await res.json().catch(() => null)
  if (!res.ok || !body) throw new Error(body?.error ?? `서버 응답 HTTP ${res.status}`)
  return body as T
}

export const resolveName = (name: string, signal?: AbortSignal) =>
  get<{ name: string; ra: number; dec: number; note: string; frame: string; coordinateEpoch: string }>(`/api/resolve?name=${encodeURIComponent(name)}`, { signal })

export const requestPatch = (c: Radec, fov: number, retry = false, signal?: AbortSignal) =>
  get<PatchJob>('/api/patch', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ra: c.ra, dec: c.dec, fov, retry }) })

export const pollPatch = (c: Radec, fov: number, signal?: AbortSignal) =>
  get<PatchJob>(`/api/patch?ra=${c.ra}&dec=${c.dec}&fov=${fov}`, { signal })

export const cancelPatch = (id: string) => {
  if (!/^[a-z0-9_]+$/.test(id)) return Promise.reject(new Error('분석 작업 식별자가 올바르지 않습니다.'))
  return get<PatchJob>(`/api/observations/jobs/${id}`, { method:'DELETE' })
}

export async function loadPatchMeta(job: PatchJob, signal?: AbortSignal): Promise<TargetMeta> {
  const path = `/${job.url.replace(/^\/+/, '')}`
  if (!/^\/(?:api\/observations\/)?data\/patches\/[a-z0-9_]+\/meta\.json$/.test(path)) throw new Error('관측 결과 경로가 올바르지 않습니다.')
  const meta = await get<TargetMeta>(path, { signal })
  if (meta.status === 'fetch_failed') throw new Error(meta.status_detail || '관측 자료 다운로드에 실패했습니다.')
  if (!Array.isArray(meta.visits)) throw new Error('관측 결과 형식이 올바르지 않습니다.')
  meta.base = `${API_BASE}${path.replace(/meta\.json$/, '')}`
  return meta
}
