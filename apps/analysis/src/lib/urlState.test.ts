import { afterEach, expect, it, vi } from 'vitest'
import { writeView } from './urlState'

afterEach(() => vi.unstubAllGlobals())

it('publishes the updated embedded analysis state after storing a selected tool and visit', () => {
  const location = { href: 'http://localhost:8781/analysis/?target=wise0855&embed=1', origin: 'http://localhost:8781' }
  const postMessage = vi.fn()
  vi.stubGlobal('window', { location, parent: { postMessage }, history: { replaceState: (_state: unknown, _title: string, url: URL) => { location.href = url.href } } })
  writeView({ ui: 'research', tab: 'spectrum', visit: 2 })
  expect(location.href).toBe('http://localhost:8781/analysis/?target=wise0855&embed=1&mode=research&tab=spectrum&visit=3')
  expect(postMessage).toHaveBeenCalledWith({ type: 'spherex-analysis-url', query: 'target=wise0855&mode=research&tab=spectrum&visit=3' }, 'http://localhost:8781')
})
