import './style.css';
import './research.css';
import {mountResearch} from './research';
import {sceneDataUrl} from './research-model';
import {loadApiConfig} from './api-config';
import type {mountOrbit} from './orbit';

const app=document.querySelector<HTMLDivElement>('#app')!;
const params=new URLSearchParams(location.search);
let selected=params.get('target') || '';
let tab=params.get('tab')==='orbit'||params.get('tab')==='observations'?'orbit':'research';
let dataBase=new URL('./data/',location.href).href;
let pendingScene=params.get('data');
let orbit: Awaited<ReturnType<typeof mountOrbit>>|null=null;
let loading: Promise<void>|null=null, loadGeneration=0, paused=false, disposed=false;
let orbitLoad: AbortController|null=null;
const lifecycle=new AbortController();
app.innerHTML=`<header class="workspace-header"><a class="brand" href="../#asteroids"><span class="brand-mark">◈</span>소행성 분석 <small>SPHEREx SKY LAB</small></a><span class="workspace-note">관측 · 스펙트럼 · 궤도</span></header>
  <nav class="workspace-tabs" aria-label="소행성 작업 공간"><button data-workspace="research" aria-controls="research-workspace">분석 결과 · 새 분석</button><button data-workspace="orbit" data-tutorial="asteroid-3d" aria-controls="orbit-workspace">궤도 · 관측 3D</button><span id="workspace-target"></span></nav>
  <section id="research-workspace" aria-label="소행성 연구"></section><section id="orbit-workspace" aria-label="소행성 궤도와 관측" hidden></section>`;
const researchHost=app.querySelector<HTMLElement>('#research-workspace')!;
const orbitHost=app.querySelector<HTMLElement>('#orbit-workspace')!;
if(params.get('embed')==='1')app.classList.add('embedded');
function announce() {
  const url=new URL(location.href);selected?url.searchParams.set('target',selected):url.searchParams.delete('target');url.searchParams.set('tab',tab);
  history.replaceState(null,'',url);
  app.querySelector('#workspace-target')!.textContent=selected?'대상 '+selected:'';
  if(window.parent!==window)window.parent.postMessage({type:'spherex-asteroid-state',target:selected,tab},location.origin);
}
function setTarget(target: string, from: 'research'|'orbit'|'parent') {
  if(target===selected){announce();return;}
  selected=target;
  if(from!=='research')research.selectTarget(target,false);
  if(from!=='orbit'&&orbit&&!orbit.choose(target)&&tab==='orbit')void openOrbit();
  announce();
}
const research=mountResearch(researchHost,{
  target:selected,
  onTarget(target){setTarget(target,'research');},
  async onOrbit(target,sceneUrl){
    selected=target;
    let nextBase: string|null;
    try{nextBase=sceneUrl?sceneDataUrl(sceneUrl,location.origin,(await loadApiConfig(lifecycle.signal)).apiBase):new URL('./data/',location.href).href;}
    catch(error){window.alert((error as Error).message);return;}
    if(disposed)return;
    if(!nextBase){window.alert('3D 자료 주소가 올바르지 않습니다.');return;}
    pendingScene=null;
    if(nextBase!==dataBase){
      ++loadGeneration;orbitLoad?.abort();orbit?.dispose();orbit=null;loading=null;dataBase=nextBase;
      const url=new URL(location.href);sceneUrl?url.searchParams.set('data',nextBase):url.searchParams.delete('data');history.replaceState(null,'',url);
    }
    void setTab('orbit');
  },
});
function errorView(message: string) {
  orbitHost.replaceChildren();
  const container=document.createElement('div');container.className='orbit-message';
  const h=document.createElement('h2');h.textContent='이 대상의 3D 자료를 열 수 없습니다.';
  const p=document.createElement('p');p.textContent=message;
  const retry=document.createElement('button');retry.textContent='다시 시도';retry.onclick=()=>{loading=null;void openOrbit();};
  const back=document.createElement('button');back.textContent='분석 결과로 돌아가기';back.onclick=()=>void setTab('research');
  container.append(h,p,retry,back);orbitHost.append(container);
}
async function openOrbit() {
  if(orbit){
    if(selected&&!orbit.choose(selected)){orbit.setActive(false);orbit.dispose();orbit=null;loading=null;errorView(`선택한 대상 ${selected}의 궤도가 현재 3D 자료에 없습니다. 연구 화면에서 해당 분석의 3D 자료를 생성할 수 있습니다.`);return;}
    orbit.setActive(!paused);return;
  }
  if(loading)return loading;
  const generation=++loadGeneration;
  const ownLoad=new AbortController();orbitLoad?.abort();orbitLoad=ownLoad;
  orbitHost.innerHTML='<div class="orbit-message" role="status">궤도·관측 자료와 3D 화면을 준비하는 중…</div>';
  loading=(async()=>{
    try{
      if(pendingScene){
        const config=await loadApiConfig(ownLoad.signal);
        const validated=sceneDataUrl(pendingScene,location.origin,config.apiBase);
        if(!validated)throw Error('3D 자료 주소가 설정된 분석 서버의 작업 경로와 일치하지 않습니다.');
        dataBase=validated;pendingScene=null;
      }
      const module=await import('./orbit');
      if(disposed||generation!==loadGeneration)return;
      const mounted=await module.mountOrbit(orbitHost,{target:selected,dataBase,signal:ownLoad.signal,onTarget(target){setTarget(target,'orbit');}});
      if(disposed||generation!==loadGeneration){mounted.dispose();return;}
      orbit=mounted;orbit.setActive(tab==='orbit'&&!paused);
    }catch(error){if(!disposed&&generation===loadGeneration)errorView((error as Error).message);}
    finally{if(generation===loadGeneration)loading=null;}
  })();
  return loading;
}
async function setTab(next: string) {
  tab=next==='orbit'?'orbit':'research';
  researchHost.hidden=tab!=='research';orbitHost.hidden=tab!=='orbit';
  app.querySelectorAll<HTMLButtonElement>('[data-workspace]').forEach(button=>{button.classList.toggle('active',button.dataset.workspace===tab);button.setAttribute('aria-pressed',String(button.dataset.workspace===tab));});
  research.setActive(tab==='research'&&!paused);orbit?.setActive(tab==='orbit'&&!paused);announce();
  if(tab==='orbit')await openOrbit();
}
app.querySelectorAll<HTMLButtonElement>('[data-workspace]').forEach(button=>button.onclick=()=>void setTab(button.dataset.workspace!));
window.addEventListener('message',event=>{
  if(event.source!==window.parent||event.origin!==location.origin||!event.data||typeof event.data!=='object')return;
  if(event.data.type==='spherex-asteroid-pause'){
    paused=Boolean(event.data.paused);research.setActive(tab==='research'&&!paused);orbit?.setActive(tab==='orbit'&&!paused);
  }else if(event.data.type==='spherex-asteroid-select'&&typeof event.data.target==='string'){
    setTarget(event.data.target.slice(0,80),'parent');if(event.data.tab)void setTab(event.data.tab);
  }
},{signal:lifecycle.signal});
window.addEventListener('pagehide',()=>{disposed=true;++loadGeneration;orbitLoad?.abort();lifecycle.abort();research.dispose();orbit?.dispose();},{once:true});
void setTab(tab);
if(window.parent!==window)window.parent.postMessage({type:'spherex-asteroid-ready'},location.origin);
