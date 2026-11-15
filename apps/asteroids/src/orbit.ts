import { initialBody } from "./research-model";
import { SolarScene } from "./scene";
import { ObservationViewer } from "./observations";
import { date } from "./math";
import { LocalError, applyI18n, bindAttr, bindText, t } from "./i18n";
import type {
  Correction,
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

  const [manifest, bodies, observations, sequences, sightlines, trails, corrections] =
    await Promise.all([
      json<Manifest>("manifest.json"),
      json<Body[]>("bodies.json"),
      json<Observation[]>("observations.json"),
      json<Sequence[]>("comparisons.json"),
      json<Record<string, Sightline>>("sightlines.json"),
      json<Record<string, ImageTrail>>("trails.json"),
      // Prepared corrections belong to the bundled images, not arbitrary analysis jobs.
      options.dataBase === new URL("./data/", location.href).href
        ? json<Record<string, Correction>>("corrections.json").catch(error => { if (lifecycle.signal.aborted) throw error; return {} as Record<string, Correction>; })
        : Promise.resolve({} as Record<string, Correction>),
    ]);
  lifecycle.signal.throwIfAborted();
  for (const o of [...observations, ...sequences.flatMap((s) => s.frames)])
    if (o.image) {
      o.image.correction = corrections[o.image.path];
      o.image.calibration = sightlines[o.image.path];
      o.image.trail = trails[o.image.path];
    }
  const asteroids = bodies.filter((b) => b.kind === "asteroid");
  const initial = initialBody(bodies, options.target);
  if (!initial) throw options.target ? new LocalError("o.noTarget3d", { t: options.target }) : new LocalError("o.noAsteroids");
  let selected = initial.id,
    playing = false,
    mjd = manifest.start,
    speed = 10,
    observation: Observation | undefined,
    mode = "system";
  const isExposureView = (view = mode) => ["observer", "craft", "craft-only"].includes(view);
  app.innerHTML = `<main>
    <aside class="catalog">
      <div class="eyebrow">SOLAR SYSTEM EXPLORER</div><h1 data-i18n-html="o.title"></h1><p class="intro" data-i18n-html="o.intro"></p>
      <label class="search"><span>⌕</span><input id="search" data-i18n-ph="o.search" data-i18n-aria="o.search"></label>
      <div class="list-head"><bdi data-i18n="o.listHead"></bdi><span>${asteroids.length} OBJECTS</span></div><div id="objects" role="list"></div>
    </aside>
    <section class="universe">
      <div id="scene"></div><div class="sky-scrim" aria-hidden="true"></div>
      <div class="scene-top"><div><h2 id="target-name"></h2><div class="coordinates"><span><bdi data-i18n="o.ra"></bdi> <strong id="target-ra">—</strong></span><span><bdi data-i18n="o.dec"></bdi> <strong id="target-dec">—</strong></span></div></div>
        <div class="view-switch"><button data-view="system" class="active" data-i18n="o.viewSystem"></button><button data-view="target" data-i18n="o.viewTarget"></button><button data-view="craft" data-i18n="o.viewCraft"></button><button data-view="observer" data-i18n="o.viewObserver"></button></div>
      </div>
      <div class="scene-foot"><div id="observer-tools" hidden><div class="photo-controls">
        <label><input id="craft-visible" type="checkbox"><bdi data-i18n="o.showCraft"></bdi></label><button data-view="craft-only" data-i18n="o.craftOnly"></button><button data-view="free" data-i18n="o.freeView"></button>
      </div></div></div>
    </section>
    <aside class="compare">
      <div class="eyebrow">THROUGH SPHEREX</div><div class="panel-title"><h2 data-i18n="o.momentTitle"></h2><span class="badge">REAL IMAGE</span></div><p class="panel-desc" data-i18n="o.momentDesc"></p>
      <div class="image-wrap"><canvas id="image" data-i18n-aria="o.imageAria"></canvas><span class="image-corner">SPHEREx / IRSA</span></div><p id="image-status" class="orbit-sr-only" role="status"></p>
      <div class="compare-modes processing"><button data-processing="original" data-i18n="o.original"></button><button data-processing="corrected" class="active" data-i18n="o.corrected"></button></div>
      <label class="trail-toggle"><input id="show-trail" type="checkbox" checked><bdi data-i18n="o.showTrail"></bdi></label>
      <div class="compare-modes" role="group" data-i18n-aria="o.displayMode"><button data-display="photo" class="active" aria-pressed="true" data-i18n="o.compPhoto"></button><button data-display="model" aria-pressed="false" data-i18n="o.comp3d"></button></div>
      <button id="sequence-play"></button><label class="sequence-speed"><bdi data-i18n="o.sequenceSpeed"></bdi><select id="sequence-speed" data-i18n-aria="o.sequenceSpeed"><option value="750">1×</option><option value="375">2×</option><option value="250">3×</option><option value="150">5×</option></select></label>
      <label class="obs-label" for="observation" data-i18n="o.pickExposure"></label><select id="observation"></select><div class="step-buttons"><button id="prev" data-i18n="o.prev"></button><button id="next" data-i18n="o.next"></button></div>
      <a id="source" target="_blank" rel="noopener noreferrer" data-i18n="o.source"></a>
    </aside>
  </main>
  <footer><div class="transport"><button id="play">▶</button><div><span class="eyebrow">SIMULATION TIME · UTC</span><strong id="clock"></strong></div><select id="speed" data-i18n-aria="o.speed"><option value="1" data-i18n="o.speed1"></option><option value="10" selected data-i18n="o.speed10"></option><option value="30" data-i18n="o.speed30"></option></select></div><div class="timeline"><div class="timeline-labels"><span id="range-start">${date(manifest.start).slice(0, 10)}</span><span id="range-end">${date(manifest.end).slice(0, 10)}</span></div><input id="time" type="range" min="${manifest.start}" max="${manifest.end}" step=".000001"><div id="ticks"></div></div></footer><div id="toast" role="status" hidden></div>`;
  applyI18n(app);
  const el = <T extends HTMLElement>(s: string) =>
    app.querySelector<T>(s)!;
  bindText(el("#sequence-play"), () => t("o.seqPlay"));
  bindAttr(el("#time"), "aria-label", () => t("o.timeAria"));
  const scene = new SolarScene(el("#scene"), bodies),
    viewer = new ObservationViewer(el("#image"), el("#image-status"), options.dataBase);
  const clock = el("#clock"),
    slider = el<HTMLInputElement>("#time"),
    select = el<HTMLSelectElement>("#observation");

  const sequence = () => sequences.find((s) => s.objectId === selected);
  const ready = () =>
    sequence()?.frames ??
    observations.filter((o) => o.objectId === selected && o.image);
  let sequenceDelay = 750;
  let sequencePlaying = false,
    sequenceTimer = 0,
    sequenceGeneration = 0,
    observationGeneration = 0,
    intentGeneration = 0;
  let hasSelected = false, suspended = false, resumePlaying = false, resumeSequence = false;
  function transportState() {
    const running = playing || sequencePlaying;
    el("#play").textContent = running ? "Ⅱ" : "▶";
    bindAttr(el("#play"), "aria-label", () => t(running ? "o.pause" : "o.play"));
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
      if (isExposureView()) slider.value = select.value;
    }
    sequencePlaying = false;
    ++sequenceGeneration;
    clearTimeout(sequenceTimer);
    bindText(el("#sequence-play"), () => t("o.seqPlay"));
    transportState();
  }
  async function toggleSequence() {
    if (sequencePlaying) {
      stopSequence();
      return;
    }
    if (!sequence()) return;
    setPlaying(false);
    const entering = !isExposureView();
    if (entering) setView("observer");
    sequencePlaying = true;
    const generation = ++sequenceGeneration;
    bindText(el("#sequence-play"), () => t("o.seqStop"));
    transportState();
    const advance = async () => {
      if (generation !== sequenceGeneration || document.hidden) return;
      await showObservation((Number(select.value) + 1) % ready().length);
      if (generation === sequenceGeneration)
        sequenceTimer = window.setTimeout(advance, sequenceDelay);
    };
    sequenceTimer = window.setTimeout(
      advance,
      entering || scene.metrics().flying ? 3400 : sequenceDelay,
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
    slider.value = isExposureView() ? select.value : String(mjd);
    if (performance.now() - lastClock > 100 || !playing) {
      clock.textContent = date(mjd);
      lastClock = performance.now();
    }
  }

  function setView(v: string) {
    if (
      isExposureView(v) &&
      !(observation?.spacecraft && observation.image?.calibration)
    ) {
      const toast = el("#toast");
      toast.hidden = false;
      bindText(toast, () => t("o.observerNotReady"));
      return;
    }
    el("#toast").hidden = true;
    if (v !== mode) stopSequence();
    mode = v;
    const items = ready(),
      isSky = isExposureView(v);
    slider.min = String(isSky ? 0 : manifest.start);
    slider.max = String(isSky ? Math.max(0, items.length - 1) : manifest.end);
    slider.step = isSky ? "1" : ".000001";
    bindAttr(slider, "aria-label", () => t(isSky ? "o.frameAria" : "o.timeAria"));
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
    app
      .querySelectorAll("[data-view]")
      .forEach((b) =>
        b.classList.toggle("active", b.getAttribute("data-view") === v),
      );
    if (isExposureView(v) && observation) {
      setPlaying(false);
      setTime(observation.mjd);
    }
    scene.view(v as "system" | "target" | "observer" | "free" | "craft" | "craft-only");
  }
  async function showObservation(index: number) {
    const generation = ++observationGeneration,
      intent = intentGeneration;
    setPlaying(false);
    const items = ready();
    if (!items.length) {
      viewer.clear();
      observation = undefined;
      scene.setObservation(undefined);
      select.disabled = true;
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
    const correction = observation.image?.correction;
    el<HTMLButtonElement>('[data-processing="corrected"]').disabled = !correction;
    select.disabled = false;
    if (intent === intentGeneration) setTime(observation.mjd);
    el<HTMLButtonElement>("[data-view=observer]").disabled = !(
      observation.spacecraft && observation.image?.calibration
    );
    el<HTMLButtonElement>("[data-view=craft]").disabled = el<HTMLButtonElement>("[data-view=observer]").disabled;
    const calibrated = Boolean(observation.spacecraft && observation.image?.calibration);
    el<HTMLButtonElement>('[data-view="craft-only"]').disabled = !calibrated;
    app.querySelectorAll<HTMLButtonElement>("[data-display]").forEach(button => button.disabled = !calibrated);
    el("#target-ra").textContent = `${observation.ra.toFixed(4)}°`;
    el("#target-dec").textContent = `${observation.dec.toFixed(4)}°`;
    el<HTMLAnchorElement>("#source").href = observation.url;
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
    el<HTMLAnchorElement>("#source").removeAttribute("href");
    selected = id;
    options.onTarget(id);
    scene.setSelected(id);
    if (resetView) setView("system");
    el("#target-name").textContent = body.name;
    el("#target-ra").textContent = el("#target-dec").textContent = "—";
    app
      .querySelectorAll("[data-object]")
      .forEach((b) =>
        b.classList.toggle("selected", b.getAttribute("data-object") === id),
      );
    const items = ready();
    el<HTMLInputElement>("#show-trail").disabled = !items.length;
    el<HTMLButtonElement>("#sequence-play").disabled = !sequence();
    el<HTMLSelectElement>("#sequence-speed").disabled = !sequence();
    app.querySelectorAll<HTMLButtonElement>("[data-display]").forEach(button => button.disabled = true);
    setDisplay("photo");
    scene.setObservationTimes(items.map((o) => o.mjd));
    el<HTMLButtonElement>("[data-view=observer]").disabled = true;
    el<HTMLButtonElement>("[data-view=craft]").disabled = true;
    el<HTMLButtonElement>('[data-processing="corrected"]').disabled = true;
    el<HTMLButtonElement>('[data-view="craft-only"]').disabled = true;
    el<HTMLButtonElement>("#prev").disabled = !items.length;
    el<HTMLButtonElement>("#next").disabled = !items.length;
    select.innerHTML = items
      .map(
        (o, i) =>
          `<option value="${i}">${date(o.mjd)} · D${o.detector}</option>`,
      )
      .join("");
    el("#ticks").innerHTML = items
      .map(
        (o, i) =>
          `<button title="${date(o.mjd)} UTC" data-tick="${i}" style="left:${((o.mjd - manifest.start) / (manifest.end - manifest.start)) * 100}%"></button>`,
      )
      .join("");
    el("#ticks")
      .querySelectorAll<HTMLElement>("[data-tick]")
      .forEach(
        (b) =>
          (bindAttr(b, "aria-label", () => t("o.tick", { i: Number(b.dataset.tick) + 1 })), b.onclick = () => {
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
          `<button role="listitem" data-object="${b.id}" class="object ${b.id === selected ? "selected" : ""}"><span class="rock-icon rock-${i % 4}"></span><span>${b.name}<small data-count="${readyCount(b.id)}"></small></span><span class="object-arrow">↗</span></button>`,
      )
      .join("");
    el("#objects")
      .querySelectorAll<HTMLElement>("[data-object]")
      .forEach((b) => (b.onclick = () => choose(b.dataset.object!)));
    el("#objects")
      .querySelectorAll<HTMLElement>("[data-count]")
      .forEach((s) => bindText(s, () => t("o.listCount", { n: s.dataset.count! })));
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
    if (isExposureView() && sequence()) {
      void toggleSequence();
      return;
    }
    if (mjd >= manifest.end) setTime(manifest.start);
    if (isExposureView()) setView("system");
    setPlaying(!playing);
  };
  el<HTMLSelectElement>("#speed").onchange = (e) =>
    (speed = Number((e.target as HTMLSelectElement).value));
  slider.oninput = () => {
    ++intentGeneration;
    stopSequence();
    if (isExposureView()) {
      void showObservation(Number(slider.value));
      return;
    }
    setPlaying(false);
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
  scene.onSky = shown => el(".universe").classList.toggle("sky-on", shown);
  scene.setSky(true);
  app
    .querySelectorAll<HTMLElement>("[data-view]")
    .forEach((b) => (b.onclick = () => setView(b.dataset.view!)));
  el<HTMLInputElement>("#craft-visible").onchange = e =>
    scene.setCraftVisible((e.target as HTMLInputElement).checked);
  scene.setPhotoOpacity(1);
  viewer.setMode("photo");
  el("#sequence-play").onclick = () => {
    void toggleSequence();
  };
  function setDisplay(value: "photo" | "model") {
    // Switch the real image plane in the 3D scene, never the ePSF prediction image.
    scene.setPhotoVisible(value === "photo");
    app.querySelectorAll<HTMLElement>("[data-display]").forEach(button => {
      const active = button.dataset.display === value;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  app.querySelectorAll<HTMLElement>("[data-display]").forEach(button => {
    button.onclick = () => {
      if (mode !== "observer") setView("observer");
      setDisplay(button.dataset.display as "photo" | "model");
    };
  });
  el<HTMLInputElement>("#show-trail").onchange = (e) => {
    const v = (e.target as HTMLInputElement).checked;
    viewer.setTrailVisible(v);
    scene.setTrailVisible(v);
  };
  viewer.onRedraw = () => scene.refreshTrail();
  el<HTMLSelectElement>("#sequence-speed").onchange = e => {
    sequenceDelay = Number((e.target as HTMLSelectElement).value);
  };
  app.querySelectorAll<HTMLElement>("[data-processing]").forEach(b => {
    b.onclick = () => {
      viewer.setProcessing(b.dataset.processing as "original" | "corrected");
      app.querySelectorAll<HTMLElement>("[data-processing]").forEach(c => c.classList.toggle("active", c === b));
      scene.refreshObservationPhoto(viewer.photoCanvas);
    };
  });
  scene.onSelect = choose;
  scene.onTick = (dt) => {
    setTime(mjd + dt * speed);
    if (mjd >= manifest.end) setPlaying(false);
  };
  scene.onError = (message) => {
    const toast = el("#toast");
    toast.hidden = false;
    bindText(toast, message);
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
      sequenceDelay,
      frameCount: ready().length,
    }),
    choose,
    showObservation,
    setView,
    setPlaying,
    debugSkyDim: (value: number, black?: number, soften?: number) => scene.debugSkyDim(value, black, soften),
    debugCamera: (position: number[], target: number[]) =>
      scene.debugCamera(position, target),
  };
  return {
    choose,
    setActive(active: boolean) {
      if(!active&&!suspended){resumePlaying=playing;resumeSequence=sequencePlaying;suspended=true;stopSequence();setPlaying(false);viewer.cancelPending();}
      scene.setActive(active);
      if(active&&suspended){suspended=false;if(resumeSequence)void toggleSequence();else if(resumePlaying)setPlaying(true);else if(!observation&&ready().length)void showObservation(Number(select.value)||0);}
    },
    dispose() { lifecycle.abort();stopSequence();scene.dispose();viewer.dispose();app.replaceChildren(); },
  };
}
