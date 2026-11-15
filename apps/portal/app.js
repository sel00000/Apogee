import {mountHomeBackground} from './home-background.js';
import {mountGlassCards} from './glass.js';
import {mountHomeWaveform} from './home-waveform.js';
import {mountHomeStory} from './home-story.js';
import {VIEWS, HOME_ANCHORS, parseRoute, routeHash, analysisParams, childURL, trustedFrameMessage} from './routing.js';
const $=s=>document.querySelector(s),reduce=matchMedia('(prefers-reduced-motion:reduce)');
const homeWave=mountHomeWaveform(document.querySelector('#home-wave'));
const disposeGlass=mountGlassCards(document.querySelectorAll('.tool-card'),{reducedMotionMedia:reduce,refraction:false});
let route='', currentView='home', generation=0, feature=null, home=null, paused=reduce.matches, toastTimer;
let tutorialActive=false, readyPromise=Promise.resolve(), searchController=null, searchLoading=null;
try{home=mountHomeBackground($('#home-lens'),undefined,{onStage:info=>homeWave.update(info)});}catch(e){console.warn('Static home background',e);}
function toast(message){clearTimeout(toastTimer);$('#app-toast').textContent=message;$('#app-toast').classList.add('show');toastTimer=setTimeout(()=>$('#app-toast').classList.remove('show'),3500);}
function updateMotion(){
 const blocked=tutorialActive||document.hidden||!!document.querySelector('dialog[open]');
 home?.setActive(currentView==='home'&&!paused&&!blocked);
 window.__spherexModel?.setActive?.(currentView==='home'&&!blocked);
 feature?.setActive?.(!blocked);
 $('#motion-toggle').setAttribute('aria-pressed',String(paused));$('#motion-toggle').setAttribute('aria-label',paused?'배경 움직임 켜기':'배경 움직임 멈추기');$('#motion-toggle').innerHTML=paused?'▷ <span>움직임 켜기</span>':'Ⅱ <span>움직임 멈추기</span>';
}
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
  onUserOrbit:()=>btn('spin').setAttribute('aria-pressed','false')});
 stage.addEventListener('model-progress',()=>btn('cutaway').setAttribute('aria-pressed',String(model.cutaway)));
 host.addEventListener('model-error',e=>{status.textContent=e.detail;stage.classList.remove('is-ready');});
 const setFree=on=>{stage.classList.toggle('is-free',on);document.body.classList.toggle('model-free',on);btn('free').setAttribute('aria-pressed',String(on));model.setFree(on);if(on)host.querySelector('canvas')?.focus({preventScroll:true});};
 dock.addEventListener('click',e=>{const b=e.target.closest('[data-model]');if(!b)return;const k=b.dataset.model;
  if(k==='cutaway'){const on=!model.cutaway;model.setCutaway(on);b.setAttribute('aria-pressed',String(on));}
  else if(k==='back')model.view('back');
  else if(k==='spin'){const on=!model.autoRotate;model.setAutoRotate(on);b.setAttribute('aria-pressed',String(on));}
  else if(k==='reset'){model.reset();btn('cutaway').setAttribute('aria-pressed','false');btn('spin').setAttribute('aria-pressed','false');}
  else if(k==='free')setFree(!stage.classList.contains('is-free'));});
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&stage.classList.contains('is-free'))setFree(false);});
 window.__spherexModel=model;updateMotion();return model;
}
let disposeStory=()=>{};
try{disposeStory=mountHomeStory(document.querySelector('#home-view'),{reducedMotion:reduce,loadModel});}catch(e){console.warn('[home] story',e);}
let dialogFocus=null;
function openDialog(dialog){dialogFocus=document.activeElement;if(!dialog.open)dialog.showModal();updateMotion();}
$('#credits-open').onclick=()=>openDialog($('#credits-dialog'));
for(const dialog of document.querySelectorAll('dialog')){
 dialog.querySelector('.dialog-x')?.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{if(dialog.id==='search-dialog')searchController?.close?.();updateMotion();dialogFocus?.focus?.({preventScroll:true});});
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
}
$('.menu-toggle').onclick=()=>{const on=$('.site-header nav').classList.toggle('open');$('.menu-toggle').setAttribute('aria-expanded',String(on));$('.menu-toggle').setAttribute('aria-label',on?'메뉴 닫기':'메뉴 열기');};
$('#back-top').onclick=()=>window.scrollTo({top:0,behavior:reduce.matches?'instant':'smooth'});

export function analyze(target){
 try{return go('analysis',analysisParams(target));}
 catch(error){toast(error.message);return Promise.resolve(false);}
}
export function go(view,params={}){
 const hash=routeHash(view,params);
 if(location.hash===hash)return navigate();
 history.pushState(null,'',hash);
 return navigate();
}
function selectedSearch(target,action){
 $('#search-dialog').close();
 if(action==='asteroids'||target.kind==='asteroid')return go('asteroids',{target:target.id||target.name,tab:'research'});
 if(action==='planetarium'){
  const q={name:target.name};
  if(Number.isFinite(target.raDeg)&&Number.isFinite(target.decDeg))Object.assign(q,{ra:target.raDeg,dec:target.decDeg,frame:target.frame||'ICRS',coordinateEpoch:target.coordinateEpoch||'J2000'});
  return go('planetarium',q);
 }
 return analyze(target);
}
async function openSearch(){
 openDialog($('#search-dialog'));
 if(searchController){searchController.focus();return;}
 const host=$('#global-search');
 host.textContent='천체 검색을 준비하고 있습니다…';
 try{
  searchLoading ||= import(new URL('search/search.js',document.baseURI).href);
  const {mountSearch}=await searchLoading;
  if(!searchController){
   host.replaceChildren();
   searchController=mountSearch(host,{onSelect:selectedSearch,indexUrl:new URL('search/sky-index.json',document.baseURI).href});
  }
  await searchController.ready;
  if($('#search-dialog').open)searchController.focus();
 }catch(error){
  searchLoading=null;host.replaceChildren();
  const note=document.createElement('p');note.textContent='검색 자료를 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.';
  const retry=document.createElement('button');retry.type='button';retry.className='pill';retry.textContent='다시 시도';retry.onclick=openSearch;host.append(note,retry);
  console.error('[search]',error);
 }
}
$('#search-open').onclick=openSearch;
document.addEventListener('keydown',event=>{
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openSearch();}
});

function syncAsteroidNavigation(params){
 const tabs=$('#asteroid-navigation');
 tabs.hidden=currentView!=='asteroids';
 if(tabs.hidden)return;
 for(const a of tabs.querySelectorAll('[data-asteroid-tab]')){
  const values=new URLSearchParams(params);values.set('tab',a.dataset.asteroidTab);a.href=routeHash('asteroids',values);
  if((params.get('tab')||'orbit')===a.dataset.asteroidTab)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
 }
}
function mountFrame(view,params,container){
 const frame=document.createElement('iframe');
 frame.className='application-frame '+(view==='analysis'?'analysis-frame':'asteroid-frame');
 frame.dataset.feature=view;
 frame.title=view==='analysis'?'SPHEREx 실제 관측 분석':'소행성 궤도와 SPHEREx 분석';
 frame.allowFullscreen=true;
 let disposed=false,active=true,resolveReady;
 const ready=new Promise(resolve=>{resolveReady=resolve;});
 const sendPaused=()=>frame.contentWindow?.postMessage({type:view==='analysis'?'spherex-analysis-pause':'spherex-asteroid-pause',paused:!active},location.origin);
 frame.addEventListener('load',()=>{if(disposed)return;sendPaused();resolveReady();},{once:true});
 frame.src=childURL(view,params,document.baseURI).href;
 container.replaceChildren(frame);
 return {frame,ready,setActive(value){active=!!value;sendPaused();},getDocument(){try{return frame.contentDocument;}catch{return null;}},
  dispose(){if(disposed)return;disposed=true;active=false;sendPaused();resolveReady();frame.src='about:blank';frame.remove();}};
}
function adaptController(value){
 if(typeof value==='function')return {dispose:value,setActive:value.setActive,getDocument:value.getDocument,getWindow:value.getWindow,ready:value.ready,frame:value.frame};
 return value;
}
let navigationPromise=Promise.resolve();
function navigate(){
 // Requests serialize only the save-and-exit boundary. New async mounts are invalidated by generation.
 const next=parseRoute(location.hash);const key=routeHash(next.view,next.params);
 if(route===key&&!next.anchor)return readyPromise;
 const id=++generation;
 readyPromise=new Promise(resolve=>{
  navigationPromise=navigationPromise.then(async()=>{
   if(id!==generation){resolve(false);return;}
   if(feature?.beforeLeave){
    const allowed=await feature.beforeLeave();
    if(id!==generation){resolve(false);return;}
    if(!allowed){history.replaceState(null,'',route||'#home');resolve(false);return;}
   }
   feature?.dispose?.();feature=null;
   route=key;currentView=next.view;
   if(currentView!=='home'&&document.body.classList.contains('model-free')){
    document.body.classList.remove('model-free');$('#model-stage').classList.remove('is-free');
    document.querySelector('[data-model="free"]')?.setAttribute('aria-pressed','false');window.__spherexModel?.setFree(false);
   }
   const body=$('#workspace-body');body.replaceChildren();
   for(const d of document.querySelectorAll('dialog[open]:not([data-sky-tutorial-dialog])'))d.close();
   document.body.classList.toggle('workspace-mode',currentView!=='home');
   $('#home-view').hidden=currentView!=='home';$('#workspace-view').hidden=currentView==='home';
   $('.site-header nav').classList.remove('open');$('.menu-toggle').setAttribute('aria-expanded','false');$('.menu-toggle').setAttribute('aria-label','메뉴 열기');
   for(const a of document.querySelectorAll('[data-view]')){if(a.dataset.view===currentView)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
   syncAsteroidNavigation(next.params);
   $('#workspace-kicker').textContent=VIEWS[currentView][0];$('#workspace-title').textContent=VIEWS[currentView][1];
   document.title=VIEWS[currentView][1]+' · 모두를 위한 SPHEREx';
   updateMotion();
   if(currentView==='home'){
    window.scrollTo({top:0,behavior:'instant'});
    if(next.anchor)requestAnimationFrame(()=>document.getElementById(next.anchor)?.scrollIntoView({behavior:reduce.matches?'instant':'smooth'}));
    window.dispatchEvent(new CustomEvent('spherex-route-ready',{detail:{view:currentView}}));resolve(true);return;
   }
   window.scrollTo({top:0,behavior:'instant'});
   body.innerHTML='<div class="loading-state" role="status"><strong>같은 하늘, 새로운 탐색</strong>화면을 준비하고 있습니다…</div>';
   // Do not serialize module fetches: a later route must be able to supersede this one.
   void (async()=>{
    try{
     let mounted;
     if(currentView==='analysis'||(currentView==='asteroids'&&next.params.get('tab')!=='observations'))mounted=mountFrame(currentView,next.params,body);
     else if(currentView==='planetarium'){
      const mod=await import('./adapters/planetarium.js');if(id!==generation){resolve(false);return;}
      body.replaceChildren();mounted=adaptController(await mod.mountPlanetarium(body,{onAnalyze:analyze,onNavigate:go,toast,params:next.params,onShare:sharePlanetarium}));
     }else if(currentView==='asteroids'){
      const mod=await import('./moving/index.js');if(id!==generation){resolve(false);return;}
      body.replaceChildren();mounted=adaptController(await mod.mountMoving(body,{onAnalyze:analyze,toast}));
     }else if(currentView==='experience'){
      const mod=await import('./experience.js');if(id!==generation){resolve(false);return;}
      body.replaceChildren();mounted=await mod.mountExperience(body,{toast});
     }
     if(id!==generation){mounted?.dispose?.();resolve(false);return;}
     feature=mounted;updateMotion();await mounted?.ready;
     if(id!==generation){resolve(false);return;}
     window.dispatchEvent(new CustomEvent('spherex-route-ready',{detail:{view:next.view}}));resolve(true);
    }catch(error){
     if(id!==generation){resolve(false);return;}
     feature?.dispose?.();feature=null;
     body.innerHTML='<div class="failure-state"><h2>화면을 불러오지 못했습니다</h2><p></p><button type="button">다시 시도</button></div>';
     body.querySelector('p').textContent=error.message;
     body.querySelector('button').onclick=()=>{route='';navigate();};
     console.error(error);resolve(false);
    }
   })();
  }).catch(error=>{console.error(error);resolve(false);});
 });
 return readyPromise;
}
function syncChildRoute(view,query){
 const params=new URLSearchParams(query);params.delete('embed');
 const hash=routeHash(view,params);history.replaceState(null,'',hash);route=hash;
 if(view==='asteroids')syncAsteroidNavigation(params);
}
async function sharePlanetarium(query){
 if(typeof query!=='string'||query.length>8192)return;
 syncChildRoute('planetarium',query);
 try{await navigator.clipboard.writeText(location.href);toast('천구 위치와 관측 설정을 담은 링크를 복사했습니다.');}
 catch{toast('주소 표시줄의 링크에 현재 천구 설정이 저장되었습니다.');}
}
window.addEventListener('message',event=>{
 const frame=feature?.frame;
 if(!trustedFrameMessage(event,frame,location.origin))return;
 const data=event.data;
 if(data.type==='spherex-navigate'&&Object.hasOwn(VIEWS,data.view))go(data.view,data.params||{});
 else if(currentView==='analysis'&&data.type==='spherex-analysis-url'&&typeof data.query==='string'&&data.query.length<=8192)syncChildRoute('analysis',data.query);
 else if(currentView==='asteroids'&&data.type==='spherex-asteroid-state'){
  const q=new URLSearchParams();if(typeof data.target==='string'&&data.target.length<=160)q.set('target',data.target);
  if(['research','orbit'].includes(data.tab))q.set('tab',data.tab);
  syncChildRoute('asteroids',q);
 }
});
$('.skip-link').onclick=event=>{event.preventDefault();$('#main').focus({preventScroll:true});$('#main').scrollIntoView({behavior:reduce.matches?'instant':'smooth'});};
window.addEventListener('hashchange',navigate);
window.addEventListener('popstate',()=>{if(route!==routeHash(parseRoute(location.hash).view,parseRoute(location.hash).params))navigate();});
document.addEventListener('visibilitychange',updateMotion);
window.addEventListener('pagehide',event=>{
 ++generation;
 home?.setActive(false);window.__spherexModel?.setActive?.(false);feature?.dispose?.();feature=null;
 if(!event.persisted){searchController?.destroy();disposeGlass();disposeStory();homeWave.dispose();home?.dispose?.();window.__spherexModel?.dispose();}
});
window.addEventListener('pageshow',event=>{if(event.persisted){route='';navigate();}});
window.__spherexApp={
 get view(){return currentView;},get route(){return route;},
 get background(){return home?.stats;},get backgroundRenderer(){return home?.renderer;},
 navigate:go,analyze,whenReady:()=>readyPromise,
 setTutorialActive(on){tutorialActive=!!on;document.body.classList.toggle('tutorial-active',tutorialActive);updateMotion();},
 getFeatureDocument(){return feature?.getDocument?.()||(currentView==='home'?document:null);},
 getFeatureWindow(){return feature?.getWindow?.()||feature?.frame?.contentWindow||window;},
 getTutorialTarget(key){
  const own={navigation:$('.site-header'),search:$('#search-open'),workspace:$('#workspace-body')};
  return own[key]||feature?.getDocument?.()?.querySelector('[data-tutorial="'+CSS.escape(key)+'"]')||null;
 },
 openSearch,
};
navigate();
