import test from 'node:test';
import assert from 'node:assert/strict';
import {mountExperience} from '../experience.js';

test('experience isolates its origin, pauses, rejects forged exits and saves before disposal',async()=>{
 const prior=Object.fromEntries(['document','window','location','fetch'].map(key=>[key,globalThis[key]]));
 const messages=[],listeners=new Set(),toasts=[];
 const child={postMessage(message,origin){messages.push({message,origin});}};
 class Element{
  constructor(tag){this.tagName=tag;this.listeners=new Map();if(tag==='iframe')this.contentWindow=child;}
  addEventListener(type,fn){this.listeners.set(type,fn);}
  replaceChildren(...children){this.children=children;}
  append(...children){this.children=children;}
  remove(){this.removed=true;}
 }
 globalThis.document={baseURI:'http://127.0.0.1:4173/S/',createElement:tag=>new Element(tag)};
 globalThis.location={origin:'http://127.0.0.1:4173'};
 globalThis.window={addEventListener(type,fn){if(type==='message')listeners.add(fn);},removeEventListener(type,fn){if(type==='message')listeners.delete(fn);}};
 globalThis.fetch=async url=>{assert.equal(url.href,'http://127.0.0.1:4173/S/config.json');return {ok:true,json:async()=>({experienceUrl:'http://127.0.0.1:4174/'})};};
 const emit=(data,origin='http://127.0.0.1:4174',source=child)=>{for(const fn of listeners)fn({data,origin,source});};
 let controller;
 try{
  controller=await mountExperience(new Element('div'),{toast:value=>toasts.push(value)});
  const url=new URL(controller.frame.src);
  assert.equal(url.searchParams.get('parentOrigin'),location.origin);assert.equal(url.searchParams.get('embed'),'1');
  assert.equal(controller.frame.referrerPolicy,'strict-origin-when-cross-origin');
  controller.frame.listeners.get('load')();await controller.ready;
  emit({type:'spherex-experience-state',ready:true,exporting:true},'https://evil.test');
  assert.equal(await controller.beforeLeave(),true);
  emit({type:'spherex-experience-state',ready:true,exporting:false,canExit:true});
  const count=messages.length;emit({type:'spherex-experience-state',ready:true,exporting:false});assert.equal(messages.length,count,'periodic state must not create a message feedback loop');
  controller.setActive(false);assert.deepEqual(messages.at(-1),{message:{type:'spherex-experience-set-active',active:false},origin:'http://127.0.0.1:4174'});
  emit({type:'spherex-experience-state',ready:true,exporting:true});assert.equal(await controller.beforeLeave(),false);
  emit({type:'spherex-experience-state',ready:true,exporting:false});
  const leaving=controller.beforeLeave(),request=messages.at(-1).message;
  assert.equal(request.type,'spherex-experience-exit');
  emit({type:'spherex-experience-exit-ready',requestId:request.requestId},'http://127.0.0.1:4174',{});
  let complete=false;leaving.then(()=>{complete=true;});await Promise.resolve();assert.equal(complete,false,'another iframe cannot acknowledge an exit');
  emit({type:'spherex-experience-exit-ready',requestId:request.requestId,saved:true});assert.equal(await leaving,true);
  controller.dispose();assert.equal(controller.frame.src,'about:blank');assert.equal(controller.frame.removed,true);assert.equal(listeners.size,0);
  // Default language is English (spec-i18n D1, user instruction 2026-11-15); was includes('영상').
  assert.ok(toasts.some(text=>text.includes('video')));
 }finally{controller?.dispose();for(const [key,value] of Object.entries(prior)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('static publication offers the attributed original experience in a separate tab, without a broken iframe',async()=>{
 const prior=Object.fromEntries(['document','fetch'].map(key=>[key,globalThis[key]]));
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  remove(){this.removed=true;}
 }
 const container=new Element('div');let controller;
 globalThis.document={baseURI:'https://owner.github.io/Apogee/',createElement:tag=>new Element(tag)};
 globalThis.fetch=async url=>{assert.equal(url.href,'https://owner.github.io/Apogee/config.json');return {ok:true,json:async()=>({localServices:false,experienceUrl:''})};};
 try{
  controller=await mountExperience(container);await controller.ready;
  assert.equal(controller.frame,undefined);
  const panel=container.children[0],link=panel.children.find(child=>child.tagName==='a');
  assert.equal(link.href,'https://sojourner.artificialisabel.com/');assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');
  assert.ok(panel.children.some(child=>child.textContent.includes('artificial.isabel')));
  // Default language is English (spec-i18n D1); was includes('별도로 저장').
  assert.ok(panel.children.some(child=>child.textContent.includes('stored separately')));
  assert.ok(!panel.children.some(child=>child.tagName==='iframe'||child.tagName==='button'));
  controller.dispose();assert.equal(panel.removed,true);
 }finally{controller?.dispose();for(const [key,value] of Object.entries(prior)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
