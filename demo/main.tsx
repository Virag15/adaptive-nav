import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import {
  AdaptiveNav,
  GLASS_PRESETS,
  setGlobalGlass,
  useGlass,
  type GlassConfig,
  type GlassPreset,
  type IndicatorStyle,
  type NavMode,
  type Quality,
  type TabOption,
  type ToneSetting,
} from '../src';
import '../src/adaptive-nav.css';

const Dot = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8" fill="currentColor" />
  </svg>
);
const Ring = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2.6" />
  </svg>
);
const Square = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="5" y="5" width="14" height="14" rx="4" fill="currentColor" />
  </svg>
);
const Tri = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 4.5 20 19H4z" fill="currentColor" />
  </svg>
);

const TABS: TabOption[] = [
  { id: 'a', label: 'Alpha', Icon: Dot },
  { id: 'b', label: 'Beta', Icon: Ring, badge: 3 },
  { id: 'c', label: 'Gamma', Icon: Square },
  { id: 'd', label: 'Delta', Icon: Dot },
];

const MODES: NavMode[] = ['tabs', 'context', 'buy', 'search', 'toolbar', 'select', 'confirm', 'hidden'];
const TONES: ToneSetting[] = ['auto', 'light', 'dark'];
const QUALITIES: Quality[] = ['auto', 'full', 'edges', 'off'];
const PRESETS = Object.keys(GLASS_PRESETS) as GlassPreset[];
const INDICATORS: IndicatorStyle[] = ['capsule', 'dot', 'glow', 'lift'];
/** The playground opens on the material this bar is about. */
const FIRST_PRESET: GlassPreset = 'liquid';

/** Sliders over the glass knobs; each writes straight to the global material. */
const KNOBS: { key: keyof GlassConfig; label: string; min: number; max: number; step: number }[] = [
  { key: 'tintAmount', label: 'tint', min: 0, max: 1, step: 0.01 },
  { key: 'opacity', label: 'opacity', min: 0, max: 1, step: 0.01 },
  { key: 'blur', label: 'blur', min: 0, max: 40, step: 1 },
  { key: 'saturate', label: 'saturate', min: 0.5, max: 2.5, step: 0.05 },
  { key: 'rim', label: 'rim', min: 0, max: 1, step: 0.01 },
  { key: 'refraction', label: 'refraction', min: 0, max: 1, step: 0.01 },
  { key: 'dispersion', label: 'dispersion', min: 0, max: 1, step: 0.01 },
];

const TILE_HUES = [4, 28, 48, 96, 160, 200, 230, 262, 300, 335, 20, 180];

function Playground() {
  const [mode, setMode] = useState<NavMode>('tabs');
  const [tab, setTab] = useState('a');
  const [on, setOn] = useState(false);
  const [saved, setSaved] = useState(false);
  const [small, setSmall] = useState(false);
  const [min, setMin] = useState(false);
  const [labelled, setLabelled] = useState(false);
  const [dark, setDark] = useState(false);
  const [tone, setTone] = useState<ToneSetting>('auto');
  const [quality, setQuality] = useState<Quality>('auto');
  const [preset, setPreset] = useState<GlassPreset>(FIRST_PRESET);
  const [indicator, setIndicator] = useState<IndicatorStyle>('capsule');
  const [hue, setHue] = useState(252);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(3);
  const [log, setLog] = useState<string[]>([]);
  const note = (s: string) => setLog((l) => [...l.slice(-5), s]);
  const g = useGlass();
  const leave = (what: string) => {
    note(what);
    setMode('tabs');
  };

  return (
    <>
      <div className="panel">
        <div className="row">
          <b>mode</b>
          {MODES.map((m) => (
            <button key={m} id={`to-${m}`} aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>
        <div className="row">
          <b>page</b>
          <button
            id="dark"
            aria-pressed={dark}
            onClick={() => {
              // Only the page changes; with tone="auto" the bar reads it and follows.
              setDark((d) => !d);
              document.documentElement.classList.toggle('dark', !dark);
            }}
          >
            dark
          </button>
          <button id="small" aria-pressed={small} onClick={() => setSmall((s) => !s)}>
            slot 44
          </button>
          <button id="min" aria-pressed={min} onClick={() => setMin((m) => !m)}>
            minimized
          </button>
          <button id="labelled" aria-pressed={labelled} onClick={() => setLabelled((l) => !l)}>
            labelled
          </button>
          <b>tone</b>
          {TONES.map((t) => (
            <button key={t} id={`tone-${t}`} aria-pressed={tone === t} onClick={() => setTone(t)}>
              {t}
            </button>
          ))}
        </div>
        <div className="row">
          <b>quality</b>
          {QUALITIES.map((q) => (
            <button key={q} id={`quality-${q}`} aria-pressed={quality === q} onClick={() => setQuality(q)}>
              {q}
            </button>
          ))}
        </div>
        <div className="row">
          <b>glass</b>
          {PRESETS.map((p) => (
            <button
              key={p}
              id={`glass-${p}`}
              aria-pressed={preset === p}
              onClick={() => {
                setPreset(p);
                setGlobalGlass(p);
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="row">
          <b>indicator</b>
          {INDICATORS.map((s) => (
            <button key={s} id={`ind-${s}`} aria-pressed={indicator === s} onClick={() => setIndicator(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="knobs">
          <label className="knob hue">
            <span>tint hue</span>
            <input
              id="knob-hue"
              type="range"
              min={0}
              max={360}
              step={1}
              value={hue}
              onChange={(e) => {
                const h = Number(e.target.value);
                setHue(h);
                setGlobalGlass({ tint: `hsl(${h} 80% 55%)` });
              }}
            />
            <output>{hue}°</output>
          </label>
          {KNOBS.map((k) => (
            <label key={k.key} className="knob">
              <span>{k.label}</span>
              <input
                id={`knob-${k.key}`}
                type="range"
                min={k.min}
                max={k.max}
                step={k.step}
                value={g[k.key] as number}
                onChange={(e) => setGlobalGlass({ [k.key]: Number(e.target.value) })}
              />
              <output>{k.key === 'blur' ? `${g.blur}px` : (g[k.key] as number).toFixed(2)}</output>
            </label>
          ))}
        </div>
        <p className="note">
          Drag sideways across the tabs to scrub; flick to throw the indicator; press and hold to
          see the bubble swell. Scroll the bar over the dark band and it turns to dark glass with
          white ink on its own. Refraction needs a browser that applies SVG filters to a backdrop
          (Chromium); elsewhere the lit rim carries the glass.
        </p>
        <pre id="log">{log.join('\n')}</pre>
      </div>

      <div className="stage">
        <h1 className="headline">Glass over<br />whatever is<br />underneath.</h1>
        <p className="copy">
          Scroll so the bar crosses the tiles, the stripes and the grid. The middle of the slab is
          frosted; at the lip the frost thins, the backdrop bends inward, and light catches the
          edge. Every preset is the same nine numbers.
        </p>
        <div className="tiles">
          {TILE_HUES.map((h, i) => (
            <div
              key={i}
              className="tile"
              style={{ background: `linear-gradient(135deg, hsl(${h} 85% 62%), hsl(${h + 40} 80% 45%))` }}
            />
          ))}
        </div>
        <div className="stripes" />
        <div className="grid" />
      </div>

      <section className="band" id="band">
        <h2 className="headline">Dark<br />underneath.</h2>
        <p className="copy">
          The bar reads what it floats over. Here the page is near black, so the glass turns
          smoked and the ink turns white — the sections, the search field, the circles, all of
          it — and turns back as the light content scrolls under it again.
        </p>
        <div className="tiles">
          {TILE_HUES.slice(0, 6).map((h, i) => (
            <div
              key={i}
              className="tile"
              style={{ background: `linear-gradient(135deg, hsl(${h} 45% 22%), hsl(${h + 40} 40% 12%))` }}
            />
          ))}
        </div>
      </section>

      <div className="stage">
        <p className="copy">
          The lens follows a traced ray: nothing bends at the lip itself, the pull peaks just
          inside it where the edge is steepest, then eases off toward the flat top. It only ever
          pulls inward, because a backdrop filter can see nothing beyond its own edge. Dispersion
          splits that pull into three passes, one per channel.
        </p>
        <div className="tiles">
          {TILE_HUES.slice()
            .reverse()
            .map((h, i) => (
              <div
                key={i}
                className="tile"
                style={{ background: `radial-gradient(circle at 30% 30%, hsl(${h} 90% 75%), hsl(${h} 70% 40%))` }}
              />
            ))}
        </div>
        <div className="stripes" />
        <h1 className="headline">Scrub it.<br />Flick it.<br />Search it.</h1>
      </div>

      <AdaptiveNav
        mode={mode}
        options={TABS}
        value={tab}
        indicator={indicator}
        tone={tone}
        quality={quality}
        onChange={(id) => {
          setTab(id);
          note('change:' + id);
        }}
        onBack={() => leave(mode === 'select' || mode === 'confirm' ? 'close' : 'back')}
        action={
          mode === 'context' || mode === 'buy' || mode === 'search' || mode === 'toolbar'
            ? { id: 'save', label: 'Save', Icon: Dot, active: on, badge: 2, onPress: () => setOn((o) => !o) }
            : mode === 'select'
              ? { id: 'delete', label: 'Delete', Icon: Tri, onPress: () => note('delete ' + picked) }
              : undefined
        }
        buy={
          mode === 'buy'
            ? { label: 'Add to bag', price: '₹1,000', done: 'Added!', onPress: () => note('buy') }
            : undefined
        }
        search={
          mode === 'search'
            ? {
                value: query,
                placeholder: 'Search rings, chains…',
                onChange: setQuery,
                onSubmit: (q) => note('search:' + q),
              }
            : undefined
        }
        tools={[
          { id: 'share', label: 'Share', Icon: Tri, onPress: () => note('tool:share') },
          { id: 'like', label: 'Like', Icon: Ring, active: saved, onPress: () => setSaved((s) => !s) },
          { id: 'more', label: 'More', Icon: Square, badge: 1, onPress: () => note('tool:more') },
        ]}
        select={{
          label: `${picked} selected`,
          onDone: () => {
            setPicked((n) => n + 1);
            leave('select done');
          },
        }}
        confirm={{
          secondary: { label: 'Cancel', onPress: () => leave('confirm:cancel') },
          primary: { label: 'Apply filters', onPress: () => leave('confirm:apply') },
        }}
        metrics={small ? { slot: 44 } : undefined}
        minimized={min}
        labelled={labelled}
        onExpand={() => {
          setMin(false);
          note('expand');
        }}
      />
    </>
  );
}

setGlobalGlass(FIRST_PRESET);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <Playground />
    </MotionConfig>
  </StrictMode>,
);
