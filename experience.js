import {t} from './i18n.js';
/** Sojourner remains on its own stable origin; the portal owns navigation only. */
export async function mountExperience(container,{toast=()=>{},toastKeyed}={}) {
 const say=key=>toastKeyed?toastKeyed(key):toast(t(key));
 const mark=(el,name,value)=>{try{el.dataset[name]=value;}catch{}};
 const keyed=(el,key)=>{mark(el,'i18n',key);el.textContent=t(key);return el;};
 const configURL=new URL('config.json',document.baseURI);
 let config;
 try { const response=await fetch(configURL,{cache:'no-store'});if(!response.ok)throw new Error('unavailable');config=await response.json(); }
 catch { config={}; }
 if(!config.experienceUrl){
  const panel=document.createElement('div');panel.className='failure-state';
  const title=document.createElement('h2');keyed(title,'exp.title');
  const note=document.createElement('p');keyed(note,'exp.note');
  // Original site recorded in apps/experience/integration-manifest.json.
  const link=document.createElement('a');link.className='pill';link.href='https://sojourner.artificialisabel.com/';link.target='_blank';link.rel='noopener noreferrer';keyed(link,'exp.link');
  const credit=document.createElement('p');keyed(credit,'exp.credit');
  const retry=document.createElement('button');retry.type='button';keyed(retry,'exp.retry');retry.onclick=()=>window.__spherexApp?.navigate('experience',{retry:Date.now()});
  panel.append(title,note,link,credit);if(config.localServices!==false)panel.append(retry);container.replaceChildren(panel);
  return {ready:Promise.resolve(),dispose(){panel.remove();}};
 }
 const url=new URL(config.experienceUrl,document.baseURI);
 if(!['http:','https:'].includes(url.protocol)){const e=new Error(t('exp.badUrl'));e.i18nKey='exp.badUrl';throw e;}
 url.searchParams.set('embed','1');url.searchParams.set('parentOrigin',location.origin);
 const origin=url.origin, frame=document.createElement('iframe');
 frame.className='application-frame experience-frame';frame.title=t('exp.frame');mark(frame,'i18nAttr','title:exp.frame');
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
   if(!allowed)say(data.reason==='export_in_progress'?'exp.exporting':'exp.saveFailed');
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
   if(state.exporting){say('exp.exporting');return Promise.resolve(false);}
   const requestId='exit-'+(++sequence);
   return new Promise(resolve=>{
    const timer=setTimeout(()=>{pending.delete(requestId);say('exp.slow');resolve(false);},6000);
    pending.set(requestId,{resolve,timer});send('spherex-experience-exit',{requestId});
   });
  },
  getDocument(){return null;},
  dispose(){if(disposed)return;disposed=true;send('spherex-experience-set-active',{active:false});window.removeEventListener('message',listener);for(const value of pending.values()){clearTimeout(value.timer);value.resolve(true);}pending.clear();resolveReady();frame.src='about:blank';frame.remove();},
 };
}
