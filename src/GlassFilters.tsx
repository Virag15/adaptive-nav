import { useMemo } from 'react';
import { fillDisplacementMap, lensFor } from './refraction';

/**
 * Rasterises the displacement map for one shape as a PNG data URL, one map
 * pixel per CSS pixel. Empty on the server, where there is no canvas; the
 * filter then has no map and does nothing until the client renders.
 */
function mapUrl(w: number, h: number, r: number, band: number): string {
  if (typeof document === 'undefined') return '';
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(W, H);
  fillDisplacementMap(img.data, W, H, r, band);
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
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
 * The two SVG filters the refraction layers reference: one for the pill at its
 * current target width, one for the satellite circles. The pill's map is
 * regenerated when its target width changes; while the width spring is still
 * travelling the map covers the old width, and the sliver beyond it simply
 * goes unbent for a few frames.
 */
export function GlassFilters({
  id,
  width,
  height,
  circle,
  refraction,
  dispersion,
}: {
  id: string;
  width: number;
  height: number;
  circle: number;
  refraction: number;
  dispersion: number;
}) {
  const pill = lensFor(height, refraction);
  const disc = lensFor(circle, refraction);
  const pillMap = useMemo(() => mapUrl(width, height, height / 2, pill.band), [width, height, pill.band]);
  const discMap = useMemo(() => mapUrl(circle, circle, circle / 2, disc.band), [circle, disc.band]);
  return (
    <svg className="anav__filters" aria-hidden="true" focusable="false" width="0" height="0">
      <defs>
        <Lens
          id={`${id}-pill`}
          map={pillMap}
          width={width}
          height={height}
          scale={pill.scale}
          dispersion={dispersion}
        />
        <Lens
          id={`${id}-circle`}
          map={discMap}
          width={circle}
          height={circle}
          scale={disc.scale}
          dispersion={dispersion}
        />
      </defs>
    </svg>
  );
}
