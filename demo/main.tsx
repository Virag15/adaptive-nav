import { StrictMode, memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  type NavAction,
  type NavMode,
  type PlacementSetting,
  type Quality,
  type TabOption,
  type ToneSetting,
} from '../src';
import '../src/adaptive-nav.css';

/* ---------- Icons for the sample tabs; static, so they never rebuild ---------- */

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

/* ---------- What the inspector offers, named for what a person sees ---------- */


/** Icons for the app's own trailing items: saved, alerts, more. */
const Heart = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <path d="M12 20s-7-4.4-7-9.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.7C19 15.6 12 20 12 20Z" />
  </svg>
);
const Bell = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" />
    <path d="M10.5 19a1.8 1.8 0 0 0 3 0" />
  </svg>
);
const Ellipsis = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="5.5" cy="12" r="1.8" fill="currentColor" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1.8" fill="currentColor" />
  </svg>
);

/** The same sections with a dot in place of the count, for the badge switch. */
const DOT_TABS: TabOption[] = TABS.map((t) => (t.badge ? { ...t, badge: true } : t));

const SCENES: { mode: NavMode; name: string; what: string }[] = [
  { mode: 'tabs', name: 'Home', what: 'sections' },
  { mode: 'context', name: 'Pushed', what: 'Back, Save' },
  { mode: 'buy', name: 'Product', what: 'Add to cart' },
  { mode: 'search', name: 'Search', what: 'a field' },
  { mode: 'toolbar', name: 'Photo', what: 'share, like, more' },
  { mode: 'select', name: 'Select', what: 'count, Done' },
  { mode: 'confirm', name: 'Filters', what: 'Cancel, Apply' },
  { mode: 'hidden', name: 'Gallery', what: 'bar away' },
];
const SCENE_OPTIONS = SCENES.map((s) => ({ value: s.mode, name: s.name, sub: s.what }));
const TITLES: Partial<Record<NavMode, string>> = { toolbar: 'Photo', confirm: 'Filters' };
const PLACEMENTS: { value: PlacementSetting; name: string }[] = [
  { value: 'auto', name: 'By width' },
  { value: 'bottom', name: 'Bottom' },
  { value: 'top', name: 'Top' },
];
const TONES: { value: ToneSetting; name: string }[] = [
  { value: 'auto', name: 'Reads the page' },
  { value: 'light', name: 'Light' },
  { value: 'dark', name: 'Dark' },
];
const QUALITIES: { value: Quality; name: string }[] = [
  { value: 'auto', name: 'Auto' },
  { value: 'full', name: 'Full' },
  { value: 'edges', name: 'Edges' },
  { value: 'off', name: 'Off' },
];
const PRESETS = (Object.keys(GLASS_PRESETS) as GlassPreset[]).map((p) => ({ value: p, name: p[0].toUpperCase() + p.slice(1) }));
const INDICATORS = (['capsule', 'dot', 'glow', 'lift'] as IndicatorStyle[]).map((s) => ({ value: s, name: s[0].toUpperCase() + s.slice(1) }));
/** The playground opens on the material this bar is about. */
const FIRST_PRESET: GlassPreset = 'liquid';

/** Sliders over the glass knobs; each writes straight to the global material. */
const KNOBS: { key: keyof GlassConfig; label: string; min: number; max: number; step: number }[] = [
  { key: 'tintAmount', label: 'Tint', min: 0, max: 1, step: 0.01 },
  { key: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.01 },
  { key: 'blur', label: 'Blur', min: 0, max: 40, step: 1 },
  { key: 'saturate', label: 'Saturation', min: 0.5, max: 2.5, step: 0.05 },
  { key: 'rim', label: 'Rim light', min: 0, max: 1, step: 0.01 },
  { key: 'refraction', label: 'Refraction', min: 0, max: 1, step: 0.01 },
  { key: 'dispersion', label: 'Dispersion', min: 0, max: 1, step: 0.01 },
];

/* ---------- Sample content: a small demo app for the bar to float over ---------- */

type Work = { name: string; price: string; tint: string; figure: string };
const NEW_WORK: Work[] = [
  { name: 'Prism', price: '$148', tint: 'rose', figure: 'prism' },
  { name: 'Meridian', price: '$92', tint: 'indigo', figure: 'bar' },
  { name: 'Pendant', price: '$210', tint: 'pine', figure: 'drops' },
  { name: 'Strand', price: '$76', tint: 'violet', figure: 'beads' },
  { name: 'Halo', price: '$132', tint: 'amber', figure: 'halo' },
  { name: 'Cable', price: '$64', tint: 'indigo', figure: 'bar' },
];
const IN_THE_ROOM: Work[] = [
  { name: 'Night prism', price: '$340', tint: 'rose', figure: 'prism' },
  { name: 'Long meridian', price: '$112', tint: 'indigo', figure: 'bar' },
  { name: 'Pale strand', price: '$66', tint: 'pine', figure: 'beads' },
  { name: 'Twin drops', price: '$88', tint: 'violet', figure: 'drops' },
];
const FIRST_WORK = NEW_WORK[0];
const ROOMS: { name: string; count: string; tint: string; figure: string }[] = [
  { name: 'Geometry', count: '48 works', tint: 'rose', figure: 'drops' },
  { name: 'Metals', count: '120 works', tint: 'amber', figure: 'bar' },
  { name: 'Monochrome', count: '36 works', tint: 'violet', figure: 'prism' },
  { name: 'Studies', count: '22 works', tint: 'indigo', figure: 'beads' },
];

const Chevron = () => (
  <svg className="row__chevron" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 3.5 4.5 4.5L6 12.5" />
  </svg>
);

function Case({ work, index, onPick }: { work: Work; index: number; onPick: (w: Work) => void }) {
  return (
    <button
      type="button"
      className={`case tile rise press case--${work.tint}`}
      style={{ ['--i' as string]: index }}
      onClick={() => onPick(work)}
      aria-label={`${work.name}, ${work.price}`}
    >
      <span className="case__art" aria-hidden>
        <span className={`figure figure--${work.figure}`} />
      </span>
      <span className="case__label">
        <span className="case__name">{work.name}</span>
        <span className="case__price">{work.price}</span>
      </span>
    </button>
  );
}

const USAGE = `import { AdaptiveNav } from '@virag/adaptive-nav'
import '@virag/adaptive-nav/styles.css'

<AdaptiveNav
  mode={mode}          // tabs · context · buy · search · toolbar · select · confirm · hidden
  options={tabs}
  value={tab}
  onChange={setTab}
  onBack={goBack}
/>`;

/**
 * The sample app never changes while the bar is tuned, so it renders once and
 * is left alone: the inspector's sliders re-render only themselves.
 */
const Sample = memo(function Sample({ onPick, onOpen, onTune }: { onPick: (w: Work) => void; onOpen: (name: string) => void; onTune: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <section className="hero">
        <span className="hero__art" aria-hidden>
          <span className="figure figure--prism" style={{ width: '100%' }} />
        </span>
        <p className="hero__eyebrow">React + Motion · MIT</p>
        <h1 className="hero__title">Glass that reads the room</h1>
        <p className="hero__lede">
          A floating tab bar that bends what is under it, turns its ink white over dark content, and becomes a search
          field, a buy bar or a toolbar as the screen needs. Free to use in anything.
        </p>
        <div className="install">
          <button
            type="button"
            className="install__cmd press"
            data-copied={copied || undefined}
            onClick={() => {
              navigator.clipboard?.writeText(INSTALL).then(
                () => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1400);
                },
                () => undefined,
              );
            }}
          >
            {INSTALL}
            {copied ? <TickIcon /> : <CopyIcon />}
          </button>
          <button type="button" className="install__link press" onClick={onTune}>
            Open the playground
          </button>
        </div>
      </section>

      <section className="shelf stage">
        <div className="shelf__head">
          <h2 className="shelf__title">New prints</h2>
          <span className="shelf__note">Tap a card. The bar becomes a buy bar.</span>
        </div>
        <div className="cases">
          {NEW_WORK.map((w, i) => (
            <Case key={w.name} work={w} index={i} onPick={onPick} />
          ))}
        </div>
      </section>

      <section className="room shelf" id="band">
        <div className="shelf__head">
          <h2 className="shelf__title">The dark room</h2>
          <span className="shelf__note">Scroll it under the bar. The ink turns.</span>
        </div>
        <div className="cases">
          {IN_THE_ROOM.map((w, i) => (
            <Case key={w.name} work={w} index={i} onPick={onPick} />
          ))}
        </div>
      </section>

      <section className="shelf stage">
        <div className="shelf__head">
          <h2 className="shelf__title">Rooms</h2>
          <span className="shelf__note">Opens a pushed screen.</span>
        </div>
        <div className="rows">
          {ROOMS.map((r) => (
            <button key={r.name} type="button" className={`row case--${r.tint}`} onClick={() => onOpen(r.name)}>
              <span className="row__swatch" aria-hidden>
                <span className={`figure figure--${r.figure}`} />
              </span>
              <span className="row__name">{r.name}</span>
              <span className="row__count">{r.count}</span>
              <Chevron />
            </button>
          ))}
        </div>
      </section>

      <section className="shelf stage lens">
        <div className="shelf__head">
          <h2 className="shelf__title">Lens test</h2>
          <span className="shelf__note">Straight lines show the bend.</span>
        </div>
        <div className="stripes" />
        <div className="grid" />
        <p className="copy">
          Park the bar over the stripes. The frost blurs the middle, the lens bends the rim inward, and with dispersion
          the bend splits into colour. Only Chromium draws the lens; elsewhere the frost, the tint and the lit lip carry
          the glass.
        </p>
      </section>

      <section className="shelf stage">
        <div className="shelf__head">
          <h2 className="shelf__title">Use it</h2>
          <span className="shelf__note">One component, eight modes.</span>
        </div>
        <pre className="code">{USAGE}</pre>
      </section>

      <footer className="colophon">
        Every preset is the same nine numbers. Every curve comes from one rule: the pill is a capsule, the circles share
        its height, and anything inset is concentric. This page never styles the bar, so anything that looks wrong on it
        is the component's fault, not the page's. MIT licensed.
      </footer>
    </>
  );
});

/* ---------- The inspector ---------- */

function Section({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <h3 className="section__label">
        <span>{label}</span>
        {hint ? <span className="section__hint">{hint}</span> : null}
      </h3>
      {children}
    </section>
  );
}

function Seg<T extends string>({
  name,
  value,
  options,
  onPick,
  idFor,
  wrap,
}: {
  name: string;
  value: T;
  options: { value: T; name: string; sub?: string }[];
  onPick: (v: T) => void;
  idFor: (v: T) => string;
  wrap?: boolean;
}) {
  return (
    <div className={wrap ? 'seg seg--wrap' : 'seg'} role="group" aria-label={name}>
      {options.map((o) => (
        <button key={o.value} type="button" id={idFor(o.value)} className="seg__opt" aria-pressed={value === o.value} onClick={() => onPick(o.value)}>
          {o.name}
          {o.sub ? <small>{o.sub}</small> : null}
        </button>
      ))}
    </div>
  );
}

function Switch({ id, on, onFlip, children }: { id: string; on: boolean; onFlip: () => void; children: ReactNode }) {
  return (
    <button type="button" id={id} className="switch" role="switch" aria-checked={on} onClick={onFlip}>
      <span>{children}</span>
      <span className="switch__knob" aria-hidden />
    </button>
  );
}

/** The sliders are the only thing that reads the material, so only they re-render as it moves. */
function Material() {
  const g = useGlass();
  const [hue, setHue] = useState(252);
  return (
    <details className="fine">
      <summary>Fine-tune the material</summary>
      <div className="knobs">
        <label className="knob hue">
          <span>Tint hue</span>
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
    </details>
  );
}

/* ---------- The page ---------- */

const CopyIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="5.75" y="5.75" width="7.5" height="7.5" rx="2" />
    <path d="M10.25 3.75A1.5 1.5 0 0 0 8.75 2.25h-4a2.5 2.5 0 0 0-2.5 2.5v4a1.5 1.5 0 0 0 1.5 1.5" />
  </svg>
);
const TickIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 8.5 3.5 3.5L13 5" />
  </svg>
);
const BarGlyph = () => (
  <svg className="brand__glyph" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="1.5" y="7.5" width="21" height="9" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="7" cy="12" r="2.4" fill="currentColor" />
  </svg>
);
const INSTALL = 'npm i @virag/adaptive-nav';

const CloseIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="m4 4 8 8M12 4l-8 8" />
  </svg>
);
const TuneIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 7h7M17 7h3M4 17h5M13 17h7" />
    <circle cx="14" cy="7" r="2.5" />
    <circle cx="10" cy="17" r="2.5" />
  </svg>
);

function Playground() {
  const [mode, setMode] = useState<NavMode>('tabs');
  const [tab, setTab] = useState('a');
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [small, setSmall] = useState(false);
  const [min, setMin] = useState(false);
  const [labelled, setLabelled] = useState(false);
  const [appItems, setAppItems] = useState(true);
  const [persist, setPersist] = useState(true);
  const [dots, setDots] = useState(false);
  const [dark, setDark] = useState(false);
  const [tone, setTone] = useState<ToneSetting>('auto');
  const [quality, setQuality] = useState<Quality>('auto');
  const [placement, setPlacement] = useState<PlacementSetting>('auto');
  const [preset, setPreset] = useState<GlassPreset>(FIRST_PRESET);
  const [indicator, setIndicator] = useState<IndicatorStyle>('capsule');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(3);
  const [work, setWork] = useState<Work>(FIRST_WORK);
  const [room, setRoom] = useState('Rooms');
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);
  const [log, setLog] = useState<string[]>([]);
  const note = useCallback((s: string) => setLog((l) => [...l.slice(-5), s]), []);
  const leave = useCallback(
    (what: string) => {
      note(what);
      setMode('tabs');
    },
    [note],
  );
  const pick = useCallback(
    (w: Work) => {
      setWork(w);
      setMode('buy');
      note('open ' + w.name);
    },
    [note],
  );
  const openRoom = useCallback(
    (name: string) => {
      setRoom(name);
      setMode('context');
      note('room ' + name);
    },
    [note],
  );
  const openTune = useCallback(() => setOpen(true), []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  // The stylesheet reflows the store beside a docked inspector on wide screens.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-inspector', open);
  }, [open]);

  const title = mode === 'buy' ? work.name : mode === 'context' ? room : TITLES[mode];

  // The bar's own props are objects; keeping them stable keeps its render cheap.
  const action = useMemo<NavAction | undefined>(() => {
    if (mode === 'context' || mode === 'buy' || mode === 'search' || mode === 'toolbar') {
      return { id: 'save', label: 'Save', Icon: Dot, active: saved, badge: dots ? true : 2, onPress: () => setSaved((s) => !s) };
    }
    if (mode === 'select') return { id: 'delete', label: 'Delete', Icon: Tri, onPress: () => note('delete ' + picked) };
    return undefined;
  }, [mode, saved, picked, note, dots]);
  const buy = useMemo(
    () => (mode === 'buy' ? { label: 'Add to cart', price: work.price, done: 'Added!', onPress: () => note('buy ' + work.name) } : undefined),
    [mode, work, note],
  );
  // A persistent field is on the band whatever the screen is doing, so it is
  // handed over in every mode and asks for search mode when it takes focus.
  const search = useMemo(
    () =>
      persist || mode === 'search'
        ? {
            value: query,
            placeholder: 'Search the collection…',
            onChange: setQuery,
            onSubmit: (q: string) => note('search:' + q),
            persistent: persist,
            onFocus: persist ? () => setMode('search') : undefined,
          }
        : undefined,
    [mode, query, note, persist],
  );
  const tools = useMemo<NavAction[]>(
    () => [
      { id: 'share', label: 'Share', Icon: Tri, onPress: () => note('tool:share') },
      { id: 'like', label: 'Like', Icon: Ring, active: liked, onPress: () => setLiked((s) => !s) },
      { id: 'more', label: 'More', Icon: Square, badge: dots ? true : 1, onPress: () => note('tool:more') },
    ],
    [liked, note, dots],
  );
  const select = useMemo(
    () => ({
      label: `${picked} selected`,
      onDone: () => {
        setPicked((n) => n + 1);
        leave('select done');
      },
    }),
    [picked, leave],
  );
  const confirm = useMemo(
    () => ({
      secondary: { label: 'Cancel', onPress: () => leave('confirm:cancel') },
      primary: { label: 'Apply filters', onPress: () => leave('confirm:apply') },
    }),
    [leave],
  );
  const metrics = useMemo(() => (small ? { slot: 44 } : undefined), [small]);
  // The app's own items: available in every mode, the way the guideline's
  // trailing edge keeps them, rather than something each screen re-supplies.
  const trailing = useMemo<NavAction[] | undefined>(
    () =>
      appItems
        ? [
            { id: 'saved', label: 'Saved', Icon: Heart, active: liked, onPress: () => setLiked((s) => !s) },
            { id: 'alerts', label: 'Notifications', Icon: Bell, badge: dots ? true : 4, onPress: () => note('alerts') },
            { id: 'more', label: 'More', Icon: Ellipsis, onPress: () => note('more') },
          ]
        : undefined,
    [appItems, liked, note, dots],
  );

  return (
    <>
      <div className="app">
        <header className="appbar">
          <div className="brand">
            <BarGlyph />
            <span className="brand__name">adaptive-nav</span>
            <span className="brand__note">a floating glass tab bar for React</span>
          </div>
          <button type="button" className="tune press" id="tune" aria-expanded={open} aria-controls="panel" onClick={() => setOpen((o) => !o)}>
            <TuneIcon />
            Playground
          </button>
        </header>

        <Sample onPick={pick} onOpen={openRoom} onTune={openTune} />
      </div>

      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden />}

      <aside className="panel" id="panel" data-open={open || undefined} aria-label="Playground" aria-hidden={!open}>
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Playground</h2>
            <p className="panel__sub">Drag across the tabs to scrub. Tap a card to open it.</p>
          </div>
          <button type="button" className="panel__close press" aria-label="Close the playground" onClick={() => setOpen(false)}>
            <CloseIcon />
          </button>
        </div>
        <div className="panel__body">
          <Section label="Scene" hint="what the screen shows">
            <Seg name="Scene" value={mode} options={SCENE_OPTIONS} onPick={setMode} idFor={(m) => `to-${m}`} wrap />
          </Section>

          <Section label="Placement" hint="top from 768 px">
            <Seg name="Placement" value={placement} options={PLACEMENTS} onPick={setPlacement} idFor={(p) => `placement-${p}`} />
          </Section>

          <Section label="Glass">
            <Seg
              name="Glass preset"
              value={preset}
              options={PRESETS}
              onPick={(p) => {
                setPreset(p);
                setGlobalGlass(p);
              }}
              idFor={(p) => `glass-${p}`}
            />
            <Material />
          </Section>

          <Section label="Indicator">
            <Seg name="Indicator" value={indicator} options={INDICATORS} onPick={setIndicator} idFor={(s) => `ind-${s}`} />
          </Section>

          <Section label="Ink" hint="light or dark glass">
            <Seg name="Tone" value={tone} options={TONES} onPick={setTone} idFor={(t) => `tone-${t}`} />
            <div className="switches">
              <Switch id="dark" on={dark} onFlip={() => setDark((d) => !d)}>
                Dark page
              </Switch>
            </div>
          </Section>

          <Section label="Lens" hint="Chromium draws it">
            <Seg name="Lens quality" value={quality} options={QUALITIES} onPick={setQuality} idFor={(q) => `quality-${q}`} />
          </Section>

          <Section label="Options">
            <div className="switches">
              <Switch id="labelled" on={labelled} onFlip={() => setLabelled((l) => !l)}>
                Names under the icons
              </Switch>
              <Switch id="min" on={min} onFlip={() => setMin((m) => !m)}>
                Folded to the current section
              </Switch>
              <Switch id="small" on={small} onFlip={() => setSmall((s) => !s)}>
                Compact slot, 44 px
              </Switch>
              <Switch id="trailing" on={appItems} onFlip={() => setAppItems((a) => !a)}>
                App items on the trailing edge
              </Switch>
              <Switch id="persist" on={persist} onFlip={() => setPersist((p) => !p)}>
                Search field always on the band
              </Switch>
              <Switch id="dots" on={dots} onFlip={() => setDots((d) => !d)}>
                Badges as dots, not counts
              </Switch>
            </div>
          </Section>

          <Section label="Events">
            <pre id="log">{log.join('\n')}</pre>
          </Section>
        </div>
      </aside>

      <AdaptiveNav
        mode={mode}
        options={dots ? DOT_TABS : TABS}
        value={tab}
        indicator={indicator}
        tone={tone}
        quality={quality}
        placement={placement}
        title={title}
        onChange={(id) => {
          setTab(id);
          note('change:' + id);
        }}
        onBack={() => leave(mode === 'select' || mode === 'confirm' ? 'close' : 'back')}
        action={action}
        trailing={trailing}
        buy={buy}
        search={search}
        tools={tools}
        select={select}
        confirm={confirm}
        metrics={metrics}
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
