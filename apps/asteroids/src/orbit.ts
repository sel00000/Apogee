import { initialBody } from "./research-model";
import { SolarScene } from "./scene";
import { ObservationViewer } from "./observations";
import { date } from "./math";
import { trailDescription } from "./trails";
import type {
  Body,
  Observation,
  Manifest,
  Sequence,
  Sightline,
  ImageTrail,
} from "./types";
export async function mountOrbit(app: HTMLElement, options: {target?: string; dataBase: string; signal?: AbortSignal; onTarget: (id: string) => void}) {
const lifecycle = new AbortController();
options.signal?.throwIfAborted();
options.signal?.addEventListener('abort',()=>lifecycle.abort(),{once:true});
async function json<T>(p: string): Promise<T> {
  const r = await fetch(new URL(p, options.dataBase), {signal:lifecycle.signal});
  if (!r.ok) throw Error(`${p}: ${r.status}`);
  return r.json();
}

  const [manifest, bodies, observations, sequences, sightlines, trails] =
    await Promise.all([
      json<Manifest>("manifest.json"),
      json<Body[]>("bodies.json"),
      json<Observation[]>("observations.json"),
      json<Sequence[]>("comparisons.json"),
      json<Record<string, Sightline>>("sightlines.json"),
      json<Record<string, ImageTrail>>("trails.json"),
    ]);
  lifecycle.signal.throwIfAborted();
  for (const o of [...observations, ...sequences.flatMap((s) => s.frames)])
    if (o.image) {
      o.image.calibration = sightlines[o.image.path];
      o.image.trail = trails[o.image.path];
    }
  const asteroids = bodies.filter((b) => b.kind === "asteroid");
  const initial = initialBody(bodies, options.target);
  if (!initial) throw Error(options.target ? `선택한 대상 ${options.target}의 3D 자료가 이 묶음에 없습니다. 분석 결과는 연구 탭에서 확인하고 새 3D 자료를 생성할 수 있습니다.` : "이 묶음에 소행성 궤도가 없습니다.");
  let selected = initial.id,
    playing = false,
    mjd = manifest.start,
    speed = 10,
    observation: Observation | undefined,
    mode = "system";
  app.innerHTML = ` <main><aside class="catalog"><div class="eyebrow">SOLAR SYSTEM EXPLORER</div><h1>궤도에서<br>관측으로.</h1><p class="intro">작은 암석이 지나간 자리.<br>태양계의 움직임을 실제 사진과 잇습니다.</p><label class="search"><span>⌕</span><input id="search" placeholder="소행성 이름 검색" aria-label="소행성 이름 검색"></label><div class="list-head">소행성 <span>${asteroids.length} OBJECTS</span></div><div id="objects" role="list"></div><div class="catalog-foot"><i class="mint-dot"></i> JPL Horizons 궤도<br><span>위치 · 시간 · 이름만 사용</span></div></aside>
 <section class="universe"><div id="scene"></div><div id="observer-tools" hidden><div class="photo-controls"><label><input id="photo-visible" type="checkbox" checked> 관측 사진 켜기</label><label>사진 투명도 <input id="photo-opacity" type="range" aria-label="관측 사진 투명도" min="0" max="1" step=".05" value=".65"></label><button data-view="free">이전 자유 시점</button></div><span id="sky-label"></span></div><div class="scene-top"><div><div class="eyebrow">HELIOCENTRIC / AU</div><h2 id="target-name"></h2><span id="target-sub">선택한 천체의 관측 기간 이동 경로</span></div><div class="view-switch"><button data-view="system" class="active">태양계</button><button data-view="target">따라가기</button><button data-view="observer">SPHEREx 시점</button></div></div><div class="compass"><span>Z ↑</span><span>황도 J2000</span></div><div class="scene-bottom"><span id="scene-caption">드래그 회전 · 스크롤 확대 · 암석 클릭 선택</span><label><input id="low" type="checkbox"> 저전력</label></div><div class="scale-note">옅은 선: 기준일 순간 궤도 · 밝은 선: JPL 시계열 경로 · 금색 점: 촬영 위치 · 크기는 설명용</div></section>
 <aside class="compare"><div class="eyebrow">THROUGH SPHEREX</div><div class="panel-title"><h2>관측의 순간</h2><span class="badge">REAL IMAGE</span></div><p class="panel-desc">별 배경은 같은 좌표에. 소행성의 이동은 사진 위에.</p><div class="image-wrap"><canvas id="image" aria-label="SPHEREx 실제 영상과 예측 위치"></canvas><span class="image-corner">SPHEREx / IRSA</span></div><p id="image-status" role="status"></p><label class="trail-toggle"><input id="show-trail" type="checkbox" checked> 촬영별 이동 흔적 표시</label><div class="trail-legend"><span>○ 이전 촬영</span><span>◎ 현재 촬영</span><span>○ 다음 촬영</span></div><p id="trail-note"></p><div class="compare-modes"><button data-composite="photo">실제 사진</button><button data-composite="model">모형만</button><button data-composite="blend" class="active">겹쳐보기</button></div><div class="overlay-control"><label for="overlay">모형 겹침 강도</label><input id="overlay" type="range" min="0" max="1" step=".05" value=".65"></div><div class="legend"><span class="prediction">민트 · JPL 위치 + ePSF 모형</span></div><button id="sequence-play">▶ 고정 하늘 재생</button><p id="sequence-note"></p><div id="obs-detail"></div><details class="availability"><summary>전체 관측의 품질과 미준비 사유</summary><div id="availability"></div></details><label class="obs-label" for="observation">준비된 촬영 선택</label><select id="observation"></select><div class="step-buttons"><button id="prev">← 이전 촬영</button><button id="next">다음 촬영 →</button></div><a id="source" target="_blank" rel="noopener noreferrer">원본 FITS ↗</a><p class="science-note">같은 별이 같은 픽셀에 오도록 실제 촬영들을 정합했습니다. 파장·잡음 때문에 밝기는 달라질 수 있습니다. 모형은 JPL 예측 위치에 장비의 ePSF를 적용하며 밝기만 사진에 맞춥니다. 암석 표면이나 독립적인 검출 확정을 뜻하지 않습니다.</p></aside></main>
 <footer><div class="transport"><button id="play" aria-label="재생">▶</button><div><span class="eyebrow">SIMULATION TIME · UTC</span><strong id="clock"></strong></div><select id="speed" aria-label="재생 속도"><option value="1">1일 / 초</option><option value="10" selected>10일 / 초</option><option value="30">30일 / 초</option></select></div><div class="timeline"><div class="timeline-labels"><span id="range-start">${date(manifest.start).slice(0, 10)}</span><span id="time-note">연속 궤도 재생 · 사진은 촬영 시각에 고정</span><span id="range-end">${date(manifest.end).slice(0, 10)}</span></div><input id="time" aria-label="시뮬레이션 날짜" type="range" min="${manifest.start}" max="${manifest.end}" step=".000001"><div id="ticks"></div></div></footer><div id="toast" role="status" hidden></div>`;
  const el = <T extends HTMLElement>(s: string) =>
    app.querySelector<T>(s)!;
  const scene = new SolarScene(el("#scene"), bodies),
    viewer = new ObservationViewer(el("#image"), el("#image-status"), options.dataBase);
  const clock = el("#clock"),
    slider = el<HTMLInputElement>("#time"),
    select = el<HTMLSelectElement>("#observation");

  const sequence = () => sequences.find((s) => s.objectId === selected);
  const ready = () =>
    sequence()?.frames ??
    observations.filter((o) => o.objectId === selected && o.image);
  let sequencePlaying = false,
    sequenceTimer = 0,
    sequenceGeneration = 0,
    observationGeneration = 0,
    intentGeneration = 0;
  let hasSelected = false, suspended = false, resumePlaying = false, resumeSequence = false;
  function transportState() {
    const running = playing || sequencePlaying;
    el("#play").textContent = running ? "Ⅱ" : "▶";
    el("#play").setAttribute("aria-label", running ? "일시정지" : "재생");
  }
  function stopSequence() {
    if (sequencePlaying) {
      ++observationGeneration;
      viewer.cancelPending();
      select.value = String(
        Math.max(
          0,
          ready().findIndex((o) => o.id === observation?.id),
        ),
      );
      if (mode === "observer") slider.value = select.value;
    }
    sequencePlaying = false;
    ++sequenceGeneration;
    clearTimeout(sequenceTimer);
    el("#sequence-play").textContent = "▶ 고정 하늘 재생";
    transportState();
  }
  async function toggleSequence() {
    if (sequencePlaying) {
      stopSequence();
      return;
    }
    if (!sequence()) return;
    setPlaying(false);
    const entering = mode !== "observer";
    if (entering) setView("observer");
    sequencePlaying = true;
    const generation = ++sequenceGeneration;
    el("#sequence-play").textContent = "Ⅱ 관측 재생 멈춤";
    transportState();
    const advance = async () => {
      if (generation !== sequenceGeneration || document.hidden) return;
      await showObservation((Number(select.value) + 1) % ready().length);
      if (generation === sequenceGeneration)
        sequenceTimer = window.setTimeout(advance, 750);
    };
    sequenceTimer = window.setTimeout(
      advance,
      entering || scene.metrics().flying ? 1300 : 750,
    );
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopSequence();
  }, {signal:lifecycle.signal});
  function setPlaying(v: boolean) {
    if (v) {
      ++intentGeneration;
      stopSequence();
    }
    playing = v;
    transportState();
    scene.setPlaying(v);
  }
  let lastClock = 0;
  function setTime(t: number) {
    mjd = Math.max(manifest.start, Math.min(manifest.end, t));
    scene.setTime(mjd);
    slider.value = mode === "observer" ? select.value : String(mjd);
    if (performance.now() - lastClock > 100 || !playing) {
      clock.textContent = date(mjd);
      lastClock = performance.now();
    }
    const note =
      observation && Math.abs(mjd - observation.mjd) < 0.00001
        ? "촬영 시각과 시뮬레이션 시각 일치"
        : "연속 궤도 재생 · 오른쪽 사진은 촬영 시각에 고정";
    if (el("#time-note").textContent !== note)
      el("#time-note").textContent = note;
  }
  function setView(v: string) {
    if (
      v === "observer" &&
      !(observation?.spacecraft && observation.image?.calibration)
    ) {
      const toast = el("#toast");
      toast.hidden = false;
      toast.textContent =
        "이 대상의 SPHEREx 관측 시점은 아직 준비되지 않았습니다.";
      return;
    }
    el("#toast").hidden = true;
    if (v !== "observer") stopSequence();
    mode = v;
    const items = ready(),
      isSky = v === "observer";
    slider.min = String(isSky ? 0 : manifest.start);
    slider.max = String(isSky ? Math.max(0, items.length - 1) : manifest.end);
    slider.step = isSky ? "1" : ".000001";
    slider.setAttribute(
      "aria-label",
      isSky ? "관측 프레임" : "시뮬레이션 날짜",
    );
    el<HTMLSelectElement>("#speed").disabled = isSky;
    el("#range-start").textContent = date(
      isSky && items.length ? items[0].mjd : manifest.start,
    ).slice(0, isSky ? 19 : 10);
    el("#range-end").textContent = date(
      isSky && items.length ? items.at(-1)!.mjd : manifest.end,
    ).slice(0, isSky ? 19 : 10);
    el("#ticks").hidden = isSky;
    slider.value = isSky ? select.value : String(mjd);
    el(".universe").classList.toggle("observing", v === "observer");
    el("#observer-tools").hidden = v !== "observer";
    document
      .querySelectorAll("[data-view]")
      .forEach((b) =>
        b.classList.toggle("active", b.getAttribute("data-view") === v),
      );
    if (v === "observer" && observation) {
      setPlaying(false);
      setTime(observation.mjd);
    }
    scene.view(v as "system" | "target" | "observer" | "free");
    el("#scene-caption").textContent =
      v === "observer"
        ? "실제 SPHEREx 위치 · 영상 WCS 시야 · 사진을 꺼도 같은 3D 시점 유지"
        : "드래그 회전 · 스크롤 확대 · 암석 클릭 선택";
  }
  async function showObservation(index: number) {
    const generation = ++observationGeneration,
      intent = intentGeneration;
    setPlaying(false);
    const items = ready();
    if (!items.length) {
      viewer.clear();
      el("#trail-note").textContent =
        "준비된 사진이 없어 이동 흔적을 표시할 수 없습니다.";
      observation = undefined;
      scene.setObservation(undefined);
      select.disabled = true;
      el("#obs-detail").textContent =
        "준비된 영상이 없습니다. 궤도 재생은 가능합니다.";
      el<HTMLAnchorElement>("#source").removeAttribute("href");
      return;
    }
    index = Math.max(0, Math.min(items.length - 1, index));
    const nextObservation = items[index];
    select.value = String(index);
    if (
      !(await viewer.show(nextObservation)) ||
      generation !== observationGeneration
    )
      return;
    await scene.ready();
    if (generation !== observationGeneration) return;
    observation = nextObservation;
    scene.setObservation(observation, viewer.photoCanvas, viewer.trailCanvas);
    el("#trail-note").textContent = trailDescription(observation.image?.trail);
    select.disabled = false;
    if (intent === intentGeneration) setTime(observation.mjd);
    el<HTMLButtonElement>("[data-view=observer]").disabled = !(
      observation.spacecraft && observation.image?.calibration
    );
    el("#sky-label").textContent =
      `${date(observation.mjd)} UTC · ${index + 1} / ${items.length} · ${sequence() ? "고정 하늘" : "개별 촬영"}`;
    const o = observation;
    el("#obs-detail").innerHTML =
      `<dl><dt>촬영 시각 UTC</dt><dd>${date(o.mjd)}</dd><dt>검출기 / 파장</dt><dd>D${o.detector} / ${o.wavelength?.toFixed(2) ?? "—"} μm</dd><dt>적경 / 적위</dt><dd>${o.ra.toFixed(4)}° / ${o.dec.toFixed(4)}°</dd><dt>측광 품질 / SNR</dt><dd>${o.quality} / ${o.snr?.toFixed(1) ?? "—"}</dd><dt>모형 적합 χ²/자유도</dt><dd>${o.image?.model?.chi2Reduced.toFixed(2) ?? "미준비"}</dd></dl>`;
    el<HTMLAnchorElement>("#source").href = o.url;
  }
  function choose(id: string) {
    const body = initialBody(bodies, id);
    if (!body) return false;
    id = body.id;
    if (hasSelected && selected === id) return true;
    hasSelected = true;
    const resetView = mode !== "system";
    stopSequence();
    viewer.clear();
    observation = undefined;
    scene.setObservation(undefined);
    el("#obs-detail").textContent = "관측 영상을 준비하는 중…";
    el("#trail-note").textContent = "관측 영상을 준비하는 중…";
    el<HTMLAnchorElement>("#source").removeAttribute("href");
    selected = id;
    options.onTarget(id);
    scene.setSelected(id);
    if (resetView) setView("system");
    el("#target-name").textContent = body.name;
    document
      .querySelectorAll("[data-object]")
      .forEach((b) =>
        b.classList.toggle("selected", b.getAttribute("data-object") === id),
      );
    const all = observations.filter((o) => o.objectId === id);
    const counts = new Map<string, number>();
    for (const o of all) {
      const key = o.image
        ? "영상 준비 · " + o.quality
        : (o.availabilityReason ?? "영상 미준비 · " + o.quality);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const availability = el("#availability");
    availability.replaceChildren();
    for (const [reason, count] of counts) {
      const p = document.createElement("p");
      p.textContent = reason + " — " + count + "행";
      availability.append(p);
    }
    const items = ready();
    el<HTMLInputElement>("#show-trail").disabled = !items.length;
    el(".trail-legend").hidden = !items.length;
    el<HTMLButtonElement>("#sequence-play").disabled = !sequence();
    el("#sequence-note").textContent = sequence()
      ? `${items.length}장 · 0.75초/장 · 실제 시간 범위 ${Math.round((items.at(-1)!.mjd - items[0].mjd) * 1440)}분`
      : "공통 하늘 연속 영상 미준비 · 개별 촬영만 표시";
    document
      .querySelectorAll<HTMLButtonElement>("[data-composite]")
      .forEach(
        (b) => (b.disabled = b.dataset.composite !== "photo" && !sequence()),
      );
    setComposite(sequence() ? "blend" : "photo");
    el<HTMLInputElement>("#overlay").disabled = !sequence();
    el(".legend").hidden = !sequence();
    el(".science-note").textContent = sequence()
      ? "같은 별이 같은 픽셀에 오도록 실제 촬영들을 정합했습니다. 파장·잡음 때문에 밝기는 달라질 수 있습니다. 모형은 JPL 예측 위치에 장비의 ePSF를 적용하며 밝기만 사진에 맞춥니다. 암석 표면이나 독립적인 검출 확정을 뜻하지 않습니다."
      : "개별 촬영입니다. 이 대상의 공통 하늘 정합과 ePSF 모형은 아직 준비되지 않아 실제 사진만 표시합니다.";
    scene.setObservationTimes(items.map((o) => o.mjd));
    el<HTMLButtonElement>("[data-view=observer]").disabled = true;
    el<HTMLButtonElement>("#prev").disabled = !items.length;
    el<HTMLButtonElement>("#next").disabled = !items.length;
    select.innerHTML = items
      .map(
        (o, i) =>
          `<option value="${i}">${date(o.mjd)} · D${o.detector}</option>`,
      )
      .join("");
    el("#target-sub").textContent =
      `${observations.filter((o) => o.objectId === id).length}개 관측 행 · ${items.length}장 ${sequence() ? "고정 하늘 정합" : "개별 영상"}`;
    el("#ticks").innerHTML = items
      .map(
        (o, i) =>
          `<button title="${date(o.mjd)} UTC" aria-label="촬영 ${i + 1}" data-tick="${i}" style="left:${((o.mjd - manifest.start) / (manifest.end - manifest.start)) * 100}%"></button>`,
      )
      .join("");
    el("#ticks")
      .querySelectorAll<HTMLElement>("[data-tick]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            stopSequence();
            void showObservation(Number(b.dataset.tick));
          }),
      );
    showObservation(0);
    scene.setTime(mjd);
    return true;
  }
  function list(query = "") {
    el("#objects").innerHTML = asteroids
      .filter((b) => b.name.toLowerCase().includes(query.toLowerCase()))
      .map(
        (b, i) =>
          `<button role="listitem" data-object="${b.id}" class="object ${b.id === selected ? "selected" : ""}"><span class="rock-icon rock-${i % 4}"></span><span>${b.name}<small>${readyCount(b.id)} 관측 이미지</small></span><span class="object-arrow">↗</span></button>`,
      )
      .join("");
    el("#objects")
      .querySelectorAll<HTMLElement>("[data-object]")
      .forEach((b) => (b.onclick = () => choose(b.dataset.object!)));
  }
  function readyCount(id: string) {
    return (
      sequences.find((s) => s.objectId === id)?.frames.length ??
      observations.filter((o) => o.objectId === id && o.image).length
    );
  }
  el<HTMLInputElement>("#search").oninput = (e) =>
    list((e.target as HTMLInputElement).value);
  el("#play").onclick = () => {
    if (mode === "observer" && sequence()) {
      void toggleSequence();
      return;
    }
    if (mjd >= manifest.end) setTime(manifest.start);
    if (mode === "observer") setView("system");
    setPlaying(!playing);
  };
  el<HTMLSelectElement>("#speed").onchange = (e) =>
    (speed = Number((e.target as HTMLSelectElement).value));
  slider.oninput = () => {
    ++intentGeneration;
    stopSequence();
    if (mode === "observer") {
      void showObservation(Number(slider.value));
      return;
    }
    setPlaying(false);
    if (mode === "observer") setView("system");
    setTime(Number(slider.value));
  };
  select.onchange = () => {
    stopSequence();
    void showObservation(Number(select.value));
  };
  el("#prev").onclick = () => {
    stopSequence();
    void showObservation(Number(select.value) - 1);
  };
  el("#next").onclick = () => {
    stopSequence();
    void showObservation(Number(select.value) + 1);
  };
  el<HTMLInputElement>("#overlay").oninput = (e) =>
    viewer.setOpacity(Number((e.target as HTMLInputElement).value));
  el<HTMLInputElement>("#low").onchange = (e) =>
    scene.quality((e.target as HTMLInputElement).checked);
  document
    .querySelectorAll<HTMLElement>("[data-view]")
    .forEach((b) => (b.onclick = () => setView(b.dataset.view!)));
  el<HTMLInputElement>("#photo-visible").onchange = (e) =>
    scene.setPhotoVisible((e.target as HTMLInputElement).checked);
  el<HTMLInputElement>("#photo-opacity").oninput = (e) =>
    scene.setPhotoOpacity(Number((e.target as HTMLInputElement).value));
  el("#sequence-play").onclick = () => {
    void toggleSequence();
  };
  function setComposite(value: "photo" | "model" | "blend") {
    viewer.setMode(value);
    document
      .querySelectorAll<HTMLElement>("[data-composite]")
      .forEach((c) =>
        c.classList.toggle("active", c.dataset.composite === value),
      );
  }
  document
    .querySelectorAll<HTMLElement>("[data-composite]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          setComposite(b.dataset.composite as "photo" | "model" | "blend")),
    );
  el<HTMLInputElement>("#show-trail").onchange = (e) => {
    const v = (e.target as HTMLInputElement).checked;
    viewer.setTrailVisible(v);
    scene.setTrailVisible(v);
  };
  scene.onSelect = choose;
  scene.onTick = (dt) => {
    setTime(mjd + dt * speed);
    if (mjd >= manifest.end) setPlaying(false);
  };
  scene.onError = (message) => {
    const toast = el("#toast");
    toast.hidden = false;
    toast.textContent = message;
    setPlaying(false);
  };
  list();
  setTime(manifest.start);
  choose(initial.id);
  (window as unknown as { __app: unknown }).__app = {
    metrics: () => ({
      ...scene.metrics(),
      ...viewer.metrics(),
      mjd,
      playing,
      selected,
      sequencePlaying,
      frameCount: ready().length,
    }),
    choose,
    showObservation,
    setView,
    setPlaying,
  };
  return {
    choose,
    setActive(active: boolean) {
      if(!active&&!suspended){resumePlaying=playing;resumeSequence=sequencePlaying;suspended=true;stopSequence();setPlaying(false);viewer.cancelPending();}
      scene.setActive(active);
      if(active&&suspended){suspended=false;if(resumeSequence)void toggleSequence();else if(resumePlaying)setPlaying(true);}
    },
    dispose() { lifecycle.abort();stopSequence();scene.dispose();viewer.dispose();app.replaceChildren(); },
  };
}
