/** Korean / English for the home page.
 * Static text: every element marked by i18n-dict.js is swapped between its Korean original
 * (read from the page) and the English in the dictionary. Dynamic text: T(ko, en).
 * The choice is kept per viewer in localStorage (falls back silently when storage is blocked). */
import { EN } from './i18n-dict.js';

const listeners = new Set();
let current = 'en'; // English by default; Korean only when the visitor chose it
try { current = localStorage.getItem('spherex-lang') === 'ko' ? 'ko' : 'en'; } catch { /* storage blocked */ }
export const lang = () => current;
export const T = (ko, en) => (current === 'en' ? en : ko);
export function onLang(fn) { listeners.add(fn); return () => listeners.delete(fn); }

const norm = s => s.replace(/\s+/g, ' ').trim();
const INLINE = new Set(['B', 'STRONG', 'EM', 'I', 'SPAN', 'BR', 'SMALL', 'SUP', 'SUB']);
const HANGUL = /[가-힣]/;
let nodes = null; // [{ el, ko, en, attr? }]

function collect(root) {
  const out = [];
  const walk = el => {
    if (el.matches('script, style, canvas, svg, [data-no-i18n]')) return;
    const kids = [...el.children];
    const leaf = kids.every(k => INLINE.has(k.tagName) && ![...k.children].some(g => !INLINE.has(g.tagName)));
    const text = norm(el.innerHTML);
    if (leaf && HANGUL.test(el.textContent) && EN[text] != null) { out.push({ el, ko: el.innerHTML, en: EN[text] }); return; }
    kids.forEach(walk);
  };
  walk(root);
  for (const el of root.querySelectorAll('[aria-label], [placeholder], [title]')) {
    for (const attr of ['aria-label', 'placeholder', 'title']) {
      const v = el.getAttribute(attr); if (v && EN[norm(v)] != null) out.push({ el, attr, ko: v, en: EN[norm(v)] });
    }
  }
  return out;
}

export function setLang(next) {
  current = next === 'en' ? 'en' : 'ko';
  try { localStorage.setItem('spherex-lang', current); } catch { /* ignore */ }
  document.documentElement.lang = current;
  nodes ??= collect(document.body);
  for (const n of nodes) {
    const v = current === 'en' ? n.en : n.ko;
    if (n.attr) n.el.setAttribute(n.attr, v); else n.el.innerHTML = v;
  }
  listeners.forEach(fn => fn(current));
}
/** for building the dictionary: every Korean string the collector would look up */
export function untranslated(root = document.body) {
  const seen = new Set(), walk = el => {
    if (el.matches('script, style, canvas, svg, [data-no-i18n]')) return;
    const kids = [...el.children];
    const leaf = kids.every(k => INLINE.has(k.tagName) && ![...k.children].some(g => !INLINE.has(g.tagName)));
    if (leaf && HANGUL.test(el.textContent)) { const t = norm(el.innerHTML); if (EN[t] == null) seen.add(t); return; }
    kids.forEach(walk);
  };
  walk(root);
  for (const el of root.querySelectorAll('[aria-label], [placeholder], [title]')) for (const a of ['aria-label', 'placeholder', 'title']) { const v = el.getAttribute(a); if (v && HANGUL.test(v) && EN[norm(v)] == null) seen.add(norm(v)); }
  return [...seen];
}
