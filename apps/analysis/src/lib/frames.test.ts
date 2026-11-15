import { afterEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { TargetMeta } from '../types'
vi.mock('./data', () => ({ frameUrl: (id: string, file: string) => `/data/${id}/${file}` }))
import { loadFrames } from './frames'
const source: TargetMeta = JSON.parse(readFileSync('public/data/barnard/meta.json', 'utf8'))
afterEach(() => vi.unstubAllGlobals())
it('missing wide visit remains NaN instead of falling back to a small observed PNG', async () => {
  const m = structuredClone(source);m.visits=m.visits.slice(0,1);m.wide!.visits=[null]
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch)
  const frames=await loadFrames(m,0,true)
  expect(frames[0].length).toBe(m.wide!.size_px[0]**2)
  expect(frames[0].every(Number.isNaN)).toBe(true)
  expect(fetch).not.toHaveBeenCalled()
})
it('malformed wide metadata cannot silently stretch a narrow PNG', async () => {
  const m=structuredClone(source);m.visits=m.visits.slice(0,1);m.wide!.visits=[{f32:'',f32_det:{},n_exp:0}]
  vi.stubGlobal('Image',class {constructor(){throw new Error('PNG fallback must not run')}})
  await expect(loadFrames(m,0,true)).rejects.toThrow('작은 영상을 확대해 대체하지 않습니다')
})
it('an incorrectly sized wide binary fails visibly rather than rendering misaligned pixels', async () => {
  const m=structuredClone(source);m.visits=m.visits.slice(0,1);m.wide!.visits=m.wide!.visits.slice(0,1)
  vi.stubGlobal('fetch',async()=>new Response(new ArrayBuffer(59*59*4)))
  await expect(loadFrames(m,0,true)).rejects.toThrow('크기가 맞지 않음')
})
it('loads at most three local frames concurrently and retains visit order', async () => {
  let active = 0, peak = 0
  const n = source.wcs.size_px[0]
  vi.stubGlobal('fetch', async (url: string) => {
    active++; peak = Math.max(peak, active)
    await new Promise(resolve => setTimeout(resolve, 1))
    active--
    const i = source.visits.findIndex(v => url.endsWith(v.f32!))
    return new Response(new Float32Array(n * n).fill(i).buffer)
  })
  const frames = await loadFrames(source)
  expect(peak).toBeLessThanOrEqual(3)
  expect(frames.map(f => f[0])).toEqual(source.visits.map((_, i) => i))
})
it('does not start downloads after a target has been cancelled', async () => {
  const controller = new AbortController(); controller.abort()
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  await expect(loadFrames(source, 0, false, controller.signal)).rejects.toThrow()
  expect(fetch).not.toHaveBeenCalled()
})
