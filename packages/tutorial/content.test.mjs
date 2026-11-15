
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {CHARACTERS,TRACKS,MODULES,TUTORIAL_NOTE,getSteps} from './content.js';
const root=dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const collect=(path)=>readdirSync(path,{withFileTypes:true}).flatMap(e=>{
 if(['node_modules','dist','.git'].includes(e.name))return [];
 const name=join(path,e.name);
 return e.isDirectory()?collect(name):/\.(?:tsx?|js|html)$/.test(e.name)?[readFileSync(name,'utf8')]:[];
}).join('\n');
test('six selectable subjects contain twenty lessons per track with supplied characters and meaningful diagrams',()=>{
 const ids=new Set(),visuals=new Set(['sky','region','timeline','wavelength','spectrum','mask','uncertainty','provenance']);
 assert.equal(MODULES.length,6);
 for(const track of Object.keys(TRACKS)){
  assert.equal(getSteps(track).length,20);
  const used=new Set();
  for(const m of MODULES){
   assert.ok(m.steps[track].length>=2&&m.minutes[track]>0);
   for(const s of getSteps(track,m.id)){
    assert.ok(!ids.has(s.id));ids.add(s.id);
    assert.equal(s.moduleId,m.id);assert.equal(s.moduleTitle,m.title);
    assert.ok(CHARACTERS[s.character]);used.add(s.character);
    assert.ok(visuals.has(s.visual));assert.ok(s.title&&s.body.length>=2);
    if(s.check){assert.ok(s.check.answer>=0&&s.check.answer<s.check.choices.length);assert.ok(s.check.explanation);}
   }
  }
  assert.equal(used.size,Object.keys(CHARACTERS).length);
 }
});
test('practice selectors exist in the migrated apps and never point at removed legacy tabs',()=>{
 const source={
  home:collect(join(root,'apps/portal')),
  planetarium:readFileSync(join(root,'apps/planetarium/index.html'),'utf8'),
  analysis:collect(join(root,'apps/analysis/src')),
  asteroids:collect(join(root,'apps/asteroids/src')),
 };
 source.experience=source.home;
 for(const s of [...getSteps('beginner'),...getSteps('research')]){
  const p=s.practice;if(!p)continue;
  assert.ok(source[p.page]&&p.label&&p.hint,s.id);
  assert.doesNotMatch(p.selector,/rtab-|viewer-panel|mask-reasons|sequence-picker/);
  if(p.selector.startsWith('#')){
   assert.ok(source[p.page].includes('id="'+p.selector.slice(1)+'"'),s.id+' '+p.selector);
  }else if(p.tab){
   assert.ok(['spectrum','variable','motion','provenance'].includes(p.tab));
   assert.ok(source.analysis.includes('atab-')&&source.analysis.includes(p.tab));
  }else{
   const attr=p.selector.slice(1,-1);
   assert.ok(source[p.page].includes(attr)||source[p.page].includes(attr.replaceAll('"',"'")),s.id+' '+p.selector);
  }
 }
});
test('research practices open an explicit available prepared example rather than pretend arbitrary fields support labs',()=>{
 for(const s of [...getSteps('beginner'),...getSteps('research')]){
  const p=s.practice;if(!p?.tab)continue;
  assert.ok(p.requires.includes('prepared')&&p.requires.includes('research'));
  assert.equal(p.params.mode,'research');assert.equal(p.params.tab,p.tab);
  assert.equal(p.params.target,p.tab==='variable'?'rw_aur':'eps_indi_b');
  assert.match(p.label,/준비 예제/);
 }
});
test('selection cannot expose unknown courses and educational status remains explicit',()=>{
 assert.deepEqual(getSteps('__proto__','sky'),getSteps('beginner','sky'));
 assert.deepEqual(getSteps('research','unknown'),[]);
 assert.match(TUTORIAL_NOTE,/실제 발언/);assert.match(TUTORIAL_NOTE,/가상 자료/);
 for(const c of Object.values(CHARACTERS)){
  assert.match(c.image,/^assets\/[a-z-]+\.png$/);
  assert.ok(existsSync(join(root,'packages/tutorial',c.image)));
 }
 assert.ok(existsSync(join(root,'packages/tutorial/assets/spherex-full.png')));
 const copy=JSON.stringify(MODULES);
 assert.match(copy,/설명용 모형/);assert.match(copy,/과학적 검출/);
 assert.doesNotMatch(copy,/이 앱은 지원되는 릴리스의 공식 CWAVE|앱은 오차 성분과 광도곡선 차이의 공분산/);
});
