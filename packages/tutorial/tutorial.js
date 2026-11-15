import { CHARACTERS, TRACKS, MODULES, REFERENCES } from './content.js';
import { mountVisual } from './visuals.js';
import { PAGES, courseFor, validSelection, nextStep, shouldAutoOpen, storageKey } from './state.js';
import { currentPage, featureDocument, navigatePractice, installHighlightStyle } from './adapter.js';
import { publishVisibility, createScrollLock } from './lifecycle.js';
import { rendered, practiceStatus, monitorPractice } from './practice.js';

const ROOT = new URL('../', import.meta.url);
const memory = new Map();
const SINGLETON = Symbol.for('sky-lab.tutorial');
const NOTE = '과학자 캐릭터의 설명은 학습용으로 구성했으며, 실제 인용문이 아닙니다.';
const PAGE_LABELS = { home:'입장 화면', planetarium:'천구 관찰', analysis:'SPHEREx 분석', asteroids:'소행성 분석', experience:'우주 탐험' };

function node(tag, className, text) {
  const element=document.createElement(tag);
  if (className) element.className=className;
  if (text !== undefined) element.textContent=text;
  return element;
}
function button(text, className, action, label) {
  const item=node('button',className,text);
  item.type='button';
  if(label) item.setAttribute('aria-label',label);
  item.addEventListener('click',action);
  return item;
}
function read(key) {
  try { return sessionStorage.getItem(key) ?? memory.get(key) ?? null; }
  catch { return memory.get(key) ?? null; }
}
function write(key,value) {
  try { sessionStorage.setItem(key,value);memory.delete(key);return true; }
  catch { memory.set(key,value);return false; }
}
function stylesheet(name) {
  const url=new URL(name,import.meta.url).href;
  if ([...document.querySelectorAll('link[data-sky-guide-css]')].some(link=>link.href===url)) return;
  const link=node('link'); link.rel='stylesheet'; link.href=url; link.dataset.skyGuideCss='';
  document.head.append(link);
}
function portrait(character, full=false) {
  const person=CHARACTERS[character] ?? CHARACTERS.spherex;
  const wrap=node('div',`sg-portrait${full?' sg-portrait-full':''}`);
  const img=node('img');
  img.src=new URL(full?'assets/spherex-full.png':person.image,import.meta.url).href;
  img.alt=full?'우주 탐사를 안내하는 스피어 캐릭터':`${person.name} 안내 캐릭터`;
  img.decoding='async'; img.width=full?420:256; img.height=full?420:256;
  img.addEventListener('error',()=>{img.remove();wrap.append(node('span','sg-image-fallback',full?'✦':person.name));},{once:true});
  wrap.append(img);
  return wrap;
}
function makeLink(text,url,className) {
  const link=node('a',className,text); link.href=url; link.target='_blank'; link.rel='noopener noreferrer'; return link;
}

/** One guide per document. Storage is tab-session scoped; completion never permanently hides it. */
export function mountTutorial({ page='home', autoOpen=true, embedded=window.self!==window.top }={}) {
  if (window[SINGLETON]) return window[SINGLETON];
  if (!PAGES.includes(page)) page='home';
  stylesheet('tutorial.css'); stylesheet('visuals.css');
  const key=storageKey(ROOT);

  let phase='closed';
  let selection=validSelection(MODULES,read(`${key}:track`),'all');
  let index=0;
  let steps=courseFor(MODULES,selection.track,selection.moduleId);
  let lastFocus=null;
  let cleanupVisual=()=>{};
  let practiceTarget=null;
  let practiceMonitor=null;
  let answer=null;
  let welcome=false;
  let destroyed=false;
  let practiceNavigation=null;
  let navigationError='';
  let navigationPending=false;
  let suspended=null;
  const dialog=node('dialog','sky-guide');
  dialog.setAttribute('aria-labelledby','sky-guide-title');
  dialog.setAttribute('aria-modal','true');
  dialog.dataset.skyTutorialDialog='';
  const dock=node('aside','sg-practice-dock');
  dock.setAttribute('aria-label','튜토리얼 실습 안내'); dock.hidden=true;
  document.body.append(dialog,dock);
  const setScrollLocked=createScrollLock(window,document);

  function signal(open) {
    setScrollLocked(open);
    publishVisibility(window,document,open,phase);
  }
  function snapshotGuide() {
    return phase==='closed'?null:{phase,selection:{...selection},index,welcome};
  }
  function clearPractice() {
    practiceNavigation?.abort();practiceNavigation=null;
    practiceMonitor?.stop();practiceMonitor=null;
    practiceTarget?.classList.remove('sky-tutorial-target');
    practiceTarget=null; dock.hidden=true; dock.replaceChildren();
    if(dock.parentElement!==document.body)document.body.append(dock);
  }
  function focusHeading() {
    dialog.scrollTop=0;
    for(const scroll of dialog.querySelectorAll('.sg-chooser,.sg-lesson,.sg-lesson-main')) scroll.scrollTop=0;
    dialog.querySelector('#sky-guide-title')?.focus({preventScroll:true});
  }
  function show() {
    if (!dialog.open) {
      signal(true);
      try {dialog.showModal();}
      catch(error) {signal(false);throw error;}
    }
    focusHeading();
  }
  function close({restoreFocus=true,preserveHistory=false}={}) {
    if(!preserveHistory)suspended=null;
    cleanupVisual(); cleanupVisual=()=>{}; clearPractice(); phase='closed';
    if (dialog.open) dialog.close();
    signal(false);
    if(restoreFocus) {
      const candidate=lastFocus?.isConnected && lastFocus!==document.body ? lastFocus : document.querySelector('[data-sky-tutorial-open]');
      if(candidate?.focus) candidate.focus({preventScroll:true});
    }
  }
  function header() {
    const top=node('header','sg-top');
    const brand=node('div','sg-brand');
    brand.append(node('span','sg-brand-star','✦'),node('span','','SKY LAB / FIELD GUIDE'));
    const actions=node('div','sg-top-actions');
    if (phase!=='chooser') actions.append(button('주제 선택','sg-text-button',()=>open({track:selection.track,moduleId:selection.moduleId}),'튜토리얼 주제 다시 선택'));
    actions.append(button(phase==='complete'?'닫기 ✕':'건너뛰기 ✕','sg-skip',()=>close(),'튜토리얼 건너뛰기 및 닫기'));
    top.append(brand,actions); return top;
  }
  function title(text) { const h=node('h2','sg-title',text);h.id='sky-guide-title';h.tabIndex=-1;return h; }
  function setView() {
    cleanupVisual(); cleanupVisual=()=>{};
    dialog.replaceChildren(header());
  }
  function open(options={}) {
    if(destroyed) return;
    if(phase==='closed' || phase==='practice') lastFocus=document.activeElement;
    clearPractice();suspended=null;
    selection=validSelection(MODULES,options.track ?? selection.track,options.moduleId ?? 'all');
    welcome=options.welcome===true;
    phase='chooser';
    renderChooser(); show();
  }
  function renderChooser() {
    setView();
    const layout=node('div','sg-chooser');
    const intro=node('aside','sg-intro');
    intro.append(node('p','sg-eyebrow',welcome?'WELCOME ABOARD':'YOUR NEXT DISCOVERY'),portrait('spherex',true));
    const greeting=node('div','sg-intro-copy');
    greeting.append(node('strong','','반가워요, 저는 스피어예요.'),node('p','','별을 찾고, 빛을 읽고, 발견의 근거를 함께 살펴봐요.'));
    const crew=node('p','sg-crew','파인만 · 도플러 · 아인슈타인\n케플러 · 칼 세이건과 함께');
    intro.append(greeting,crew);
    const main=node('section','sg-chooser-main');
    main.append(node('p','sg-eyebrow','나에게 맞는 관측 안내서'),title(welcome?'별빛을 읽는 첫 여행':'어떤 안내를 다시 볼까요?'),
      node('p','sg-lead','눈높이를 고르고, 처음부터 배우거나 필요한 주제만 골라보세요. 언제든 건너뛸 수 있어요.'));
    const tracks=node('div','sg-track-options'); tracks.setAttribute('role','group'); tracks.setAttribute('aria-label','튜토리얼 대상 선택');
    for (const id of ['beginner','research']) {
      const info=TRACKS[id];
      const option=button('',`sg-track${selection.track===id?' is-selected':''}`,()=>{
        selection.track=id;write(`${key}:track`,id);renderChooser();dialog.querySelector(`[data-sg-track="${id}"]`)?.focus();
      });
      option.dataset.sgTrack=id;option.setAttribute('aria-pressed',String(selection.track===id));
      option.append(node('span','sg-track-icon',id==='beginner'?'✧':'⌁'),node('strong','',info.label),node('span','sg-track-desc',info.description));
      tracks.append(option);
    }
    main.append(tracks,node('h3','sg-section-label','다시 보고 싶은 주제'));
    const topics=node('div','sg-topic-list');
    MODULES.forEach((module,i)=>{
      const option=button('','sg-topic',()=>start(module.id),`${module.title} 튜토리얼 시작`);
      if(selection.moduleId===module.id) option.classList.add('is-recommended');
      const copy=node('span','sg-topic-copy');copy.append(node('strong','',module.title),node('span','',module.description));
      option.append(node('span','sg-topic-number',String(i+1).padStart(2,'0')),copy,node('span','sg-topic-time',`${module.minutes[selection.track]}분 ↗`));
      topics.append(option);
    });
    const total=MODULES.reduce((sum,item)=>sum+Number(item.minutes[selection.track]||0),0);
    const all=button('처음부터 함께 시작하기 →','sg-primary sg-start-all',()=>start('all'));
    all.append(node('small','',`전체 ${MODULES.length}개 주제 · 약 ${total}분`));
    main.append(topics,all,node('p','sg-note',NOTE));
    layout.append(intro,main);dialog.append(layout);
  }
  function start(moduleId) {
    selection=validSelection(MODULES,selection.track,moduleId);
    steps=courseFor(MODULES,selection.track,selection.moduleId); index=0;answer=null;
    if(!steps.length) {open();return;}
    write(`${key}:track`,selection.track); phase='lesson';renderLesson();show();
  }
  function advance(direction) {
    const next=nextStep(index,steps.length,direction);index=next.index;answer=null;
    phase=next.complete?'complete':'lesson';
    if(next.complete) renderComplete(); else renderLesson();
    focusHeading();
  }
  function lessonAside(step) {
    const person=CHARACTERS[step.character]??CHARACTERS.spherex;
    const aside=node('aside','sg-mentor');
    aside.append(node('p','sg-eyebrow',selection.track==='research'?'RESEARCH NOTE':'EXPLORER NOTE'),portrait(step.character));
    const identity=node('div','sg-mentor-identity');
    identity.append(node('p','sg-mentor-name',person.name),node('p','sg-mentor-role',person.role));
    aside.append(identity,node('div','sg-mentor-line'),node('p','sg-mentor-topic',step.moduleTitle),node('p','sg-mentor-note',NOTE));
    return aside;
  }
  function renderLesson() {
    setView();
    const step=steps[index];
    const layout=node('div','sg-lesson');layout.append(lessonAside(step));
    const article=node('article','sg-lesson-main');
    const breadcrumb=node('p','sg-eyebrow',`${TRACKS[selection.track].label} / ${step.moduleTitle}`);
    article.append(breadcrumb,title(step.title));
    const words=node('div','sg-explanation');
    step.body.forEach(text=>words.append(node('p','',text)));
    if(step.bullets?.length) { const list=node('ul');step.bullets.forEach(text=>list.append(node('li','',text)));words.append(list); }
    article.append(words);
    const visual=node('section','sg-visual');visual.setAttribute('aria-label','설명을 돕는 학습용 예시');
    if(step.visual) article.append(visual);
    if(step.check) {
      const quiz=node('section','sg-check');quiz.setAttribute('aria-labelledby','sg-check-question');
      const question=node('h3','',step.check.question);question.id='sg-check-question';
      quiz.append(node('p','sg-eyebrow','잠깐, 이해했는지 확인해요'),question);
      const choices=node('div','sg-check-choices');
      const feedback=node('p','sg-check-feedback');feedback.setAttribute('role','status');
      step.check.choices.forEach((text,i)=>{
        const choice=button(text,'sg-check-choice',()=>{
          answer=i;
          for(const child of choices.children) child.setAttribute('aria-pressed',String(Number(child.dataset.answer)===i));
          feedback.classList.toggle('is-correct',i===step.check.answer);
          feedback.textContent=`${i===step.check.answer?'맞아요.':'다시 살펴볼까요?'} ${step.check.explanation}`;
        });
        choice.dataset.answer=String(i);choice.setAttribute('aria-pressed',String(answer===i));choices.append(choice);
      });
      if(answer!==null) {feedback.textContent=`${answer===step.check.answer?'맞아요.':'다시 살펴볼까요?'} ${step.check.explanation}`;feedback.classList.toggle('is-correct',answer===step.check.answer);}
      quiz.append(choices,feedback);article.append(quiz);
    }
    if(step.practice) {
      const practice=node('div','sg-practice-action');
      practice.append(button(step.practice.page===currentPage(window,page)?'이 화면에서 직접 해보기 ↗':`${PAGE_LABELS[step.practice.page]}에서 직접 해보기 ↗`,'sg-secondary',()=>practiceStep()),
        node('span','',step.practice.label));
      article.append(practice);
    }
    if(step.sources?.length) {
      const refs=node('details','sg-sources');refs.append(node('summary','','공식 자료로 더 알아보기'));
      const list=node('ul');
      step.sources.forEach(id=>{const ref=REFERENCES[id];if(!ref)return;const li=node('li');li.append(makeLink(ref.title,ref.url));list.append(li);});
      refs.append(list);article.append(refs);
    }
    layout.append(article);dialog.append(layout);
    const footer=node('footer','sg-footer');
    const back=button('← 이전','sg-secondary',()=>advance(-1));back.disabled=index===0;
    const progress=node('div','sg-progress');
    progress.append(node('span','',`${index+1} / ${steps.length}`));
    const meter=node('progress');meter.max=steps.length;meter.value=index+1;meter.setAttribute('aria-label','튜토리얼 진행');progress.append(meter);
    const next=button(index===steps.length-1?'안내 마치기 ✓':'다음 →','sg-primary',()=>advance(1));
    footer.append(back,progress,next);dialog.append(footer);
    if(step.visual) {
      try {cleanupVisual=mountVisual(visual,step.visual,{track:selection.track,step})??(()=>{});}
      catch {visual.replaceChildren(node('p','sg-note','예시 그림을 표시하지 못했습니다. 위 설명과 다음 단계는 계속 이용할 수 있습니다.'));}
    }
  }
  function renderComplete() {
    setView();
    const wrap=node('section','sg-complete');
    wrap.append(portrait('spherex'),node('p','sg-eyebrow','READY FOR YOUR NEXT DISCOVERY'),title('이제, 직접 별빛을 읽어보세요.'),
      node('p','sg-lead',selection.moduleId==='all'?'하늘 탐색부터 분석 결과의 근거까지 살펴봤어요. 궁금할 때마다 상단의 튜토리얼로 돌아오세요.':`${MODULES.find(item=>item.id===selection.moduleId)?.title} 안내를 마쳤어요. 다른 주제를 골라 이어서 배울 수도 있어요.`));
    const actions=node('div','sg-complete-actions');
    actions.append(button('관측 화면으로 돌아가기','sg-primary',()=>close()),button('다른 주제 골라보기','sg-secondary',()=>open({track:selection.track})),button('이 안내 다시 보기','sg-text-button',()=>start(selection.moduleId)));
    wrap.append(actions,node('p','sg-note','관측값과 해석 구분하기 · 결측은 0이 아님 · 변화는 확인이 필요한 후보 · 탐험과 분석 구분하기'));
    dialog.append(wrap);
  }

  function practiceStep() {
    if (!steps[index]?.practice) return;
    enterPractice({navigating:true});
    const controller=new AbortController();
    practiceNavigation=controller;
    navigationError='';
    void navigatePractice(window,steps[index].practice,controller.signal).then((ready)=>{
      if(controller.signal.aborted || destroyed || phase!=='practice')return;
      navigationPending=false;
      if(!ready)navigationError='화면 이동이 완료되지 않았어요. 상단 메뉴에서 실습 화면을 열거나 안내를 계속 볼 수 있어요.';
      practiceMonitor?.refresh();
    }).catch((error)=>{
      if(controller.signal.aborted || destroyed || phase!=='practice')return;
      navigationPending=false;
      navigationError=error?.message || '화면을 열지 못했어요. 상단 메뉴에서 다시 열거나 안내를 계속 볼 수 있어요.';
      practiceMonitor?.refresh();
    });
  }
  function enterPractice({navigating=false}={}) {
    if(destroyed)return;
    cleanupVisual();cleanupVisual=()=>{};
    clearPractice();phase='practice';navigationError='';navigationPending=navigating;
    if(dialog.open)dialog.close();signal(false);
    const step=steps[index];
    const copy=node('div','sg-practice-copy');
    copy.append(node('strong','','직접 해보기'),node('p','',step.practice?.label??step.title));
    const status=node('p','sg-practice-status','화면에서 안내할 도구를 찾고 있어요.');
    status.setAttribute('role','status');copy.append(status);
    const setup=node('div','sg-practice-setup');copy.append(setup);
    const controls=node('div','sg-practice-controls');
    controls.append(button('안내 계속 →','sg-primary',()=>{
      clearPractice();phase='lesson';renderLesson();show();
    }),button('튜토리얼 닫기','sg-text-button',()=>close()));
    dock.append(portrait(step.character),copy,controls);dock.hidden=false;
    const practiceDoc=()=>featureDocument(window,document,step.practice.page);
    const reveal=(candidate)=>{
      if(!rendered(candidate,candidate?.ownerDocument))return;
      candidate.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
      const focusable=candidate.matches('button,input,select,textarea,a[href],[tabindex]')?candidate:candidate.querySelector('summary,button,input,select,textarea,a[href],[tabindex]');
      focusable?.focus({preventScroll:true});
    };
    const readStatus=()=>{
      if(navigationError)return {target:null,state:'navigation-error',message:navigationError};
      if(navigationPending)return {target:null,state:'loading',message:'실습 화면을 준비하고 있어요. 준비되지 않아도 안내는 계속 볼 수 있습니다.'};
      if(currentPage(window,page)!==step.practice.page)return {target:null,state:'other-screen',message:`${PAGE_LABELS[step.practice.page]} 화면에서 실습할 수 있어요. 상단 메뉴로 이동하거나 안내를 계속 볼 수 있습니다.`};
      const doc=practiceDoc();
      const result=practiceStatus(doc,step.practice,step.practice.page);
      const language=step.practice.page==='analysis'?doc?.querySelector('[data-testid="lang-ko"]'):null;
      result.languageAvailable=rendered(language,doc)&&language.getAttribute('aria-pressed')!=='true';
      return result;
    };
    controls.querySelector('button')?.focus({preventScroll:true});
    practiceMonitor=monitorPractice(readStatus,(current,{first})=>{
      if(phase!=='practice')return;
      if(practiceTarget!==current.target){
        practiceTarget?.classList.remove('sky-tutorial-target');
        practiceTarget=current.target;
        if(practiceTarget){installHighlightStyle(practiceTarget.ownerDocument);practiceTarget.classList.add('sky-tutorial-target');}
      }
      status.textContent=current.message;setup.replaceChildren();
      if(current.action)setup.append(button(current.action.label,'sg-secondary',()=>{
        const doc=practiceDoc();const control=doc?.querySelector(current.action.selector);
        if(!rendered(control,doc)||control.disabled)return;
        if(current.action.type==='focus')reveal(control);else control.click();
        practiceMonitor?.refresh();
      }));
      if(current.target)setup.append(button('도구 위치로 이동','sg-text-button',()=>reveal(practiceTarget)));
      if(current.languageAvailable)setup.append(button('한국어로 보기','sg-text-button',()=>{
        practiceDoc()?.querySelector('[data-testid="lang-ko"]')?.click();practiceMonitor?.refresh();
      }));
      // Delayed loads update only the hint. They never pull the user's scroll/focus back.
      if(first&&current.target)reveal(current.target);
    });
  }

  const launch=(event)=>{
    const control=event.target instanceof Element?event.target.closest('[data-sky-tutorial-open]'):null;
    if(!control)return;
    event.preventDefault();open({track:control.dataset.skyTutorialTrack,moduleId:control.dataset.skyTutorialModule});
  };
  const custom=(event)=>open(event.detail??{});

  const pageHide=()=>{
    suspended=snapshotGuide();
    close({restoreFocus:false,preserveHistory:true});
  };
  const pageShow=(event)=>{
    if(!event.persisted||destroyed||!suspended)return;
    const saved=suspended;suspended=null;
    selection=saved.selection;index=saved.index;welcome=saved.welcome;
    steps=courseFor(MODULES,selection.track,selection.moduleId);
    if(saved.phase==='practice'){enterPractice();return;}
    phase=saved.phase;
    if(phase==='chooser')renderChooser();else if(phase==='complete')renderComplete();else renderLesson();
    show();
  };
  document.addEventListener('click',launch);
  window.addEventListener('sky-tutorial-open',custom);
  window.addEventListener('pagehide',pageHide);
  window.addEventListener('pageshow',pageShow);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  // Keep app-level Escape, Space and arrow shortcuts from acting behind a modal guide.
  for(const type of ['keydown','keyup','keypress']) dialog.addEventListener(type,event=>{
    event.stopPropagation();
    if(type==='keydown' && event.key==='Escape') {event.preventDefault();close();}
  });
  const api={open,close,destroy(){
    close({restoreFocus:false});destroyed=true;
    document.removeEventListener('click',launch);window.removeEventListener('sky-tutorial-open',custom);window.removeEventListener('pagehide',pageHide);window.removeEventListener('pageshow',pageShow);
    dialog.remove();dock.remove();delete window[SINGLETON];
  }};
  window[SINGLETON]=api;
  if(autoOpen && shouldAutoOpen({embedded}))queueMicrotask(()=>open({welcome:true}));
  return api;
}
