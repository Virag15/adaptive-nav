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

/* ---------- Icons for the bar; static, so they never rebuild ---------- */

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

const SCENES: { mode: NavMode; name: string; what: string }[] = [
  { mode: 'tabs', name: 'Home', what: 'sections' },
  { mode: 'context', name: 'Store', what: 'Back, Save' },
  { mode: 'buy', name: 'Product', what: 'Add to bag' },
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

/* ---------- The store ---------- */

type Piece = { name: string; price: string; stone: string; jewel: string };
const FEATURED: Piece = { name: 'Cushion cut', price: '₹2,10,000', stone: 'garnet', jewel: 'stone' };
const NEW_THIS_WEEK: Piece[] = [
  { name: 'Solitaire ring', price: '₹96,400', stone: 'garnet', jewel: 'ring' },
  { name: 'Tennis bracelet', price: '₹1,84,000', stone: 'sapphire', jewel: 'chain' },
  { name: 'Polki drops', price: '₹58,200', stone: 'emerald', jewel: 'drops' },
  { name: 'Pearl strand', price: '₹42,900', stone: 'amethyst', jewel: 'pearls' },
  { name: 'Signet ring', price: '₹31,500', stone: 'citrine', jewel: 'ring' },
  { name: 'Rope chain', price: '₹1,02,000', stone: 'sapphire', jewel: 'chain' },
];
const IN_THE_ROOM: Piece[] = [
  { name: 'Estate solitaire', price: '₹3,40,000', stone: 'garnet', jewel: 'stone' },
  { name: 'Cuban chain', price: '₹1,12,000', stone: 'sapphire', jewel: 'chain' },
  { name: 'Baroque pearls', price: '₹66,000', stone: 'emerald', jewel: 'pearls' },
  { name: 'Amethyst drops', price: '₹48,500', stone: 'amethyst', jewel: 'drops' },
];
const COLLECTIONS: { name: string; count: string; stone: string; jewel: string }[] = [
  { name: 'Bridal', count: '48 pieces', stone: 'garnet', jewel: 'drops' },
  { name: 'Everyday gold', count: '120 pieces', stone: 'citrine', jewel: 'chain' },
  { name: 'Stones', count: '36 pieces', stone: 'amethyst', jewel: 'stone' },
  { name: 'Pearls', count: '22 pieces', stone: 'sapphire', jewel: 'pearls' },
];

const Chevron = () => (
  <svg className="row__chevron" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 3.5 4.5 4.5L6 12.5" />
  </svg>
);

function Case({ piece, index, onPick }: { piece: Piece; index: number; onPick: (p: Piece) => void }) {
  return (
    <button
      type="button"
      className={`case tile rise press case--${piece.stone}`}
      style={{ ['--i' as string]: index }}
      onClick={() => onPick(piece)}
      aria-label={`${piece.name}, ${piece.price}`}
    >
      <span className="case__satin" aria-hidden>
        <span className={`jewel jewel--${piece.jewel}`} />
      </span>
      <span className="case__label">
        <span className="case__name">{piece.name}</span>
        <span className="case__price">{piece.price}</span>
      </span>
    </button>
  );
}

/**
 * The store never changes while the bar is tuned, so it renders once and is
 * left alone: the inspector's sliders re-render only themselves.
 */
const Store = memo(function Store({ onPick, onOpen }: { onPick: (p: Piece) => void; onOpen: (name: string) => void }) {
  return (
    <>
      <button type="button" className="feature press" onClick={() => onPick(FEATURED)}>
        <span className="feature__jewel" aria-hidden>
          <span className="jewel jewel--stone" style={{ width: '100%' }} />
        </span>
        <span className="feature__eyebrow">Autumn edit</span>
        <span className="feature__title">Stones of the season</span>
        <span className="feature__cta">Shop the edit</span>
      </button>

      <section className="shelf stage">
        <div className="shelf__head">
          <h2 className="shelf__title">New this week</h2>
          <span className="shelf__note">Tap a piece to open it</span>
        </div>
        <div className="cases">
          {NEW_THIS_WEEK.map((p, i) => (
            <Case key={p.name} piece={p} index={i} onPick={onPick} />
          ))}
        </div>
      </section>

      <section className="velvet shelf" id="band">
        <div className="shelf__head">
          <h2 className="shelf__title">The velvet room</h2>
          <span className="shelf__note">Over dark ground the bar turns</span>
        </div>
        <div className="cases">
          {IN_THE_ROOM.map((p, i) => (
            <Case key={p.name} piece={p} index={i} onPick={onPick} />
          ))}
        </div>
      </section>

      <section className="shelf stage">
        <div className="shelf__head">
          <h2 className="shelf__title">Collections</h2>
          <span className="shelf__note">Opens a store screen</span>
        </div>
        <div className="rows">
          {COLLECTIONS.map((c) => (
            <button key={c.name} type="button" className={`row case--${c.stone}`} onClick={() => onOpen(c.name)}>
              <span className="row__swatch" aria-hidden>
                <span className={`jewel jewel--${c.jewel}`} />
              </span>
              <span className="row__name">{c.name}</span>
              <span className="row__count">{c.count}</span>
              <Chevron />
            </button>
          ))}
        </div>
      </section>

      <section className="shelf stage lens">
        <div className="shelf__head">
          <h2 className="shelf__title">Lens test</h2>
          <span className="shelf__note">Straight lines show the bend</span>
        </div>
        <div className="stripes" />
        <div className="grid" />
        <p className="copy">
          Park the bar over the stripes. The frost blurs the middle, the lens bends the rim inward, and with dispersion
          the bend splits into colour. Only Chromium draws the lens; elsewhere the frost, the tint and the lit lip carry
          the glass.
        </p>
      </section>

      <footer className="colophon">
        Every preset is the same nine numbers. Every curve comes from one rule: the pill is a capsule, the circles share
        its height, and anything inset is concentric. The page never styles the bar.
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
  const [dark, setDark] = useState(false);
  const [tone, setTone] = useState<ToneSetting>('auto');
  const [quality, setQuality] = useState<Quality>('auto');
  const [placement, setPlacement] = useState<PlacementSetting>('auto');
  const [preset, setPreset] = useState<GlassPreset>(FIRST_PRESET);
  const [indicator, setIndicator] = useState<IndicatorStyle>('capsule');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(3);
  const [piece, setPiece] = useState<Piece>(FEATURED);
  const [store, setStore] = useState('Store');
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
    (p: Piece) => {
      setPiece(p);
      setMode('buy');
      note('open ' + p.name);
    },
    [note],
  );
  const openStore = useCallback(
    (name: string) => {
      setStore(name);
      setMode('context');
      note('store ' + name);
    },
    [note],
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  // The stylesheet reflows the store beside a docked inspector on wide screens.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-inspector', open);
  }, [open]);

  const title = mode === 'buy' ? piece.name : mode === 'context' ? store : TITLES[mode];

  // The bar's own props are objects; keeping them stable keeps its render cheap.
  const action = useMemo<NavAction | undefined>(() => {
    if (mode === 'context' || mode === 'buy' || mode === 'search' || mode === 'toolbar') {
      return { id: 'save', label: 'Save', Icon: Dot, active: saved, badge: 2, onPress: () => setSaved((s) => !s) };
    }
    if (mode === 'select') return { id: 'delete', label: 'Delete', Icon: Tri, onPress: () => note('delete ' + picked) };
    return undefined;
  }, [mode, saved, picked, note]);
  const buy = useMemo(
    () => (mode === 'buy' ? { label: 'Add to bag', price: piece.price, done: 'Added!', onPress: () => note('buy ' + piece.name) } : undefined),
    [mode, piece, note],
  );
  const search = useMemo(
    () => (mode === 'search' ? { value: query, placeholder: 'Search rings, chains…', onChange: setQuery, onSubmit: (q: string) => note('search:' + q) } : undefined),
    [mode, query, note],
  );
  const tools = useMemo<NavAction[]>(
    () => [
      { id: 'share', label: 'Share', Icon: Tri, onPress: () => note('tool:share') },
      { id: 'like', label: 'Like', Icon: Ring, active: liked, onPress: () => setLiked((s) => !s) },
      { id: 'more', label: 'More', Icon: Square, badge: 1, onPress: () => note('tool:more') },
    ],
    [liked, note],
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

  return (
    <>
      <div className="app">
        <header className="appbar">
          <div className="brand">
            <span className="brand__mark">SKK</span>
            <span className="brand__name">Jewellers</span>
          </div>
          <button type="button" className="tune press" id="tune" aria-expanded={open} aria-controls="panel" onClick={() => setOpen((o) => !o)}>
            <TuneIcon />
            Playground
          </button>
        </header>

        <Store onPick={pick} onOpen={openStore} />
      </div>

      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden />}

      <aside className="panel" id="panel" data-open={open || undefined} aria-label="Playground" aria-hidden={!open}>
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Playground</h2>
            <p className="panel__sub">Drag across the tabs to scrub. Tap a piece to open it.</p>
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
            </div>
          </Section>

          <Section label="Events">
            <pre id="log">{log.join('\n')}</pre>
          </Section>
        </div>
      </aside>

      <AdaptiveNav
        mode={mode}
        options={TABS}
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
