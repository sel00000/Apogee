import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadPatchMeta, patchError, pollPatch, requestPatch } from './api'

afterEach(() => vi.unstubAllGlobals())

describe('coordinate job retry contract', () => {
  it('does not retry terminal work during normal polling but sends an explicit retry flag on demand', async () => {
    const requests: { path: string; options: RequestInit }[] = []
    vi.stubGlobal('fetch', async (path: string, options: RequestInit) => {
      requests.push({ path, options })
      return new Response(JSON.stringify({ id: 'test', status: 'queued', url: 'data/patches/test/meta.json' }))
    })
    await requestPatch({ ra: 222.866022, dec: -11.907528 }, .1)
    await requestPatch({ ra: 222.866022, dec: -11.907528 }, .1, true)
    await pollPatch({ ra: 222.866022, dec: -11.907528 }, .1)
    expect(requests[0].options.method).toBe('POST')
    expect(JSON.parse(requests[0].options.body as string)).toEqual({ra:222.866022,dec:-11.907528,fov:.1,retry:false})
    expect(JSON.parse(requests[1].options.body as string).retry).toBe(true)
    expect(requests[2].path).toBe('/api/patch?ra=222.866022&dec=-11.907528&fov=0.1')
    expect(requests[2].options.method).toBeUndefined()
  })
  it('treats a transient fetch failure as an error, while preserving genuine empty coverage', () => {
    expect(patchError({id:'x',url:'',status:'fetch_failed',message:'archive unavailable'})).toBe('archive unavailable')
    expect(patchError({id:'x',url:'',status:'no_data'})).toBeNull()
  })
  it('uses the returned namespaced data URL without double slashes and rejects remote result URLs', async () => {
    const fetch = vi.fn(async (_path: string, _options?: RequestInit) => new Response(JSON.stringify({ id:'x',visits:[] }), {headers:{'content-type':'application/json'}}))
    vi.stubGlobal('fetch', fetch)
    const meta = await loadPatchMeta({id:'x',status:'no_data',url:'/api/observations/data/patches/x/meta.json'})
    expect(fetch.mock.calls[0][0]).toBe('/api/observations/data/patches/x/meta.json')
    expect(meta.base).toBe('/api/observations/data/patches/x/')
    await expect(loadPatchMeta({id:'x',status:'done',url:'https://example.test/data.json'})).rejects.toThrow('경로')
  })
  it('forwards cancellation without disguising it as a service outage', async () => {
    const controller = new AbortController()
    controller.abort()
    const failure = new DOMException('cancelled', 'AbortError')
    vi.stubGlobal('fetch', vi.fn(async () => { throw failure }))
    await expect(requestPatch({ra:1,dec:2}, .1, false, controller.signal)).rejects.toBe(failure)
  })
})

describe('static publication capability', () => {
  it('explains the missing processing server under a repository path without sending an API request', async () => {
    vi.stubGlobal('document', {baseURI:'https://owner.github.io/Apogee/analysis/?embed=1'})
    const fetch = vi.fn(async (_url: string) => new Response(JSON.stringify({localServices:false})))
    vi.stubGlobal('fetch', fetch)
    await expect(requestPatch({ra:1,dec:2}, .05)).rejects.toThrow('준비된 대상의 관측·분석 결과는 계속 볼 수 있습니다')
    await expect(pollPatch({ra:1,dec:2}, .05)).rejects.toThrow('Python 분석 서버')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0]?.[0]).toBe('https://owner.github.io/Apogee/config.json')
  })
  it('preserves backend validation errors when local services are enabled', async () => {
    vi.stubGlobal('document', {baseURI:'http://127.0.0.1:4183/analysis/'})
    const fetch = vi.fn(async (url: string) => url.endsWith('/config.json')
      ? new Response(JSON.stringify({localServices:true}))
      : new Response(JSON.stringify({error:'coordinates outside supported range'}), {status:400}))
    vi.stubGlobal('fetch', fetch)
    await expect(requestPatch({ra:1,dec:2}, .05)).rejects.toThrow('coordinates outside supported range')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('does not infer static hosting from a missing config or disguise a network failure', async () => {
    vi.stubGlobal('document', {baseURI:'https://science.example/analysis/'})
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/config.json')) return new Response('not found', {status:404})
      throw new Error('connection reset')
    })
    vi.stubGlobal('fetch', fetch)
    await expect(requestPatch({ra:1,dec:2}, .05)).rejects.toThrow('connection reset')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('preserves cancellation during the capability check', async () => {
    vi.stubGlobal('document', {baseURI:'https://cancel.example/repository/analysis/'})
    const controller = new AbortController()
    const failure = new DOMException('cancelled config lookup', 'AbortError')
    vi.stubGlobal('fetch', vi.fn(async () => { controller.abort(failure); throw failure }))
    await expect(requestPatch({ra:1,dec:2}, .05, false, controller.signal)).rejects.toBe(failure)
  })
})
