import { useEffect, useRef, useState, type RefObject } from 'react';
import { ROUTE_CURVE } from './springs';
import {
  colorsIn,
  lightness,
  meanColor,
  nextTone,
  over,
  parseHex,
  parseRgb,
  type RGBA,
  type Tone,
  type ToneSetting,
} from './tone';

/**
 * Reads what is under the bar and says whether it is light or dark. A page's
 * pixels cannot be read directly, so the sampler asks the DOM what is painted
 * at a handful of points under the pill and the circles — background colours,
 * gradients averaged from their stops, same-origin images through a canvas —
 * composites them top to bottom, and takes the mean lightness. Sampling runs
 * on scroll and resize, on mode changes, and on a slow timer for everything
 * else (a screen fading in, an image finishing its load).
 */

const WHITE: RGBA = { r: 1, g: 1, b: 1, a: 1 };
const CLEAR: RGBA = { r: 0, g: 0, b: 0, a: 0 };
/** Images are read at this resolution; tone needs no more. */
const THUMB = 24;
/** Where each shape is sampled, as fractions of its box. */
const COLUMNS = [0.1, 0.3, 0.5, 0.7, 0.9];
const ROWS = [0.35, 0.65];
const TIMER_MS = 700;
/**
 * The least time between two samples. A scroll fired one every frame: a dozen
 * elementsFromPoint and getComputedStyle reads in each, on the frames a long
 * list was being flung through, where an old phone had none to spare. A tone
 * changes as a section passes under the bar, which a fifth of a second catches.
 */
const MIN_GAP_MS = 200;

let scratch: CanvasRenderingContext2D | null | undefined;
const colorCache = new Map<string, RGBA | null>();
/** A colour no page is likely to paint, to tell a rejected value from a real one. */
const SENTINEL = '#010203';

/**
 * Any CSS colour a computed style can hand back. The rgb() and hex forms are
 * parsed; anything else (oklab, color-mix…) is painted into a one-pixel
 * canvas and read back as a pixel, which every engine agrees on — the
 * `fillStyle` getter's string form is where they differ.
 */
function toRgba(css: string): RGBA | null {
  const hit = colorCache.get(css);
  if (hit !== undefined) return hit;
  let out = parseRgb(css) ?? parseHex(css);
  if (!out && css !== 'none' && css !== SENTINEL) {
    if (scratch === undefined) {
      scratch = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      if (scratch) {
        scratch.canvas.width = 1;
        scratch.canvas.height = 1;
        scratch.globalCompositeOperation = 'copy';
      }
    }
    if (scratch) {
      // A value the canvas rejects leaves the previous one in place, hence the sentinel.
      scratch.fillStyle = SENTINEL;
      scratch.fillStyle = css;
      scratch.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = scratch.getImageData(0, 0, 1, 1).data;
      if (!(r === 1 && g === 2 && b === 3 && a === 255)) out = { r: r / 255, g: g / 255, b: b / 255, a: a / 255 };
    }
  }
  if (colorCache.size > 500) colorCache.clear();
  colorCache.set(css, out ?? null);
  return out ?? null;
}

const thumbs = new Map<string, ImageData | null>();
const pendingThumbs = new Set<string>();

/** An image drawn down to THUMB square and read back, or null when the canvas is tainted. */
function readThumb(source: CanvasImageSource): ImageData | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = THUMB;
    canvas.height = THUMB;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, THUMB, THUMB);
    return ctx.getImageData(0, 0, THUMB, THUMB);
  } catch {
    // Cross-origin without CORS: the canvas is tainted and will not say.
    return null;
  }
}

function keepThumb(key: string, data: ImageData | null) {
  if (thumbs.size > 100) thumbs.clear();
  thumbs.set(key, data);
}

/** The image's colour at a point, or undefined when it cannot be read (tainted, not loaded, still shrinking). */
function imageColor(img: HTMLImageElement, x: number, y: number): RGBA | undefined {
  if (!img.complete || !img.naturalWidth) return undefined;
  const key = img.currentSrc || img.src;
  let data = thumbs.get(key);
  if (data === undefined) {
    // Drawing a photograph down to 24px decodes all of it, and on the main
    // thread that was 30ms of a 65ms frame at 6x CPU, landing as a screen's
    // move ended. createImageBitmap shrinks it off the main thread; this
    // sample reads nothing for the image and the next one reads its thumb.
    if (typeof createImageBitmap === 'function') {
      if (!pendingThumbs.has(key)) {
        pendingThumbs.add(key);
        createImageBitmap(img, { resizeWidth: THUMB, resizeHeight: THUMB, resizeQuality: 'low' })
          .then(
            (bitmap) => {
              keepThumb(key, readThumb(bitmap));
              bitmap.close();
            },
            () => keepThumb(key, null),
          )
          .finally(() => pendingThumbs.delete(key));
      }
      return undefined;
    }
    data = readThumb(img);
    keepThumb(key, data);
  }
  if (!data) return undefined;
  const r = img.getBoundingClientRect();
  if (!r.width || !r.height) return undefined;
  const u = Math.min(THUMB - 1, Math.max(0, Math.floor(((x - r.left) / r.width) * THUMB)));
  const v = Math.min(THUMB - 1, Math.max(0, Math.floor(((y - r.top) / r.height) * THUMB)));
  const i = (v * THUMB + u) * 4;
  return { r: data.data[i] / 255, g: data.data[i + 1] / 255, b: data.data[i + 2] / 255, a: data.data[i + 3] / 255 };
}

/**
 * What one element paints at a point: a colour, null for nothing, undefined
 * for something opaque that cannot be read (a video, a canvas, a foreign image).
 */
function layerColor(el: Element, x: number, y: number): RGBA | null | undefined {
  if (el instanceof HTMLImageElement) return imageColor(el, x, y);
  if (el instanceof HTMLVideoElement || el instanceof HTMLCanvasElement) return undefined;
  const cs = getComputedStyle(el);
  const bg = toRgba(cs.backgroundColor) ?? CLEAR;
  let paint = bg;
  const image = cs.backgroundImage;
  if (image && image !== 'none') {
    const stops = colorsIn(image)
      .map(toRgba)
      .filter((c): c is RGBA => c !== null);
    const gradient = meanColor(stops);
    if (gradient) paint = over(gradient, bg);
    else if (image.includes('url(')) return undefined;
  }
  const opacity = parseFloat(cs.opacity);
  if (opacity < 1) paint = { ...paint, a: paint.a * opacity };
  return paint.a > 0 ? paint : null;
}

/** The lightness of the page at a point, ignoring the bar's own elements; null when unreadable. */
function lightnessAt(x: number, y: number, skip: Element): number | null {
  let acc = CLEAR;
  for (const el of document.elementsFromPoint(x, y)) {
    if (skip.contains(el)) continue;
    const c = layerColor(el, x, y);
    if (c === undefined) {
      // Something opaque we cannot read: only what has already built up counts.
      if (acc.a < 0.5) return null;
      break;
    }
    if (c === null) continue;
    acc = over(acc, c);
    if (acc.a >= 0.98) break;
  }
  const final = over(acc, WHITE);
  return lightness(final.r, final.g, final.b);
}

/**
 * The tone the bar in `root` should show. `auto` samples the page; a fixed
 * tone is returned as is. `key` changes ask for a fresh sample at once.
 */
export function useBackdropTone(root: RefObject<HTMLElement | null>, setting: ToneSetting, key: string): Tone {
  const [auto, setAuto] = useState<Tone>('light');
  const current = useRef<Tone>('light');
  const first = useRef(true);

  useEffect(() => {
    if (setting !== 'auto') return;
    const el = root.current;
    if (!el) return;
    let frame = 0;

    let later = 0;
    let last = -Infinity;
    const sample = () => {
      frame = 0;
      last = performance.now();
      const pill = el.querySelector<HTMLElement>('.anav__pill');
      if (!pill) return;
      const points: [number, number][] = [];
      const r = pill.getBoundingClientRect();
      for (const fx of COLUMNS) for (const fy of ROWS) points.push([r.left + r.width * fx, r.top + r.height * fy]);
      el.querySelectorAll<HTMLElement>('.anav__satellite').forEach((s) => {
        const c = s.getBoundingClientRect();
        points.push([c.left + c.width / 2, c.top + c.height / 2]);
      });
      const read = points
        .map(([x, y]) => lightnessAt(x, y, el))
        .filter((v): v is number => v !== null);
      // A verdict needs at least half the points; otherwise hold.
      const mean = read.length * 2 >= points.length ? read.reduce((a, b) => a + b, 0) / read.length : null;
      const next = nextTone(current.current, mean);
      if (next !== current.current) {
        current.current = next;
        setAuto(next);
      }
    };
    // A new key after the first is a change of screen or of the bar's shape,
    // and both are moving for the next ROUTE_CURVE.duration. A sample reads the
    // DOM at a dozen points and draws images into a canvas; landing in the
    // first frames of that move it was the largest single cost of the frame a
    // phone dropped. A page still sliding in has no settled tone to read
    // anyway, so the bar keeps the one it has until the move is over. The
    // scroll a screen change restores is part of the move and waits too.
    const hold = first.current ? 0 : ROUTE_CURVE.duration;
    first.current = false;
    const quietUntil = performance.now() + hold;
    const schedule = () => {
      if (frame || later || document.hidden) return;
      const now = performance.now();
      if (now < quietUntil) return;
      // Too soon after the last: one sample at the end of the gap instead, so
      // where a scroll stops is still read.
      const wait = last + MIN_GAP_MS - now;
      if (wait > 0) {
        later = window.setTimeout(() => {
          later = 0;
          schedule();
        }, wait);
        return;
      }
      frame = requestAnimationFrame(sample);
    };

    const settled = setTimeout(schedule, hold);
    document.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    const timer = setInterval(schedule, TIMER_MS);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(later);
      clearTimeout(settled);
      document.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      clearInterval(timer);
    };
  }, [setting, root, key]);

  return setting === 'auto' ? auto : setting;
}
