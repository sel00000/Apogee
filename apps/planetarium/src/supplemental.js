/* Supplemental observation links; never loaded as an engine catalog.
 * SPDX-License-Identifier: AGPL-3.0-only */
import {openParentAnalysis} from './integration.js';
import {buildAnalysisUrl} from './analysis-target.js';
const base=new URL('../',import.meta.url);
const outer=new URL(base.pathname.endsWith('/dist/')?'../../':'../',base);
const references=[
 {label:'말머리 성운',ra:85.254125,dec:-2.4533111111,distance:1300,instrument:'Hubble WFC3',image:'horsehead.jpg',credit:'NASA, ESA, Hubble Heritage Team (AURA/STScI)',source:'https://esahubble.org/images/heic1307a/'},
 {label:'카리나 · 우주 절벽',ra:159.212625,dec:-58.6200166667,distance:7600,instrument:'Webb NIRCam',image:'carina.jpg',credit:'NASA, ESA, CSA, STScI',source:'https://esawebb.org/images/weic2205a/'},
];
function analyze(target){if(!openParentAnalysis(target))window.open(buildAnalysisUrl(target,base,false),'_blank','noopener');}
export async function mountSupplemental(focusCoordinates){
 const section=document.createElement('section');section.className='control-section supplemental-observations';
 section.innerHTML='<h2 class="section-heading"><span>SPHEREx 관측으로 이어가기</span></h2><p class="field-note">원본 천체 카탈로그와 별개인 관측 좌표 바로가기입니다.</p><div class="prepared-links"></div><h3>성운 상세 참고 영상</h3><p class="field-note">전천 배경과 별개인 Hubble·Webb의 실제 관측입니다.</p>';
 document.querySelector('#app-controls').append(section);
 const prepared=section.querySelector('.prepared-links');
 try{
  const response=await fetch(new URL('analysis/data/targets.json',outer));
  if(response.ok){
   const data=await response.json();
   for(const item of data.targets||[]){
    if(!Number.isFinite(item.ra)||!Number.isFinite(item.dec)||Math.abs(item.dec)>90)continue;
    const label=({'barnard':'바너드별','eps_indi_b':'인디언자리 엡실론 B','wise0855':'WISE 0855','rw_aur':'마차부자리 RW','r_dra':'용자리 R'})[item.id]||item.display_name;
    const row=document.createElement('div');row.className='prepared-row';const focus=document.createElement('button');focus.type='button';focus.className='button button-secondary';focus.textContent=label;focus.onclick=()=>focusCoordinates(item.ra,item.dec,label);
    const open=document.createElement('button');open.type='button';open.className='button button-secondary';open.textContent='분석';open.setAttribute('aria-label',`${label} 준비된 SPHEREx 분석`);open.onclick=()=>analyze({target:item.id,ra:item.ra,dec:item.dec,label});row.append(focus,open);prepared.append(row);
   }
  }
 }catch{prepared.textContent='준비된 관측 목록을 불러오지 못했습니다. 천체 선택과 좌표 분석은 계속 사용할 수 있습니다.';}
 for(const item of references){
  const card=document.createElement('article');card.className='reference-observation';
  const image=document.createElement('img');image.loading='lazy';image.src=new URL('assets/reference/'+item.image,base);image.alt=`${item.label} · ${item.instrument} 실제 관측`;
  const title=document.createElement('h4');title.textContent=item.label;
  const text=document.createElement('p');text.className='field-note';text.textContent=`${item.instrument} · 약 ${item.distance.toLocaleString('ko-KR')}광년. 거리: 해당 관측 공개 자료의 근사값. ${item.credit}`;
  const source=document.createElement('a');source.href=item.source;source.target='_blank';source.rel='noreferrer';source.textContent='관측 출처 ↗';
  const focus=document.createElement('button');focus.type='button';focus.className='button button-secondary';focus.textContent='천구에서 보기';focus.onclick=()=>focusCoordinates(item.ra,item.dec,item.label);
  const open=document.createElement('button');open.type='button';open.className='button button-secondary';open.textContent='SPHEREx 분석';open.onclick=()=>analyze(item);
  card.append(image,title,text,source,focus,open);section.append(card);
 }
}
