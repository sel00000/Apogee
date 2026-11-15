import {mountHomeBackground} from './home-background.js';
import {mountGlassCards} from './glass.js';
import {mountHomeWaveform} from './home-waveform.js';
import {mountHomeStory} from './home-story.js';
import {mountHomeLab} from './home-lab.js';
import {setLang,lang,onLang,T} from './i18n.js';
const $=s=>document.querySelector(s),reduce=matchMedia('(prefers-reduced-motion:reduce)');
const homeWave=mountHomeWaveform(document.querySelector('#home-wave'));
const disposeGlass=mountGlassCards(document.querySelectorAll('.tool-card'),{reducedMotionMedia:reduce,refraction:false});
let route='',generation=0,disposeView=null,home=null,paused=reduce.matches,toastTimer;
const names={planetarium:['EXPLORE THE SKY','나의 플라네타리움'],analysis:['READ THE OBSERVATIONS','방구석 천문학자'],moving:['FOLLOW THE MOVEMENT','소행성·혜성 추적']};
try{home=mountHomeBackground($('#home-lens'),undefined,{onStage:info=>homeWave.update(info)});}catch(e){console.warn('Static home background',e);}
function toast(message){clearTimeout(toastTimer);$('#app-toast').textContent=message;$('#app-toast').classList.add('show');toastTimer=setTimeout(()=>$('#app-toast').classList.remove('show'),3500);}
function updateMotion(){home?.setActive(route==='home'&&!paused&&!document.querySelector('dialog[open]'));$('#motion-toggle').setAttribute('aria-pressed',String(paused));$('#motion-toggle').setAttribute('aria-label',paused?T('배경 움직임 켜기','Resume background motion'):T('배경 움직임 멈추기','Pause background motion'));$('#motion-toggle').innerHTML=paused?T('▷ <span>움직임 켜기</span>','▷ <span>Resume motion</span>'):T('Ⅱ <span>움직임 멈추기</span>','Ⅱ <span>Pause motion</span>');}
$('#motion-toggle').onclick=()=>{paused=!paused;updateMotion();};reduce.addEventListener('change',()=>{paused=reduce.matches;updateMotion();});
// Liquid Glass: glass.js moves the light, the rim highlight and the tilt; CSS springs the slab back.
// 3D model: the bundled Three.js module is fetched only when the mission story is about to start.
async function loadModel(stage){
 const host=stage.querySelector('#model-host'),status=stage.querySelector('#model-status'),dock=stage.querySelector('.model-dock');
 let mod;try{mod=await import('./assets/model/mission-model.js');}catch(e){status.textContent='3D 모형을 불러오지 못했어요. 사진으로 보여 드릴게요.';throw e;}
 const btn=n=>dock.querySelector(`[data-model="${n}"]`);
 const model=mod.mountMissionModel(host,{url:new URL('assets/model/spherex-hero.glb',import.meta.url).href,
  onReady:()=>stage.classList.add('is-ready'),
  onError:e=>{console.warn('[home] model',e);status.textContent='3D 모형을 불러오지 못했어요. 사진으로 보여 드릴게요.';},
  onUserOrbit:()=>{const pz=stage.querySelector('.model-pause');pz.textContent='▶';pz.setAttribute('aria-pressed','false');}});
 model.setAutoRotate(!reduce.matches);if(reduce.matches){const pz=stage.querySelector('.model-pause');pz.textContent='▶';pz.setAttribute('aria-pressed','false');}
 const pause=stage.querySelector('.model-pause');pause.onclick=()=>{const on=!model.autoRotate;model.setAutoRotate(on);pause.setAttribute('aria-pressed',String(on));pause.textContent=on?'Ⅱ':'▶';pause.setAttribute('aria-label',on?T('회전 멈춤','Pause rotation'):T('회전','Rotate'));};
 stage.addEventListener('model-progress',()=>btn('cutaway').setAttribute('aria-pressed',String(model.cutaway)));
 host.addEventListener('model-error',e=>{status.textContent=e.detail;stage.classList.remove('is-ready');});
  dock.addEventListener('click',e=>{const b=e.target.closest('[data-model]');if(!b)return;const k=b.dataset.model;
  if(k==='cutaway'){const on=!model.cutaway;model.setCutaway(on);b.setAttribute('aria-pressed',String(on));}
  else if(k==='back')model.view('back');
  else if(k==='spin'){const on=!model.autoRotate;model.setAutoRotate(on);b.setAttribute('aria-pressed',String(on));b.textContent=on?'Ⅱ':'▶';b.setAttribute('aria-label',on?T('회전 멈춤','Pause rotation'):T('회전','Rotate'));}
  else if(k==='reset'){model.reset();btn('cutaway').setAttribute('aria-pressed','false');btn('spin').setAttribute('aria-pressed','false');}
});
 window.__spherexModel=model;return model;
}
let disposeStory=()=>{};
try{disposeStory=mountHomeStory(document.querySelector('#home-view'),{reducedMotion:reduce,loadModel});}catch(e){console.warn('[home] story',e);}
// language switch (한 / EN), remembered per viewer
for(const b of document.querySelectorAll('[data-lang]'))b.onclick=()=>setLang(b.dataset.lang);
onLang(l=>{for(const b of document.querySelectorAll('[data-lang]'))b.setAttribute('aria-pressed',String(b.dataset.lang===l));updateMotion();});
// pointer light on panels: one layer per panel, moved with transform only
let lightEv=null,lightRaf=0;document.addEventListener('pointermove',e=>{lightEv=e;if(!lightRaf)lightRaf=requestAnimationFrame(()=>{lightRaf=0;const e=lightEv,p=e.target.closest?.('.panel');if(!p)return;const r=p.getBoundingClientRect();p.style.setProperty('--px',(e.clientX-r.left)+'px');p.style.setProperty('--py',(e.clientY-r.top)+'px');});},{passive:true});
let disposeLab=()=>{};try{disposeLab=mountHomeLab(document.querySelector('#home-view'),{reducedMotion:reduce});}catch(e){console.warn('[home] lab',e);}
let dialogFocus=null;function openDialog(dialog){dialogFocus=document.activeElement;dialog.showModal();updateMotion();}
for(const b of document.querySelectorAll('[data-tutorial]'))b.onclick=()=>openDialog($('#tutorial-dialog'));

for(const d of document.querySelectorAll('dialog')){d.querySelector('.dialog-x').onclick=()=>d.close();d.addEventListener('close',()=>{updateMotion();dialogFocus?.focus();});d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});}
$('.menu-toggle').onclick=()=>{const on=$('.site-header nav').classList.toggle('open');$('.menu-toggle').setAttribute('aria-expanded',String(on));$('.menu-toggle').setAttribute('aria-label',on?'메뉴 닫기':'메뉴 열기');};
$('#back-top').onclick=()=>window.scrollTo({top:0,behavior:reduce.matches?'instant':'smooth'});
function parseHash(){const value=location.hash.slice(1)||'home';const [view,query]=value.split('?');return {view,params:new URLSearchParams(query||'')};}
export function analyze(target){const p=new URLSearchParams();if(target.target)p.set('target',target.target);else{p.set('ra',target.ra);p.set('dec',target.dec);if(target.label)p.set('label',target.label);}if(target.tab)p.set('tab',target.tab);if(target.moving){p.set('moving','1');for(const key of ['epoch','observationMjd'])if(Number.isFinite(target[key]))p.set(key,String(target[key]));}location.hash=`analysis?${p}`;}
const homeAnchors=new Set(['mission','light','spectrum','blink','sky']);
async function navigate(){const current=parseHash();if(homeAnchors.has(current.view)){const target=document.getElementById(current.view);if(route!=='home'){route='';history.replaceState(null,'','#home');await navigate();}requestAnimationFrame(()=>target.scrollIntoView({behavior:reduce.matches?'instant':'smooth'}));return;}
 const view=names[current.view]?current.view:'home',key=view+'?'+current.params; if(route===key)return;route=key;const id=++generation;
 if(disposeView){disposeView();disposeView=null;}$('#workspace-body').replaceChildren();for(const d of document.querySelectorAll('dialog[open]'))d.close();
 document.body.classList.toggle('workspace-mode',view!=='home');$('#home-view').hidden=view!=='home';$('#workspace-view').hidden=view==='home';$('.site-header nav').classList.remove('open');$('.menu-toggle').setAttribute('aria-expanded','false');$('.menu-toggle').setAttribute('aria-label','메뉴 열기');
 for(const a of document.querySelectorAll('[data-view]')){if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
 // route key includes query; home lifecycle is explicitly suspended elsewhere.
 home?.setActive(view==='home'&&!paused);if(view==='home'){route='home';window.scrollTo({top:0,behavior:'instant'});return;}
 window.scrollTo({top:0,behavior:'instant'});$('#workspace-kicker').textContent=names[view][0];$('#workspace-title').textContent=names[view][1];
 const body=$('#workspace-body');body.innerHTML='<div class="loading-state"><strong>같은 하늘, 새로운 탐색</strong>관측 도구를 준비하고 있습니다…</div>';
 try{
 if(view==='analysis'){
  const iframe=document.createElement('iframe');iframe.className='analysis-frame';iframe.title='방구석 천문학자 · 실제 SPHEREx 관측 분석';const url=new URL('analysis/',location.href);current.params.forEach((v,k)=>url.searchParams.set(k,v));if(!url.searchParams.has('target')&&!url.searchParams.has('ra'))url.searchParams.set('target','barnard');url.searchParams.set('embed','1');iframe.src=url;body.replaceChildren(iframe);disposeView=()=>{iframe.contentWindow?.postMessage({type:'spherex-analysis-pause'},location.origin);iframe.src='about:blank';iframe.remove();};
 }else{const mod=await import(view==='planetarium'?'./planetarium/index.js':'./moving/index.js');if(id!==generation)return;body.replaceChildren();const fn=view==='planetarium'?mod.mountPlanetarium:mod.mountMoving;const cleanup=await fn(body,{onAnalyze:analyze,toast});if(id!==generation){if(typeof cleanup==='function')cleanup();else cleanup?.dispose?.();return;}disposeView=typeof cleanup==='function'?cleanup:()=>cleanup?.dispose?.();}
 }catch(e){if(id!==generation)return;body.innerHTML='<div class="failure-state"><h2>화면을 불러오지 못했습니다</h2><p></p><button>다시 시도</button></div>';body.querySelector('p').textContent=e.message;body.querySelector('button').onclick=()=>{route='';navigate();};console.error(e);}
}
$('.skip-link').onclick=e=>{e.preventDefault();$('#main').focus({preventScroll:true});$('#main').scrollIntoView({behavior:reduce.matches?'instant':'smooth'});};
// one app, not separate pages: screen changes cross-fade with the View Transitions API when available
window.addEventListener('hashchange',()=>{const inPage=homeAnchors.has(parseHash().view)&&route==='home';if(document.startViewTransition&&!reduce.matches&&!inPage)document.startViewTransition(()=>navigate());else navigate();});window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==document.querySelector('.analysis-frame')?.contentWindow)return;if(e.data?.type==='spherex-navigate'&&names[e.data.view])location.hash=e.data.view;else if(e.data?.type==='spherex-analysis-url'&&typeof e.data.query==='string'&&e.data.query.length<8192){const query=new URLSearchParams(e.data.query);query.delete('embed');const url=new URL(location.href);url.hash='analysis'+(query.size?'?'+query:'');history.replaceState(null,'',url);route='analysis?'+query;}});
window.addEventListener('pagehide',e=>{home?.setActive(false);disposeView?.();if(!e.persisted){disposeGlass();disposeStory();disposeLab();homeWave.dispose();home?.dispose?.();window.__spherexModel?.dispose();}});window.addEventListener('pageshow',e=>{if(e.persisted){route='';navigate();}});
if(lang()==='en')setLang('en');
window.__spherexApp={get view(){return route;},get background(){return home?.stats;},get backgroundRenderer(){return home?.renderer;},navigate:analyze};navigate();
