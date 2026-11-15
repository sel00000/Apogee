import {artifactUrl, interval, jobResultUrl, matchTarget, number, scientific, statusLabel, validateCatalog, validateResult} from './research-model';
import {forgetSession, loadApiConfig, sessionHeaders} from './api-config';
import type {ApiConfig} from './api-config';
import type {AnalysisJob, AnalysisResult, CatalogItem} from './research-model';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const api = '/api/asteroid-analysis';
const catalogUrl = new URL('./analysis-data/index.json', location.href).href;
const confident = (v: unknown) => ({Low:'낮음',Medium:'중간',High:'높음'} as Record<string,string>)[String(v)] ?? String(v ?? '미제공');

export function mountResearch(host: HTMLElement, options: {
  target?: string; onTarget: (target: string) => void;
  onOrbit: (target: string, sceneUrl?: string) => void;
}) {
  let catalog: CatalogItem[] = [], target = options.target ?? '', currentJob: AnalysisJob|null = null;
  let active = true, disposed = false, generation = 0, pollTimer = 0;
  let capabilities: {available: boolean; reason?: string; maxImages?: number; activeJobId?: string}|null = null;
  let loadController: AbortController|null = null, pollController: AbortController|null = null;
  const controller = new AbortController();
  let apiConfig: ApiConfig = {apiBase:''}, checking = false;
  const storageKey = () => 'spherex-v5-asteroid-job:'+(apiConfig.apiBase || location.origin);
  let loadedJobResult = '', lastJobId = '', submitting = false;
  host.innerHTML = `<div class="research-layout">
    <aside class="research-controls"><div class="eyebrow">SPHEREX ASTEROID LAB</div><h1>소행성의 빛을<br>분석합니다.</h1>
      <p>준비된 실제 관측 결과를 살펴보거나, 대상과 기간을 정해 새 분석을 실행하세요.</p>
      <label for="research-target">준비된 분석 결과</label><select id="research-target" data-tutorial="asteroid-target" aria-label="준비된 소행성 분석 결과"><option value="">목록 불러오는 중…</option></select>
      <p id="catalog-status" role="status"></p><button id="catalog-retry" hidden>목록 다시 불러오기</button>
      <button id="research-orbit">선택 대상의 궤도·관측 보기 ↗</button>
      <form id="analysis-form" data-tutorial="asteroid-run"><h2>새 분석 실행</h2>
        <label for="job-target">소행성 번호 또는 이름</label><input id="job-target" maxlength="80" placeholder="예: 433 또는 Eros" required autocomplete="off">
        <div class="date-fields"><label>시작일 UTC<input id="job-start" type="date" value="2025-06-01" min="1900-01-01" max="2100-12-31" required></label><label>종료일 UTC<input id="job-end" type="date" value="2025-08-01" min="1900-01-01" max="2100-12-31" required></label></div>
        <label for="job-limit">최대 노출 수</label><input id="job-limit" type="number" min="1" max="360" step="1" value="120" required>
        <p class="form-note">실제 아카이브를 조회하고 측광·분광 모델을 계산합니다. 관측 수와 외부 응답에 따라 시간이 걸립니다.</p>
        <button id="job-submit" type="submit" disabled>분석 실행</button><p id="capabilities" role="status">분석 서버 확인 중…</p><button id="server-retry" type="button">서버 다시 연결</button>
      </form>
      <section class="job-panel" id="job-panel" hidden aria-label="분석 진행 상태"><h2 id="job-title">분석 작업</h2><p id="job-status" role="status" aria-live="polite"></p><pre id="job-logs" aria-label="분석 진행 기록"></pre><div class="job-actions"><button id="job-cancel">분석 취소</button><button id="job-retry-status" hidden>상태 다시 확인</button><button id="job-open" hidden>결과 열기</button><button id="scene-build" hidden>이 결과의 3D 자료 생성</button><button id="scene-cancel" hidden>3D 생성 취소</button><button id="scene-open" hidden>생성된 3D 열기</button></div><p id="scene-status" role="status"></p></section>
    </aside>
    <section class="research-result" data-tutorial="asteroid-results" aria-label="소행성 분석 결과"><div id="result-status" role="status">준비된 분석 결과를 불러오는 중…</div><div id="result-content"></div></section>
  </div>`;
  const el = <T extends HTMLElement>(id: string) => host.querySelector<T>('#'+id)!;
  const input = el<HTMLInputElement>('job-target');
  const resultStatus = el('result-status');
  const resultContent = el('result-content');
  const setStatus = (message: string, isError = false) => { resultStatus.textContent = message; resultStatus.classList.toggle('error', isError); };
  async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {cache:'no-store', credentials:'omit', ...init});
    let value: any;
    try { value = await response.json(); } catch { throw Error(`서버 응답을 읽을 수 없습니다 (${response.status}).`); }
    if (!response.ok) throw Object.assign(Error(value.error || `요청 실패 (${response.status})`),{status:response.status,jobId:value.id});
    return value;
  }
  async function requestApi<T>(path: string, init: RequestInit = {}): Promise<T> {
    const config=apiConfig;
    const headers = new Headers(init.headers);
    for(const [name,value] of Object.entries(await sessionHeaders(config, init.signal ?? controller.signal))) headers.set(name,value);
    try{return await request<T>(config.apiBase+api+path,{...init,headers,redirect:'error'});}
    catch(error){if((error as {status?:number}).status===401)forgetSession(config);throw error;}
  }
  async function checkCapabilities(force = false) {
    if(checking || disposed)return;
    checking=true;el<HTMLButtonElement>('server-retry').disabled=true;updateRunButton();
    try {
      const config=await loadApiConfig(controller.signal,force);
      if(disposed)return;
      if(config.apiBase!==apiConfig.apiBase){clearTimeout(pollTimer);pollController?.abort();currentJob=null;lastJobId='';loadedJobResult='';el('job-panel').hidden=true;}
      apiConfig=config;
      if(!config.apiBase && config.localServices===false && !config.publicMode)throw Error('새 분석 서버가 연결되어 있지 않습니다. 준비된 결과는 계속 볼 수 있습니다.');
      capabilities = await request(config.apiBase+api+'/capabilities', {signal:controller.signal});
      if(disposed)return;
      el('capabilities').textContent = capabilities!.available ? '분석 서버에 연결되었습니다. 결과와 3D 자료는 각각 준비됩니다.' : capabilities!.reason || '새 분석 서버를 사용할 수 없습니다. 준비된 결과는 볼 수 있습니다.';
      el<HTMLInputElement>('job-limit').max = String(capabilities!.maxImages ?? 360);
      if (!currentJob && capabilities!.activeJobId) void poll(capabilities!.activeJobId);
      else if(!currentJob && capabilities!.available){try{const remembered=sessionStorage.getItem(storageKey());if(remembered&&/^[a-f0-9-]{36}$/.test(remembered))void poll(remembered);}catch{/* Optional persistence. */}}
    } catch (error) {
      if (disposed) return;
      capabilities = {available:false};
      el('capabilities').textContent = '새 분석 서버에 연결되지 않았습니다. '+(error as Error).message+' 준비된 결과는 계속 볼 수 있습니다.';
    } finally {
      checking=false;if(!disposed){el<HTMLButtonElement>('server-retry').disabled=false;updateRunButton();}
    }
  }
  function updateRunButton() {
    el<HTMLButtonElement>('job-submit').disabled = checking || submitting || !capabilities?.available || !!currentJob && ['running','queued'].includes(currentJob.status);
  }
  function renderResult(result: AnalysisResult, url: string) {
    const r = result.record;
    const text = (key: string) => typeof r[key] === 'string' ? String(r[key]) : '미제공';
    const diameterRows = [
      ['열모델', r.diameter_km, r.diameter_interval_68_km, r.diameter_source],
      ['통계적 추정', r.diameter_statistical_km, r.diameter_statistical_interval_68_km, r.diameter_statistical_method],
      ['열모델 + 사전분포', r.diameter_combined_km, r.diameter_combined_interval_68_km, r.diameter_combined_method],
      ['외부 카탈로그', r.catalog_diameter_km, null, r.catalog_diameter_source],
      ['관측 방향 형상 참고값', r.catalog_effective_diameter_km, r.catalog_effective_diameter_interval_68_km, '외부 형상과 관측 방향을 적용한 유효 지름'],
    ];
    const limits = Array.isArray(r.limitations) ? r.limitations : [];
    const densityOnHold = limits.some(v => /density.*hold/i.test(String(v)));
    const plots = result.assets?.plots ?? [];
    const plotNames: Record<string,string> = {spectrum:'관측 스펙트럼',separation:'반사광·열복사 분리',residuals:'모형 잔차',reference_comparison:'분류 기준 비교','reference-comparison':'분류 기준 비교',sky_track:'하늘 이동 경로','sky-track':'하늘 이동 경로'};
    resultContent.innerHTML = `<div class="result-heading"><div><div class="eyebrow">OBSERVATION & MODEL</div><h2>${esc(r.official_name || result.id)}</h2><p>${esc(r.observation_date || '')}</p></div><span class="result-badge">실제 관측 기반</span></div>
      <div class="result-metrics"><article><span>처리 상태</span><strong>${esc(r.quality_status || '미제공')}</strong><small>필드·처리 완료 상태</small></article><article><span>전체 추정 신뢰도</span><strong>${esc(confident(r.confidence_level))}</strong><small>처리 완료와 별도 판단</small></article><article><span>분광 자료</span><strong>${esc(number(result.counts?.points,0))}</strong><small>관측점 · 사용 범위는 보고서 참고</small></article><article><span>분류 추정</span><strong>${esc(r.spectral_class || '미산출')}</strong><small>신뢰도 ${esc(confident(r.classification_confidence))}</small></article></div>
      <p class="research-explanation">스펙트럼과 모형을 비교한 추정 결과입니다. 분류 확률은 모형·기준 분류군·사전분포에 의존하며 광물의 존재 확률이나 확정 판정이 아닙니다. 궤도 화면의 암석 형태·크기·회전은 설명용입니다.</p>
      <div class="plot-grid">${plots.map(plot => {try {return `<figure><img loading="lazy" width="1000" height="600" src="${esc(artifactUrl(url,plot.file))}" alt="${esc(plotNames[plot.kind] || plot.kind)}"><figcaption>${esc(plotNames[plot.kind] || plot.kind)}</figcaption></figure>`;} catch {return '';}}).join('')}</div>
      <section class="result-card"><h3>지름을 읽는 방법</h3><p>서로 다른 자료와 가정을 사용한 값입니다. 통계적 지름은 H와 집단 알베도 사전분포에서 추정하며, 직접 측정값으로 해석하지 않습니다.</p><div class="table-scroll"><table><thead><tr><th>방법</th><th>지름 km</th><th>68% 구간 km</th><th>출처·가정</th></tr></thead><tbody>${diameterRows.map(row => `<tr><th>${esc(row[0])}</th><td>${esc(number(row[1]))}</td><td>${esc(interval(row[2]))}</td><td>${esc(row[3] || '미제공')}</td></tr>`).join('')}</tbody></table></div><p>대표 추정값의 출처: ${esc(r.diameter_best_source || '미제공')} · 신뢰도 ${esc(confident(r.diameter_best_confidence))}</p></section>
      <section class="result-card"><h3>알베도·질량·밀도</h3><dl class="physical-values"><dt>기하 알베도</dt><dd>${esc(number(r.geometric_albedo_pV,3))} ± ${esc(number(r.albedo_uncertainty,3))} · ${esc(r.albedo_status || '미제공')}</dd><dt>질량 kg</dt><dd>${esc(scientific(r.mass_kg))} ± ${esc(scientific(r.mass_uncertainty))}</dd><dt>질량 출처</dt><dd>${esc(r.mass_method || '미제공')} — SPHEREx 스펙트럼에서 직접 측정한 질량이 아닙니다.</dd><dt>밀도 kg/m³</dt><dd>${esc(number(r.density,0))} ± ${esc(number(r.density_uncertainty,0))}${densityOnHold?' · <strong>판정 보류</strong>':''}</dd><dt>형상 가정</dt><dd>${esc(text('shape_assumption'))}</dd></dl></section>
      <section class="result-card"><h3>제한과 보류 사유</h3>${limits.length?`<ul>${limits.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:'<p>저장된 제한 사항이 없습니다. 이를 높은 신뢰도로 해석하지 마세요.</p>'}</section>
      <section class="result-card"><h3>자료와 재현 정보</h3><div id="result-downloads" class="download-links"></div><p>분석 시각 ${esc(r.analysis_timestamp || '미제공')} · 모형 ${esc(r.model_version || '미제공')}</p><details><summary>입력 자료 출처</summary><pre>${esc(JSON.stringify(r.input_data_sources ?? [],null,2))}</pre></details><details><summary>분류 사전분포</summary><pre>${esc(JSON.stringify(r.classification_prior ?? null,null,2))}</pre></details><details><summary>전체 결과 JSON</summary><pre>${esc(JSON.stringify(result,null,2))}</pre></details></section>`;
    const downloads = el('result-downloads');
    for (const [key,label] of [['report','분석 보고서'],['observations','관측 CSV'],['spectrum','스펙트럼 CSV'],['components','성분 CSV'],['temporal','시간 분석 JSON']]) {
      const file = result.assets?.[key as keyof NonNullable<AnalysisResult['assets']>];
      if (typeof file !== 'string') continue;
      try { const a = document.createElement('a'); a.href=artifactUrl(url,file); a.textContent=label+' ↗'; a.target='_blank'; a.rel='noopener'; downloads.append(a); } catch { /* Invalid artifact paths are never opened. */ }
    }
  }
  async function loadResult(url: string, expectedId?: string) {
    const ownGeneration = ++generation;
    loadController?.abort(); loadController = new AbortController();
    resultContent.replaceChildren(); setStatus('분석 결과를 불러오는 중…');
    try {
      const result = validateResult(await request(url,{signal:loadController.signal}));
      if (disposed || ownGeneration!==generation) return;
      if (expectedId && result.id!==expectedId) throw Error('선택한 대상과 결과의 식별자가 다릅니다.');
      renderResult(result,url); setStatus('');
      if (result.coverage?.start?.match(/^\d{4}-\d{2}-\d{2}/)) el<HTMLInputElement>('job-start').value=result.coverage.start.slice(0,10);
      if (result.coverage?.end?.match(/^\d{4}-\d{2}-\d{2}/)) el<HTMLInputElement>('job-end').value=result.coverage.end.slice(0,10);
    } catch(error) {
      if (disposed || ownGeneration!==generation || loadController.signal.aborted) return;
      setStatus(`결과를 열지 못했습니다: ${String((error as Error).message)}`,true);
      const retry=document.createElement('button');retry.textContent='결과 다시 불러오기';retry.onclick=()=>void loadResult(url,expectedId);resultContent.append(retry);
    }
  }
  function selectTarget(value: string, announce = true) {
    const item = matchTarget(catalog,value);
    target=item?.numberedId || item?.objectId || item?.id || value.trim(); input.value=target;
    el<HTMLSelectElement>('research-target').value=item?.id || '';
    if (announce) options.onTarget(target);
    if (item) {
      try { void loadResult(artifactUrl(catalogUrl,item.detail),item.id); } catch(error) { setStatus(String(error),true); }
    } else if (target) {
      ++generation;loadController?.abort();resultContent.replaceChildren();setStatus(`“${target}”의 준비된 분석 결과가 없습니다. 대상과 기간을 확인한 뒤 새 분석을 실행할 수 있습니다.`);
    }
  }
  async function loadCatalog() {
    el('catalog-status').textContent='목록 불러오는 중…';el('catalog-retry').hidden=true;
    try {
      const value=validateCatalog(await request(catalogUrl,{signal:controller.signal}));
      if(disposed)return;
      catalog=value.targets;
      el<HTMLSelectElement>('research-target').innerHTML='<option value="">대상 선택</option>'+catalog.map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
      el('catalog-status').textContent=`${catalog.length}개 대상의 저장된 결과 · 새로운 분석과 구분해 표시합니다.`;
      if(target)selectTarget(target,false); else if(catalog[0])selectTarget(catalog[0].id); else setStatus('준비된 결과가 없습니다. 새 분석을 실행할 수 있습니다.');
    } catch(error) {
      if(disposed)return;
      el('catalog-status').textContent='분석 목록을 열지 못했습니다.';el('catalog-retry').hidden=false;
      el<HTMLSelectElement>('research-target').innerHTML='<option value="">목록 연결 오류</option>';
      setStatus('준비된 결과 목록을 불러오지 못했습니다. 다시 시도하거나 새 분석 서버 상태를 확인하세요.',true);
    }
  }
  function rememberJob(id: string) { try {sessionStorage.setItem(storageKey(),id);} catch { /* Session persistence is optional. */ } }
  function renderJob(job: AnalysisJob) {
    currentJob=job;rememberJob(job.id);el('job-panel').hidden=false;
    el('job-title').textContent=job.target+' · 분석 작업';
    el('job-status').textContent=`${statusLabel(job.status)}${job.error?' · '+job.error:''}`;
    const log=el('job-logs');const atEnd=log.scrollHeight-log.scrollTop-log.clientHeight<30;
    log.textContent=(job.logs || []).join('\n');if(atEnd)log.scrollTop=log.scrollHeight;
    el('job-cancel').hidden=!['queued','running'].includes(job.status);
    el('job-open').hidden=job.status!=='completed'||!job.resultUrl;
    el('scene-build').hidden=job.status!=='completed'||job.scene?.status==='running'||job.scene?.status==='completed';
    el('scene-build').textContent=job.scene?.status==='failed'?'3D 자료 다시 생성':'이 결과의 3D 자료 생성';
    el('scene-open').hidden=job.scene?.status!=='completed'||!job.scene.url;
    el('scene-cancel').hidden=job.scene?.status!=='running';
    el('scene-status').textContent=job.scene?.status==='completed'?'이 분석에서 생성한 3D 자료가 준비되었습니다.':job.scene?.status==='running'?'분석 결과는 준비되었습니다. 실제 궤도·영상·시점 자료를 별도로 만드는 중입니다.':job.scene?.error?'3D 자료 생성 실패: '+job.scene.error:job.status==='completed'?'분석 완료는 3D 자료 생성이나 높은 과학적 신뢰도를 뜻하지 않습니다.':'';
    updateRunButton();
  }
  async function openJobResult() {
    if(!currentJob?.resultUrl)return;
    const url=jobResultUrl(currentJob.resultUrl,location.origin,apiConfig.apiBase);
    if(!url){el('job-status').textContent='분석 결과 주소가 설정된 서버의 작업 경로와 일치하지 않습니다.';return;}
    loadedJobResult=currentJob.id;
    target=currentJob.target;input.value=target;options.onTarget(target);
    await loadResult(url);
  }
  async function poll(id: string) {
    lastJobId=id;
    clearTimeout(pollTimer);if(disposed||!active)return;
    pollController?.abort();const ownController=new AbortController();pollController=ownController;
    try {
      const job=await requestApi<AnalysisJob>('/jobs/'+encodeURIComponent(id),{signal:ownController.signal});
      if(disposed||ownController.signal.aborted||pollController!==ownController)return;
      el('job-retry-status').hidden=true;renderJob(job);
      if(job.status==='completed'&&loadedJobResult!==job.id&&target===job.target)void openJobResult();
      if(['queued','running'].includes(job.status)||job.scene?.status==='running')pollTimer=window.setTimeout(()=>void poll(id),1500);
    } catch(error) {
      if(disposed||ownController.signal.aborted||pollController!==ownController)return;
      el('job-panel').hidden=false;el('job-status').textContent='상태를 확인하지 못했습니다: '+(error as Error).message;
      el('job-retry-status').hidden=false;
    }
  }
  el<HTMLFormElement>('analysis-form').onsubmit=async event=>{
    event.preventDefault();
    if(submitting)return;
    const start=el<HTMLInputElement>('job-start').value,end=el<HTMLInputElement>('job-end').value;
    if(end<start){el('capabilities').textContent='종료일은 시작일 이후여야 합니다.';return;}
    submitting=true;updateRunButton();
    try {
      const job=await requestApi<AnalysisJob>('/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target:input.value.trim(),start,end,maxImages:el<HTMLInputElement>('job-limit').valueAsNumber}),signal:controller.signal});
      target=job.target;options.onTarget(target);renderJob(job);void poll(job.id);
    }catch(error){
      if(!disposed){
        el('capabilities').textContent=(error as Error).message;
        const conflict=error as {status?:number;jobId?:string};
        if(conflict.status===409&&conflict.jobId&&/^[a-f0-9-]{36}$/.test(conflict.jobId))void poll(conflict.jobId);
      }
    }finally{submitting=false;updateRunButton();}
  };
  el('job-cancel').onclick=async()=>{if(!currentJob)return;try{renderJob(await requestApi('/jobs/'+currentJob.id,{method:'DELETE',signal:controller.signal}));clearTimeout(pollTimer);}catch(error){el('job-status').textContent=(error as Error).message;}};
  el('scene-build').onclick=async()=>{if(!currentJob)return;el<HTMLButtonElement>('scene-build').disabled=true;try{renderJob(await requestApi('/jobs/'+currentJob.id+'/scene',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:controller.signal}));void poll(currentJob.id);}catch(error){el('scene-status').textContent=(error as Error).message;}finally{el<HTMLButtonElement>('scene-build').disabled=false;}};
  el('scene-cancel').onclick=async()=>{if(!currentJob)return;try{renderJob(await requestApi('/jobs/'+currentJob.id+'/scene',{method:'DELETE',signal:controller.signal}));clearTimeout(pollTimer);}catch(error){el('scene-status').textContent=(error as Error).message;}};
  el('scene-open').onclick=()=>{if(currentJob?.scene?.url)options.onOrbit(currentJob.target,currentJob.scene.url);};
  el('job-open').onclick=()=>void openJobResult();
  el('job-retry-status').onclick=()=>{if(lastJobId)void poll(lastJobId);};
  el('catalog-retry').onclick=()=>void loadCatalog();
  el('server-retry').onclick=()=>void checkCapabilities(true);
  el<HTMLSelectElement>('research-target').onchange=event=>selectTarget((event.target as HTMLSelectElement).value);
  el('research-orbit').onclick=()=>options.onOrbit(target);
  void loadCatalog();void checkCapabilities();
  return {
    selectTarget,
    setActive(value: boolean){active=value;if(!value){clearTimeout(pollTimer);pollController?.abort();}else if(lastJobId)void poll(lastJobId);},
    dispose(){disposed=true;++generation;clearTimeout(pollTimer);controller.abort();loadController?.abort();pollController?.abort();host.replaceChildren();},
  };
}
