/** Sojourner remains on its own stable origin; the portal owns navigation only. */
export async function mountExperience(container,{toast=()=>{}}={}) {
 const configURL=new URL('config.json',document.baseURI);
 let config;
 try { const response=await fetch(configURL,{cache:'no-store'});if(!response.ok)throw new Error('unavailable');config=await response.json(); }
 catch { config={}; }
 if(!config.experienceUrl){
  const panel=document.createElement('div');panel.className='failure-state';
  const title=document.createElement('h2');title.textContent='우주 탐험은 새 탭에서 계속하세요';
  const note=document.createElement('p');note.textContent='이곳의 탐험 서비스가 연결되지 않았습니다. 원작 Sojourner에서 우주를 여행할 수 있습니다. 다른 관측·분석 화면은 계속 사용할 수 있어요.';
  // Original site recorded in apps/experience/integration-manifest.json.
  const link=document.createElement('a');link.className='pill';link.href='https://sojourner.artificialisabel.com/';link.target='_blank';link.rel='noopener noreferrer';link.textContent='원작 Sojourner에서 우주 탐험 시작 ↗';
  const credit=document.createElement('p');credit.textContent='원작: artificial.isabel. 비행 기록은 원작 사이트에 별도로 저장되며 이 웹사이트의 분석 결과와 연결되지 않습니다.';
  const retry=document.createElement('button');retry.type='button';retry.textContent='다시 연결';retry.onclick=()=>window.__spherexApp?.navigate('experience',{retry:Date.now()});
  panel.append(title,note,link,credit);if(config.localServices!==false)panel.append(retry);container.replaceChildren(panel);
  return {ready:Promise.resolve(),dispose(){panel.remove();}};
 }
 const url=new URL(config.experienceUrl,document.baseURI);
 if(!['http:','https:'].includes(url.protocol))throw new Error('탐험 서비스 주소가 올바르지 않습니다.');
 url.searchParams.set('embed','1');url.searchParams.set('parentOrigin',location.origin);
 const origin=url.origin, frame=document.createElement('iframe');
 frame.className='application-frame experience-frame';frame.title='우주 탐험 · 비행과 발견 체험';
 frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
 frame.allow='fullscreen; autoplay';
 let disposed=false,active=true,resolveReady,state={ready:false,exporting:false,canExit:true},sequence=0;
 const pending=new Map();
 const ready=new Promise(resolve=>{resolveReady=resolve;});
 const send=(type,extra={})=>frame.contentWindow?.postMessage({type,...extra},origin);
 const listener=event=>{
  if(disposed||event.origin!==origin||event.source!==frame.contentWindow||!event.data||typeof event.data!=='object')return;
  const data=event.data;
  if(data.type==='spherex-experience-state'){
   const wasReady=state.ready;state={...state,...data};if(state.ready){resolveReady();if(!wasReady)send('spherex-experience-set-active',{active});}
  }else if(['spherex-experience-exit-ready','spherex-experience-exit-blocked'].includes(data.type)){
   const waiting=pending.get(data.requestId);if(!waiting)return;
   clearTimeout(waiting.timer);pending.delete(data.requestId);
   const allowed=data.type==='spherex-experience-exit-ready';
   if(!allowed)toast(data.reason==='export_in_progress'?'여행 영상을 만드는 중입니다. 완료한 뒤 화면을 이동해 주세요.':'탐험 기록을 저장하지 못했습니다. 잠시 뒤 다시 이동해 주세요.');
   waiting.resolve(allowed);
  }
 };
 window.addEventListener('message',listener);
 frame.addEventListener('load',()=>{send('spherex-experience-set-active',{active});resolveReady();},{once:true});
 frame.src=url.href;container.replaceChildren(frame);
 return {frame,ready,
  setActive(value){active=!!value;send('spherex-experience-set-active',{active});},
  beforeLeave(){
   if(disposed||!state.ready)return Promise.resolve(true);
   if(state.exporting){toast('여행 영상을 만드는 중입니다. 완료한 뒤 화면을 이동해 주세요.');return Promise.resolve(false);}
   const requestId='exit-'+(++sequence);
   return new Promise(resolve=>{
    const timer=setTimeout(()=>{pending.delete(requestId);toast('탐험 기록 저장 응답이 지연됩니다. 잠시 뒤 다시 이동해 주세요.');resolve(false);},6000);
    pending.set(requestId,{resolve,timer});send('spherex-experience-exit',{requestId});
   });
  },
  getDocument(){return null;},
  dispose(){if(disposed)return;disposed=true;send('spherex-experience-set-active',{active:false});window.removeEventListener('message',listener);for(const value of pending.values()){clearTimeout(value.timer);value.resolve(true);}pending.clear();resolveReady();frame.src='about:blank';frame.remove();},
 };
}
