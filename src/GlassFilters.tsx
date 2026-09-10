import { useMemo } from 'react';
import { fillDisplacementMap, fillRimMask, frostLip, lensFor } from './refraction';

/**
 * Rasterises one w×h image as a PNG data URL, one pixel per CSS pixel. Empty
 * on the server, where there is no canvas; the filter or mask then has no
 * image and does nothing until the client renders.
 */
function raster(
  w: number,
  h: number,
  paint: (data: Uint8ClampedArray, W: number, H: number) => void,
): string {
  if (typeof document === 'undefined') return '';
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(W, H);
  paint(img.data, W, H);
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

const mapUrl = (w: number, h: number) =>
  raster(w, h, (d, W, H) => fillDisplacementMap(d, W, H, Math.min(W, H) / 2, lensFor(H, 1).band));
const maskUrl = (w: number, h: number, lip: number) =>
  raster(w, h, (d, W, H) => fillRimMask(d, W, H, Math.min(W, H) / 2, lensFor(H, 1).band, lip));

/**
 * The masks that thin the frost toward the lip, one for the pill at its target
 * width and one for the circles. They feed the merged glass filter on
 * Chromium and the CSS mask on the frost everywhere else. Empty strings
 * without a lens, which the stylesheet reads as no mask at all.
 */
export function useFrostMasks({
  width,
  height,
  circle,
  refraction,
}: {
  width: number;
  height: number;
  circle: number;
  refraction: number;
}): { pill: string; circle: string } {
  const lip = frostLip(refraction);
  const on = refraction > 0;
  const pill = useMemo(() => (on ? maskUrl(width, height, lip) : ''), [on, width, height, lip]);
  const disc = useMemo(() => (on ? maskUrl(circle, circle, lip) : ''), [on, circle, lip]);
  return { pill, circle: disc };
}

/** Red and blue are bent this much less and more than green, per unit of dispersion. */
const SPREAD = 0.08;

/** The bend: the backdrop pulled inward through the rim, in one pass or, with dispersion, one per channel. */
function Bend({ scale, dispersion, result }: { scale: number; dispersion: number; result: string }) {
  const spread = SPREAD * dispersion;
  if (dispersion <= 0) {
    return (
      <feDisplacementMap
        in="SourceGraphic"
        in2="map"
        scale={scale}
        xChannelSelector="R"
        yChannelSelector="G"
        result={result}
      />
    );
  }
  return (
    <>
      <feDisplacementMap in="SourceGraphic" in2="map" scale={scale * (1 - spread)} xChannelSelector="R" yChannelSelector="G" result="r" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" result="g" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale={scale * (1 + spread)} xChannelSelector="R" yChannelSelector="G" result="b" />
      {/* Keep one channel of each pass, then add them back together. */}
      <feColorMatrix in="r" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="rc" />
      <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="gc" />
      <feColorMatrix in="b" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="bc" />
      <feComposite in="rc" in2="gc" operator="arithmetic" k2="1" k3="1" result="rg" />
      <feComposite in="rg" in2="bc" operator="arithmetic" k2="1" k3="1" result={result} />
    </>
  );
}

/**
 * The whole material in one filter, so a shape costs one read of the page
 * beneath it instead of two: the frost (blur and saturation) kept where the
 * mask is opaque, the bend kept where it thins, and the two added back
 * together. `edgeMode="duplicate"` keeps the blur from fading to nothing at
 * the lip, where a Gaussian would otherwise sample past the filter region.
 */
function Glass({
  id,
  map,
  mask,
  width,
  height,
  blur,
  saturate,
  scale,
  dispersion,
}: {
  id: string;
  map: string;
  mask: string;
  width: number;
  height: number;
  blur: number;
  saturate: number;
  scale: number;
  dispersion: number;
}) {
  return (
    // sRGB, or the map's 128 would be gamma-converted and stop meaning "no
    // displacement", and the blur would no longer match the CSS one.
    <filter id={id} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation={blur} edgeMode="duplicate" result="blurred" />
      <feColorMatrix in="blurred" type="saturate" values={String(saturate)} result="frost" />
      <feImage href={mask} x="0" y="0" width={width} height={height} preserveAspectRatio="none" result="mask" />
      <feComposite in="frost" in2="mask" operator="in" result="frostIn" />
      <feImage href={map} x="0" y="0" width={width} height={height} preserveAspectRatio="none" result="map" />
      <Bend scale={scale} dispersion={dispersion} result="sharp" />
      {/* The mask's complement: white where the frost has thinned away. */}
      <feColorMatrix in="mask" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1 1" result="maskInv" />
      <feComposite in="sharp" in2="maskInv" operator="in" result="sharpIn" />
      <feComposite in="frostIn" in2="sharpIn" operator="arithmetic" k2="1" k3="1" />
    </filter>
  );
}

/** A bend alone, for the bubble: what is under it is already frosted by the pill. */
function Lens({ id, map, size, scale }: { id: string; map: string; size: number; scale: number }) {
  return (
    <filter id={id} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
      <feImage href={map} x="0" y="0" width={size} height={size} preserveAspectRatio="none" result="map" />
      <Bend scale={scale} dispersion={0} result="out" />
    </filter>
  );
}

/**
 * The SVG filters the glass layers reference: the pill at its current target
 * width, the satellite circles, and the selection bubble. The pill's images
 * are regenerated when its target width changes; while the width spring is
 * still travelling they cover the old width, and the sliver beyond it simply
 * goes unbent for a few frames.
 */
export function GlassFilters({
  id,
  width,
  height,
  circle,
  circles,
  capsule,
  blur,
  saturate,
  refraction,
  dispersion,
  masks,
}: {
  id: string;
  width: number;
  height: number;
  circle: number;
  /** Whether the circles get the merged filter at all. */
  circles: boolean;
  /** Diameter of the bubble's lens, or 0 for none. */
  capsule: number;
  blur: number;
  saturate: number;
  refraction: number;
  dispersion: number;
  masks: { pill: string; circle: string };
}) {
  const pillMap = useMemo(() => mapUrl(width, height), [width, height]);
  const discMap = useMemo(() => (circles ? mapUrl(circle, circle) : ''), [circles, circle]);
  const capMap = useMemo(() => (capsule > 0 ? mapUrl(capsule, capsule) : ''), [capsule]);
  return (
    <svg className="anav__filters" aria-hidden="true" focusable="false" width="0" height="0">
      <defs>
        <Glass
          id={`${id}-pill`}
          map={pillMap}
          mask={masks.pill}
          width={width}
          height={height}
          blur={blur}
          saturate={saturate}
          scale={lensFor(height, refraction).scale}
          dispersion={dispersion}
        />
        {circles && (
          <Glass
            id={`${id}-circle`}
            map={discMap}
            mask={masks.circle}
            width={circle}
            height={circle}
            blur={blur}
            saturate={saturate}
            scale={lensFor(circle, refraction).scale}
            dispersion={0}
          />
        )}
        {capsule > 0 && (
          <Lens id={`${id}-capsule`} map={capMap} size={capsule} scale={lensFor(capsule, refraction).scale} />
        )}
      </defs>
    </svg>
  );
}
