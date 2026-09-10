/**
 * The material as numbers. A preset is a named point in this space, the demo's
 * sliders walk through it, and `glassVars` turns a point into the CSS tokens
 * the stylesheet reads. Kept apart from React so it can be tested and so a host
 * can compute the tokens without rendering.
 */
export interface GlassConfig {
  /** The material's own colour, opaque: white for light glass, near-black for smoked. */
  base: string;
  /** How much of the backdrop the material covers, 0–1. */
  opacity: number;
  /** Backdrop blur radius in px. */
  blur: number;
  /** Backdrop saturation; 1 leaves colours alone, 1.6 makes them sing through the frost. */
  saturate: number;
  /** The colour the glass is tinted with; any CSS colour. */
  tint: string;
  /** How far toward the tint the material is pushed, 0–1. */
  tintAmount: number;
  /** Strength of the lit edge and inner sheen that read as thickness, 0–1. */
  rim: number;
  /**
   * How much the backdrop bends at the rim, 0–1. Rendered with an SVG
   * displacement filter, which only Chromium applies to a backdrop; elsewhere
   * the rim alone carries the glass.
   */
  refraction: number;
  /** Colour fringing at the rim, 0–1. Costs two more filter passes; keep it for hero moments. */
  dispersion: number;
}

export type GlassPreset = 'frosted' | 'clear' | 'liquid' | 'tinted' | 'smoke' | 'solid';

export const GLASS_PRESETS: Record<GlassPreset, GlassConfig> = {
  /** The original: milky, high blur, reads as a UI surface first and glass second. */
  frosted: {
    base: '#fff',
    opacity: 0.88,
    blur: 20,
    saturate: 1.6,
    tint: '#5433eb',
    tintAmount: 0,
    rim: 0.35,
    refraction: 0,
    dispersion: 0,
  },
  /** Thin, mostly see-through; the rim does the work of separating it from the page. */
  clear: {
    base: '#fff',
    opacity: 0.4,
    blur: 8,
    saturate: 1.4,
    tint: '#5433eb',
    tintAmount: 0,
    rim: 0.8,
    refraction: 0.55,
    dispersion: 0,
  },
  /** Barely there, a lens more than a surface: bends and fringes what passes under it. */
  liquid: {
    base: '#fff',
    opacity: 0.22,
    blur: 3,
    saturate: 1.5,
    tint: '#5433eb',
    tintAmount: 0,
    rim: 1,
    refraction: 1,
    dispersion: 0.6,
  },
  /** Coloured glass: the accent soaked into the material rather than painted on it. */
  tinted: {
    base: '#fff',
    opacity: 0.72,
    blur: 16,
    saturate: 1.5,
    tint: '#5433eb',
    tintAmount: 0.45,
    rim: 0.5,
    refraction: 0.25,
    dispersion: 0,
  },
  /** Smoked glass for dark screens. */
  smoke: {
    base: '#1c1c1e',
    opacity: 0.78,
    blur: 18,
    saturate: 1.2,
    tint: '#5433eb',
    tintAmount: 0,
    rim: 0.25,
    refraction: 0.2,
    dispersion: 0,
  },
  /** No glass at all: a flat bar for hosts that want the shape without the material. */
  solid: {
    base: '#fff',
    opacity: 1,
    blur: 0,
    saturate: 1,
    tint: '#5433eb',
    tintAmount: 0,
    rim: 0,
    refraction: 0,
    dispersion: 0,
  },
};

export const DEFAULT_GLASS: GlassConfig = GLASS_PRESETS.frosted;

/** What a host may pass: a preset by name, or any subset of the knobs. */
export type GlassInput = GlassPreset | Partial<GlassConfig>;

/**
 * A preset replaces every knob; a partial patches the given base. Numbers are
 * clamped to the ranges the stylesheet expects, so a slider that drifts past
 * its end cannot produce an invalid token.
 *
 * Input: ('smoke', DEFAULT_GLASS)                      Output: GLASS_PRESETS.smoke
 * Input: ({ tintAmount: 0.3 }, DEFAULT_GLASS)          Output: frosted with tintAmount 0.3
 * Input: ({ opacity: 4 }, DEFAULT_GLASS)               Output: frosted with opacity 1
 */
export function resolveGlass(input: GlassInput | undefined, over: GlassConfig = DEFAULT_GLASS): GlassConfig {
  if (input === undefined) return over;
  const merged: GlassConfig = typeof input === 'string' ? { ...GLASS_PRESETS[input] } : { ...over, ...input };
  return {
    ...merged,
    opacity: unit(merged.opacity),
    blur: Math.max(0, merged.blur),
    saturate: Math.max(0, merged.saturate),
    tintAmount: unit(merged.tintAmount),
    rim: unit(merged.rim),
    refraction: unit(merged.refraction),
    dispersion: unit(merged.dispersion),
  };
}

const unit = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
const pct = (n: number) => `${round(n * 100)}%`;
const round = (n: number) => Math.round(n * 1000) / 1000;

export type GlassVars = Record<`--anav-${string}`, string>;

/**
 * The tokens for one material. The knobs are emitted alongside the composites
 * they feed (`--anav-glass`, `--anav-glass-blur`), so writing these on any
 * element, not only `:root`, changes the bar inside it.
 *
 * Input: GLASS_PRESETS.solid  Output: { '--anav-glass': 'color-mix(in srgb, #fff 100%, transparent)', '--anav-glass-blur': 'blur(0px) saturate(100%)', … }
 */
export function glassVars(g: GlassConfig): GlassVars {
  return {
    '--anav-glass-base': g.base,
    '--anav-glass-opacity': String(round(g.opacity)),
    '--anav-glass': `color-mix(in srgb, ${g.base} ${pct(g.opacity)}, transparent)`,
    '--anav-blur': `${round(g.blur)}px`,
    '--anav-saturate': pct(g.saturate),
    '--anav-glass-blur': `blur(${round(g.blur)}px) saturate(${pct(g.saturate)})`,
    '--anav-tint': g.tint,
    '--anav-tint-amount': String(round(g.tintAmount)),
    '--anav-rim': String(round(g.rim)),
  };
}
