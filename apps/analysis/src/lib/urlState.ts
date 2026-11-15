// Share link: the view lives in the URL (idea from TrueBlink), so a copied link reopens it.
import type { AnalysisTab, Lang, StageView, UiMode } from '../store'
import { notifyAnalysisURL } from './integration'

const TABS: AnalysisTab[] = ['motion', 'variable', 'spectrum', 'provenance']

export function readView(): { ui: UiMode; tab: AnalysisTab | null; visit: number | null; lang: Lang; stage: StageView } {
  const q = new URLSearchParams(window.location.search)
  const tab = q.get('tab') as AnalysisTab | null
  const v = Number(q.get('visit'))
  return {
    ui: q.get('mode') === 'research' ? 'research' : 'explore',
    tab: tab && TABS.includes(tab) ? tab : null,
    visit: Number.isInteger(v) && v > 0 ? v - 1 : null,
    lang: q.get('lang') === 'en' ? 'en' : 'ko',
    stage: q.get('view') === 'sky' ? 'sky' : 'workbench',
  }
}

export function writeView(p: { ui?: UiMode; tab?: AnalysisTab | null; visit?: number | null; lang?: Lang; stage?: StageView }) {
  const u = new URL(window.location.href)
  if (p.ui !== undefined) { if (p.ui === 'research') u.searchParams.set('mode', 'research'); else u.searchParams.delete('mode') }
  if (p.tab !== undefined) { if (p.tab) u.searchParams.set('tab', p.tab); else u.searchParams.delete('tab') }
  if (p.visit !== undefined) { if (p.visit !== null) u.searchParams.set('visit', String(p.visit + 1)); else u.searchParams.delete('visit') }
  if (p.lang !== undefined) { if (p.lang === 'en') u.searchParams.set('lang', 'en'); else u.searchParams.delete('lang') }
  if (p.stage !== undefined) { if (p.stage === 'sky') u.searchParams.set('view', 'sky'); else u.searchParams.delete('view') }
  window.history.replaceState(null, '', u)
  notifyAnalysisURL(u.href)
}
