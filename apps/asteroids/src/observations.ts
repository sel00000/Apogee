import { LocalError, bindText, onLang, t } from "./i18n";
import type { Observation } from "./types";
import { currentPoint, drawTrail, visibleTrail } from "./trails";
export async function fetchImage(
  url: string,
  signal: AbortSignal,
): Promise<Blob> {
  for (let attempt = 0; attempt < 3; attempt++) {
    signal.throwIfAborted();
    try {
      const r = await fetch(url, { signal });
      if (!r.ok) throw new LocalError("v.httpStatus", { s: r.status });
      return await r.blob();
    } catch (error) {
      if (signal.aborted || attempt === 2) throw error;
      await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
    }
  }
  throw new LocalError("v.noResponse");
}
/** One bitmap atlas per frame; bounded cache; stale responses never replace the selection. */
export class ObservationViewer {
  private unbindLanguage: () => void;
  private cache = new Map<string, ImageBitmap>();
  private generation = 0;
  private controller: AbortController | null = null;
  private current: Observation | null = null;
  private bitmap: ImageBitmap | null = null;
  private processing: "original" | "corrected" = "corrected";
  setProcessing(value: "original" | "corrected") { this.processing = value; this.draw(); }
  private alpha = 0.65;
  private mode: "photo" | "model" | "blend" = "blend";
  private trailEnabled = true;
  /** current ring slides from the previous exposure of the same fixed-sky sequence */
  private glide: { from: { x: number; y: number }; to: { x: number; y: number }; start: number } | null = null;
  private glideFrame = 0;
  onRedraw: () => void = () => {};
  readonly trailCanvas = document.createElement("canvas");
  readonly photoCanvas = document.createElement("canvas");
  private modelCanvas = document.createElement("canvas");
  constructor(
    private canvas: HTMLCanvasElement,
    private status: HTMLElement,
    private dataBase = new URL("./data/", location.href).href,
  ) {
    this.trailCanvas.width = this.trailCanvas.height = 512;
    this.canvas.width = this.canvas.height = 512;
    this.modelCanvas.width = this.modelCanvas.height = 512;
    this.unbindLanguage = onLang(() => { this.draw(); this.onRedraw(); });
  }
  setTrailVisible(v: boolean) {
    this.trailEnabled = v;
    this.draw();
  }
  setOpacity(v: number) {
    this.alpha = v;
    this.draw();
  }
  setMode(mode: "photo" | "model" | "blend") {
    this.mode = mode;
    this.draw();
  }
  async show(obs: Observation) {
    const generation = ++this.generation;
    this.controller?.abort();
    if (!obs.image) {
      this.clear();
      return false;
    }
    const key = obs.image.correction?.path ?? obs.image.path;
    bindText(this.status, () => t("v.opening"));
    try {
      let bitmap = this.cache.get(key);
      if (bitmap) {
        this.cache.delete(key);
        this.cache.set(key, bitmap);
      } else {
        this.controller = new AbortController();
        bitmap = await createImageBitmap(
          await fetchImage(new URL(key, this.dataBase).href, this.controller.signal),
        );
        if (generation !== this.generation) {
          bitmap.close();
          return false;
        }
        this.cache.set(key, bitmap);
        while (this.cache.size > 8) {
          const oldest = this.cache.keys().next().value!;
          this.cache.get(oldest)!.close();
          this.cache.delete(oldest);
        }
      }
      if (generation !== this.generation) return false;
      const prev = this.current;
      const from = prev?.image && prev.sequenceId && prev.sequenceId === obs.sequenceId
        ? currentPoint(prev.image.trail, prev.image.width, prev.image.height) : null;
      const to = currentPoint(obs.image.trail, obs.image.width, obs.image.height);
      cancelAnimationFrame(this.glideFrame);
      this.glide = from && to && !matchMedia("(prefers-reduced-motion: reduce)").matches
        ? { from, to, start: performance.now() } : null;
      this.current = obs;
      this.bitmap = bitmap;
      const atlas = obs.image.atlas;
      bindText(this.status, () => t(atlas ? "v.atlas" : "v.single"));
      this.draw();
      return true;
    } catch (e) {
      if (generation !== this.generation) return false;
      cancelAnimationFrame(this.glideFrame); this.glide = null;
      this.current = null;
      this.bitmap = null;
      this.draw();
      bindText(this.status, () => t("v.failed"));
      return false;
    }
  }
  cancelPending() {
    cancelAnimationFrame(this.glideFrame); this.glide = null;
    ++this.generation;
    this.controller?.abort();
    const real = Boolean(this.current);
    bindText(this.status, () => t(real ? "v.pausedReal" : "v.paused"));
  }
  clear() {
    cancelAnimationFrame(this.glideFrame); this.glide = null;
    ++this.generation;
    this.controller?.abort();
    this.current = null;
    this.bitmap = null;
    this.draw();
    bindText(this.status, () => t("v.none"));
  }
  dispose() {
    this.unbindLanguage();
    cancelAnimationFrame(this.glideFrame); this.glide = null;
    this.controller?.abort();++this.generation;
    for(const bitmap of this.cache.values()) bitmap.close();
    this.cache.clear();this.current=null;this.bitmap=null;
  }
  private draw() {
    cancelAnimationFrame(this.glideFrame);
    const c = this.canvas,
      ctx = c.getContext("2d")!;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#080d15";
    ctx.fillRect(0, 0, 512, 512);
    if (this.bitmap && this.current?.image) {
      const im = this.current.image;
      ctx.imageSmoothingEnabled = false;
      if (this.mode !== "model" || !im.atlas)
        this.drawPhoto(ctx, 512, 512);
      if (im.atlas && this.mode !== "photo") {
        const mc = this.modelCanvas.getContext("2d")!;
        mc.imageSmoothingEnabled = false;
        mc.globalCompositeOperation = "source-over";
        mc.drawImage(
          this.bitmap,
          im.correction ? (this.processing === "original" ? 2 : 3) * im.width : im.width,
          0,
          im.width,
          im.height,
          0,
          0,
          512,
          512,
        );
        if (this.mode === "blend") {
          mc.globalCompositeOperation = "multiply";
          mc.fillStyle = "#78f5d4";
          mc.fillRect(0, 0, 512, 512);
          mc.globalCompositeOperation = "source-over";
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = this.alpha;
        }
        ctx.drawImage(this.modelCanvas, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    }
    const trailCtx = this.trailCanvas.getContext("2d")!;
    trailCtx.clearRect(0, 0, 512, 512);
    if (this.trailEnabled && this.bitmap && this.current?.image) {
      const im = this.current.image;
      let at: { x: number; y: number } | undefined;
      if (this.glide) {
        const u = Math.min(1, (performance.now() - this.glide.start) / 520), e = 1 - Math.pow(1 - u, 3);
        at = { x: this.glide.from.x + (this.glide.to.x - this.glide.from.x) * e, y: this.glide.from.y + (this.glide.to.y - this.glide.from.y) * e };
        if (u < 1) this.glideFrame = requestAnimationFrame(() => { this.draw(); this.onRedraw(); });
        else this.glide = null;
      }
      drawTrail(trailCtx, im.trail, im.width, im.height, 512, at);
      ctx.drawImage(this.trailCanvas, 0, 0);
    }

    const photo = this.photoCanvas;
    if (this.bitmap && this.current?.image) {
      const im = this.current.image;
      photo.width = im.width;
      photo.height = im.height;
      this.drawPhoto(photo.getContext("2d")!, im.width, im.height);
    } else {
      photo.getContext("2d")!.clearRect(0, 0, photo.width, photo.height);
    }
  }
  private drawPhoto(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const im = this.current!.image!;
    const offset = im.correction && this.processing !== "original" ? im.width : 0;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.bitmap!, offset, 0, im.width, im.height, 0, 0, width, height);
  }
  metrics() {
    return {
      processing: this.processing,
      cachedImages: this.cache.size,
      bytes: [...this.cache.values()].reduce(
        (n, b) => n + b.width * b.height * 4,
        0,
      ),
      observation: this.current?.id,
      compositeMode: this.mode,
      fixedSky: !!this.current?.image?.atlas,
      predicted: this.current?.image?.predicted,
      trailEnabled: this.trailEnabled,
      trailPoints: visibleTrail(this.current?.image?.trail),
      trailCurrent: this.current?.image?.trail?.currentId,
    };
  }
}
