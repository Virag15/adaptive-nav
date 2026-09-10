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
 * width and one for the circles. Empty strings without a lens, which the
 * stylesheet reads as no mask at all.
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

function Lens({
  id,
  map,
  width,
  height,
  scale,
  dispersion,
}: {
  id: string;
  map: string;
  width: number;
  height: number;
  scale: number;
  dispersion: number;
}) {
  const spread = SPREAD * dispersion;
  return (
    // sRGB, or the map's 128 would be gamma-converted and stop meaning "no displacement".
    <filter id={id} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
      <feImage
        href={map}
        x="0"
        y="0"
        width={width}
        height={height}
        preserveAspectRatio="none"
        result="map"
      />
      {dispersion > 0 ? (
        <>
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale={scale * (1 - spread)}
            xChannelSelector="R"
            yChannelSelector="G"
            result="r"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale={scale}
            xChannelSelector="R"
            yChannelSelector="G"
            result="g"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale={scale * (1 + spread)}
            xChannelSelector="R"
            yChannelSelector="G"
            result="b"
          />
          {/* Keep one channel of each pass, then add them back together. */}
          <feColorMatrix in="r" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="rc" />
          <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="gc" />
          <feColorMatrix in="b" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="bc" />
          <feComposite in="rc" in2="gc" operator="arithmetic" k2="1" k3="1" result="rg" />
          <feComposite in="rg" in2="bc" operator="arithmetic" k2="1" k3="1" />
        </>
      ) : (
        <feDisplacementMap
          in="SourceGraphic"
          in2="map"
          scale={scale}
          xChannelSelector="R"
          yChannelSelector="G"
        />
      )}
    </filter>
  );
}

/**
 * The SVG filters the lens layers reference: the pill at its current target
 * width, the satellite circles, and the selection capsule. The pill's map is
 * regenerated when its target width changes; while the width spring is still
 * travelling the map covers the old width, and the sliver beyond it simply
 * goes unbent for a few frames.
 */
export function GlassFilters({
  id,
  width,
  height,
  circle,
  capsule,
  refraction,
  dispersion,
}: {
  id: string;
  width: number;
  height: number;
  circle: number;
  /** Diameter of the capsule's lens, or 0 for none. */
  capsule: number;
  refraction: number;
  dispersion: number;
}) {
  const pillMap = useMemo(() => mapUrl(width, height), [width, height]);
  const discMap = useMemo(() => mapUrl(circle, circle), [circle]);
  const capMap = useMemo(() => (capsule > 0 ? mapUrl(capsule, capsule) : ''), [capsule]);
  return (
    <svg className="anav__filters" aria-hidden="true" focusable="false" width="0" height="0">
      <defs>
        <Lens
          id={`${id}-pill`}
          map={pillMap}
          width={width}
          height={height}
          scale={lensFor(height, refraction).scale}
          dispersion={dispersion}
        />
        <Lens
          id={`${id}-circle`}
          map={discMap}
          width={circle}
          height={circle}
          scale={lensFor(circle, refraction).scale}
          dispersion={dispersion}
        />
        {capsule > 0 && (
          <Lens
            id={`${id}-capsule`}
            map={capMap}
            width={capsule}
            height={capsule}
            scale={lensFor(capsule, refraction).scale}
            dispersion={dispersion}
          />
        )}
      </defs>
    </svg>
  );
}
