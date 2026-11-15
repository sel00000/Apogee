import { useEffect, useMemo, useRef, useState } from 'react'
import type { TargetsIndex } from '../types'
import { FOV_MAX, FOV_MIN, SkyGlobe } from '../gl/SkyGlobe'
import type { GlobeView } from '../gl/SkyGlobe'
import { MAP_CHANNELS, SPHEREX_HIPS, sesame } from '../lib/sky'
import { parseCoords } from '../lib/coords'
import type { Radec } from '../lib/coords'
import { useL } from '../lib/i18n'
import { DETECTORS } from './PhotometryPanel'
import { Badge } from './Badge'

// Live all-sky navigator. The globe engine (gl/SkyGlobe.ts, gl/globe/*) is 경보's TrueBlink code,
// used unchanged: it reads SPHEREx all-sky HiPS tiles straight from IRSA (CORS allowed, no relay)
// for one of the 102 spectral channels and lets you drag, zoom and click the celestial sphere.

const pad = (n: number, w = 2) => String(n).padStart(w, '0')
export function fmtHms(ra: number) {
  const s = (((ra % 360) + 360) % 360) / 15 * 3600
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return `${pad(h)}h${pad(m)}m${sec.toFixed(1).padStart(4, '0')}s`
}
export function fmtDms(dec: number) {
  const sg = dec < 0 ? '−' : '+', a = Math.abs(dec) * 3600
  const d = Math.floor(a / 3600), m = Math.floor((a % 3600) / 60), s = a % 60
  return `${sg}${pad(d)}°${pad(m)}′${s.toFixed(0).padStart(2, '0')}″`
}
const sep = (a: Radec, b: Radec) => {
  const r = Math.PI / 180
  const c = Math.sin(a.dec * r) * Math.sin(b.dec * r) + Math.cos(a.dec * r) * Math.cos(b.dec * r) * Math.cos((a.ra - b.ra) * r)
  return Math.acos(Math.min(1, c)) / r
}
const detectorOf = (um: number) => (um < 1.095 ? 1 : um < 1.625 ? 2 : um < 2.415 ? 3 : um < 3.825 ? 4 : um < 4.415 ? 5 : 6)

type Pick = { ra: number; dec: number; name?: string }

export function SkyPanel({ index, currentId, onOpenTarget, onPatch }: {
  index: TargetsIndex
  currentId: string | null
  onOpenTarget: (id: string) => void
  onPatch: (c: Radec, fov: number, label?: string) => void
}) {
  const L = useL()
  const box = useRef<HTMLDivElement>(null)
  const globe = useRef<SkyGlobe | null>(null)
  const targets = useMemo(() => index.targets.filter((t) => t.ra !== undefined && t.dec !== undefined && t.status === 'ok'), [index])
  const start = targets.find((t) => t.id === currentId) ?? targets[0]
  const [ci, setCi] = useState(() => Math.max(0, MAP_CHANNELS.findIndex((c) => c.um >= 1.2)))
  const [view, setView] = useState<GlobeView>({ ra: start?.ra ?? 83.8, dec: start?.dec ?? -1.2, fovDeg: 40 })
  const [status, setStatus] = useState({ loaded: 0, pending: 0, failed: 0, order: 0, note: '' })
  const [picked, setPicked] = useState<Pick | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [fov, setFov] = useState(0.1)

  useEffect(() => {
    const el = box.current!
    const g = new SkyGlobe(el, { baseUrl: SPHEREX_HIPS, view: { ra: start?.ra, dec: start?.dec, fovDeg: 40 }, channel: MAP_CHANNELS[ci].channel })
    globe.current = g
    const offPick = g.on('pick', (p) => {
      const t = p.markerId ? targets.find((x) => x.id === p.markerId) : undefined
      setPicked({ ra: t?.ra ?? p.ra, dec: t?.dec ?? p.dec, name: t?.display_name })
    })
    const offView = g.on('view', (v) => setView(v))
    const timer = window.setInterval(() => {
      const s = g.getStatus()
      setStatus({ loaded: s.tilesLoaded, pending: s.tilesPending, failed: s.tilesFailed, order: s.order, note: s.note })
    }, 700)
    const ro = new ResizeObserver(() => g.resize())
    ro.observe(el)
    return () => { offPick(); offView(); clearInterval(timer); ro.disconnect(); g.dispose(); globe.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    globe.current?.setMarkers(targets.map((t) => ({ id: t.id, ra: t.ra!, dec: t.dec!, label: t.display_name, color: t.id === currentId ? '#ffd34d' : '#9fe8d0' })))
  }, [targets, currentId])
  useEffect(() => { globe.current?.setChannel(MAP_CHANNELS[ci].channel) }, [ci])

  const go = (p: Pick, fovDeg = 2) => { globe.current?.lookAt({ ra: p.ra, dec: p.dec }, fovDeg); setPicked(p) }
  const find = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    const c = parseCoords(query)
    if (c) return go({ ...c })
    if (!query.trim()) return setErr(L('좌표나 천체 이름을 입력하세요', 'Type coordinates or a name'))
    setBusy(true)
    try {
      const r = await sesame(query)
      if (!r) setErr(L(`'${query}'을(를) 찾지 못했습니다`, `No resolver knows '${query}'`))
      else go({ ra: r.ra, dec: r.dec, name: r.name + (r.moved ? L(' (고유운동 반영, 오늘 위치)', ' (moved by proper motion to today)') : '') })
    } catch (ex) {
      setErr(L('이름 찾기 서비스에 연결하지 못했습니다: ', 'Name service unavailable: ') + (ex as Error).message)
    } finally { setBusy(false) }
  }
  const zoom = (k: number) => {
    const v = globe.current?.getView()
    if (v) globe.current!.lookAt({ ra: v.ra, dec: v.dec }, Math.min(FOV_MAX, Math.max(FOV_MIN, v.fovDeg * k)))
  }
  const ch = MAP_CHANNELS[ci]
  const det = detectorOf(ch.um)
  const near = picked ? targets.map((t) => ({ t, d: sep(picked, { ra: t.ra!, dec: t.dec! }) })).sort((a, b) => a.d - b.d)[0] : null

  return (
    <section className="sky-panel" data-testid="sky-panel">
      <div className="sky-globe">
        <div className="globe-box" ref={box} data-testid="sky-globe" aria-label={L('SPHEREx 전천 천구: 끌어서 돌리고, 휠로 확대하고, 눌러서 좌표를 고릅니다', 'SPHEREx all-sky globe: drag to turn, scroll to zoom, click to pick a position')} />
        <div className="globe-zoom" role="group" aria-label={L('확대', 'Zoom')}>
          <button onClick={() => zoom(0.6)} aria-label={L('확대', 'Zoom in')}>+</button>
          <button onClick={() => zoom(1 / 0.6)} aria-label={L('축소', 'Zoom out')}>−</button>
        </div>
        <div className="globe-read" data-testid="sky-view">
          {fmtHms(view.ra)} {fmtDms(view.dec)} · {L('시야', 'field')} {view.fovDeg.toFixed(view.fovDeg < 10 ? 1 : 0)}°
        </div>
      </div>

      <aside className="sky-side">
        <form className="sky-find" onSubmit={find} data-testid="sky-find">
          <label htmlFor="sky-q">{L('좌표나 이름으로 찾기', 'Find by coordinates or name')}</label>
          <div className="row">
            <input id="sky-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L('예: 269.45 +4.69 · M42 · Betelgeuse', 'e.g. 269.45 +4.69 · M42 · Betelgeuse')} />
            <button type="submit" className="primary" disabled={busy}>{busy ? L('찾는 중…', 'Finding…') : L('이동', 'Go')}</button>
          </div>
          {err && <p className="warn small" data-testid="sky-err">{err}</p>}
          <p className="dim small">{L('이름은 CDS Sesame(실시간)로 찾습니다.', 'Names are resolved live with CDS Sesame.')} <Badge kind="catalog" /></p>
        </form>

        <div className="sky-wave">
          <label htmlFor="sky-ch">{L('파장', 'Wavelength')} <b style={{ color: DETECTORS[det].color }}>{ch.um.toFixed(2)} µm</b> <span className="dim small">D{det} · {L('채널', 'channel')} {ch.channel}</span></label>
          <input id="sky-ch" type="range" min={0} max={MAP_CHANNELS.length - 1} value={ci} onChange={(e) => setCi(+e.target.value)} data-testid="sky-channel" />
          <div className="sky-ruler" aria-hidden><span>0.75</span><span>5.0 µm</span></div>
        </div>

        {picked ? (
          <div className="sky-pick" data-testid="sky-pick">
            <h3>{picked.name ?? L('고른 위치', 'Picked position')}</h3>
            <p className="coord">{fmtHms(picked.ra)} {fmtDms(picked.dec)}<br /><span className="dim small">{picked.ra.toFixed(5)}°, {picked.dec >= 0 ? '+' : ''}{picked.dec.toFixed(5)}°</span></p>
            {near && near.d < 0.3 ? (
              <button className="primary" onClick={() => onOpenTarget(near.t.id)} data-testid="sky-open-target">
                {L(`${near.t.display_name} 분석 열기`, `Open ${near.t.display_name} analysis`)}
              </button>
            ) : (
              <>
                <div className="row">
                  <select value={fov} onChange={(e) => setFov(+e.target.value)} aria-label={L('시야', 'Field of view')}>
                    {[0.1, 0.2, 0.3].map((f) => <option key={f} value={f}>{f}°</option>)}
                  </select>
                  <button className="primary" onClick={() => onPatch({ ra: picked.ra, dec: picked.dec }, fov, picked.name)} data-testid="sky-analyse">{L('이 위치 SPHEREx 영상 받기', 'Fetch SPHEREx images here')}</button>
                </div>
                <p className="dim small">{L('좌표 검색 서버(scripts/server.py)가 IRSA에서 이 영역의 관측을 받아 같은 격자로 맞춥니다.', 'The search server (scripts/server.py) downloads the visits covering this spot from IRSA and puts them on our grid.')}{near && <> {L(`가장 가까운 대상: ${near.t.display_name} (${near.d.toFixed(1)}°)`, `Nearest target: ${near.t.display_name} (${near.d.toFixed(1)}°)`)}</>}</p>
              </>
            )}
          </div>
        ) : (
          <p className="dim small">{L('천구를 누르면 그 좌표를 고릅니다. 표시된 대상을 누르면 바로 분석을 열 수 있습니다.', 'Click the sky to pick a position. Click a labelled target to open its analysis.')}</p>
        )}

        <div className="sky-targets">
          <h3>{L('챌린지 대상으로 날아가기', 'Fly to a challenge target')}</h3>
          {targets.map((t) => (
            <button key={t.id} className={t.id === currentId ? 'on' : ''} onClick={() => go({ ra: t.ra!, dec: t.dec!, name: t.display_name }, 1.5)} data-testid={`sky-go-${t.id}`}>{t.display_name}</button>
          ))}
        </div>

        <p className="dim small sky-status" data-testid="sky-status">
          <Badge kind="spherex" /> {L('IRSA에서 실시간', 'Live from IRSA')}: {L('타일', 'tiles')} {status.loaded} {L('받음', 'loaded')}
          {status.pending > 0 && <> · {status.pending} {L('받는 중', 'loading')}</>}
          {status.failed > 0 && <span className="warn"> · {status.failed} {L('실패', 'failed')}</span>} · HiPS order {status.order}
          {status.note && <><br />{status.note}</>}
        </p>
        <p className="dim small">{L('전천 영상은 SPHEREx DR1 전천 큐브(102색, 1년 평균)입니다. 변화를 보여 주지 않으니, 고른 뒤 Blink로 날짜별 영상을 확인하세요.', 'The map is the SPHEREx DR1 all-sky cube (102 colours, a yearly average). It cannot show change: pick a spot, then blink its dated images.')}</p>
      </aside>
    </section>
  )
}
