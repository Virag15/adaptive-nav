# @virag/adaptive-nav

A floating glass tab bar for mobile web apps, built with React and
[Motion](https://motion.dev). One pill holds the sections. On a pushed screen a
**Back** circle slides out from under the pill's left end, and the screen can
hang an **action** circle (bag, save, share…) off the right end. On a product
the pill itself becomes the **call to action**.

Every curve comes from one rule: the pill is a capsule, the circles share its
height, and anything inset inside it is concentric (radius − inset), so nothing
pinches at the corners. The slot size solves itself from the viewport width, so
the cluster fits a 320px phone without changing composition.

The material is nine numbers (base, opacity, blur, saturation, tint, tint
amount, rim, refraction, dispersion) with six named presets from frosted to
liquid; the selected tab can be marked four ways; and the tab strip is
scrubbable: drag sideways and the indicator follows the finger, flick and it
lands on the tab the finger was headed for.

The folder is self-contained: `react`, `react-dom` and `motion` are the only
peer dependencies, and the stylesheet carries its own resets and theme tokens.

## Install

The package lives at `Delta System-Dev/adaptive-nav` and ships TypeScript
source, not a build. Two ways to use it:

**Link it**, so edits here show up in the app with hot reload:

```json
// the app's package.json
{ "dependencies": { "@virag/adaptive-nav": "file:../adaptive-nav" } }
```

```sh
npm install     # creates node_modules/@virag/adaptive-nav -> ../adaptive-nav
```

Because the folder sits outside the app and carries its own dev dependencies,
tell the toolchain to use the app's React and Motion and to serve files from
the linked folder:

```ts
// vite.config.ts
import { defineConfig, searchForWorkspaceRoot } from 'vite';

export default defineConfig({
  resolve: { dedupe: ['react', 'react-dom', 'motion'] },
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), '../adaptive-nav'] } },
});
```

```json
// tsconfig.json → compilerOptions
{ "preserveSymlinks": true }
```

**Or copy the folder** into the project and drop `demo/`, `vite.config.ts` and
the dev dependencies. It is then ordinary source and needs none of the above.

Vite, Remix, Astro and similar bundlers compile the TypeScript as-is. Next.js
needs `transpilePackages: ['@virag/adaptive-nav']` in `next.config.js`.

The stylesheet declares `-webkit-backdrop-filter` *before* `backdrop-filter`
on purpose: lightningcss (Vite's CSS minifier) keeps only the last of the pair
when it has no browser targets, and the unprefixed one is what every current
browser reads. Keep that order if you copy the glass recipe elsewhere.

## Use

```tsx
import { AdaptiveNav, type NavAction, type NavMode, type TabOption } from '@virag/adaptive-nav';
import '@virag/adaptive-nav/styles.css';

const TABS: TabOption[] = [
  { id: 'home', label: 'Home', Icon: IconHome },
  { id: 'search', label: 'Search', Icon: IconSearch },
  { id: 'saved', label: 'Saved', Icon: IconHeart },
  { id: 'bag', label: 'Bag', Icon: IconBag, badge: 2 },
];

function App() {
  const [tab, setTab] = useState('home');
  const [stack, setStack] = useState<Route[]>([]);
  const top = stack.at(-1);

  const mode: NavMode = top?.kind === 'product' ? 'buy' : top ? 'context' : 'tabs';

  const action: NavAction | undefined =
    top?.kind === 'store'
      ? { id: 'save', label: 'Save store', Icon: IconHeart, active: saved, onPress: toggleSaved }
      : undefined;

  return (
    <>
      {/* …screens… */}
      <AdaptiveNav
        mode={mode}
        options={TABS}
        value={tab}
        onChange={(id) => { setStack([]); setTab(id); }}
        onBack={() => setStack((s) => s.slice(0, -1))}
        action={action}
        buy={top?.kind === 'product' ? { label: 'Add to bag', done: 'Added to bag', price: '₹96,400', onPress: addToBag } : undefined}
      />
    </>
  );
}
```

Wrap the app in `<MotionConfig reducedMotion="user">` so the springs honour
the system preference. Render the bar once, outside any `AnimatePresence` that
swaps screens, so each mode change is a spring from where the pill already is
rather than a remount.

## Modes

| mode      | pill                         | left circle | right circle      |
| --------- | ---------------------------- | ----------- | ----------------- |
| `tabs`    | all sections, indicator      | —           | —                 |
| `context` | all sections, indicator      | Back        | `action`, if any  |
| `buy`     | the `buy` call to action     | Back        | `action`, if any  |

`minimized` collapses the pill to the active section (fold it on scroll); any
tap or arrow key then calls `onExpand` instead of switching.

## Props

| prop        | type                          | notes                                                        |
| ----------- | ----------------------------- | ------------------------------------------------------------ |
| `mode`      | `'tabs' \| 'context' \| 'buy'` |                                                              |
| `options`   | `TabOption[]`                 | `{ id, label, Icon, badge? }` — icon-only, `label` is read aloud |
| `value`     | `string`                      | selected tab id                                              |
| `onChange`  | `(id) => void`                | on a pushed screen the current tab fires too (it is a way home) |
| `onBack`    | `() => void`                  | Back circle                                                  |
| `action`    | `NavAction`                   | `{ id, label, Icon, badge?, active?, onPress }`; change `id` to crossfade |
| `buy`       | `BuyAction`                   | `{ label, price, done?, onPress }`                           |
| `minimized` | `boolean`                     |                                                              |
| `onExpand`  | `() => void`                  |                                                              |
| `glass`     | `GlassPreset \| Partial<GlassConfig>` | this bar's material, laid over the global one; see Glass |
| `indicator` | `'capsule' \| 'dot' \| 'glow' \| 'lift'` | how the selected tab is marked; default `capsule`  |
| `labels`    | `Partial<NavLabels>`          | `back`, `sections`, `done`, `badge(n)`, `expandHint(label)`  |
| `backIcon`  | `ReactNode`                   | replaces the built-in chevron                                |
| `metrics`   | `Partial<NavMetrics>`         | `slot`, `pad`, `gap`, `edge`, `buyInset`, `buyMaxWidth`      |
| `className` | `string`                      | added to the root                                            |

Icons are any component accepting `className`; they are sized to 25px by the
stylesheet and coloured with `currentColor`.

## Gestures

A tap highlights on pointer-down and commits on the click that follows, so a
keyboard activation shares the same path. Move the pointer sideways past 10px
and the indicator is grabbed instead: it tracks the finger through a stiff
spring (so it reads as weight, not a cursor), rubber-bands past either end, and
the tab under it previews as you go. Letting go projects the finger's velocity
forward the way a scroll view does, so a flick lands on the tab you were
throwing toward, and the settle spring leaves at the finger's speed so there is
no seam between drag and animation. While it travels the indicator stretches
along its motion in proportion to its speed. Vertical movement is left to the
page (`touch-action: pan-y`). Buy mode and the minimized bar do not scrub.

## Glass

The material is a `GlassConfig`:

| knob         | range   | what it is                                                                 |
| ------------ | ------- | -------------------------------------------------------------------------- |
| `base`       | colour  | what the glass is made of, opaque: `#fff` for light glass, `#1c1c1e` smoked |
| `opacity`    | 0–1     | how much of the page the material covers                                   |
| `blur`       | px      | backdrop blur radius                                                       |
| `saturate`   | ×       | backdrop saturation; 1.6 keeps colour alive under frost                    |
| `tint`       | colour  | the colour soaked into the material                                        |
| `tintAmount` | 0–1     | how deeply                                                                 |
| `rim`        | 0–1     | the lit lip and inner sheen that read as thickness                         |
| `refraction` | 0–1     | how much the backdrop bends at the rim (Chromium; see below)               |
| `dispersion` | 0–1     | colour fringing at the rim; two extra filter passes                        |

`GLASS_PRESETS` names six points in that space: `frosted` (the default),
`clear`, `liquid`, `tinted`, `smoke` and `solid`. Set the material three ways:

```ts
import { setGlobalGlass, GLASS_PRESETS } from '@virag/adaptive-nav';

setGlobalGlass('liquid');                 // every bar on the page
setGlobalGlass({ tint: '#e0812e', tintAmount: 0.4 });   // patch what is there
```

```tsx
<AdaptiveNav glass="smoke" … />           // this bar only
<AdaptiveNav glass={{ opacity: 0.5 }} … />   // this bar, over the global material
```

```css
:root { --anav-tint: #e0812e; --anav-tint-amount: 0.4; }   /* CSS alone, except refraction */
```

`setGlobalGlass` writes the tokens on `:root` and keeps a store the bars
subscribe to; `useGlass()` reads the current material. The store exists because
the refraction strength is an SVG attribute, which no CSS token can drive, so
refraction and dispersion have to come through JS.

Tint is mixed into the glass at the glass's own opacity, so soaking colour into
the material never makes it more opaque. The selection indicator is by default
a lighter piece of the same material, so it thins with the glass instead of
sitting on it like a sticker.

### Refraction: how the lens works

Real glass bends what passes through it, most visibly at the edge where the
surface curves away. On the web the only way to bend a backdrop is an SVG
filter: a second layer under the frosted one carries
`backdrop-filter: url(#…)` pointing at an `feDisplacementMap`, whose map is a
PNG the component rasterises per pill size. Each map pixel encodes a shift as
red (x) and green (y) around 128; the shift is zero across the middle, rises
quadratically through the outer third of the pill, and always points *inward*,
because a backdrop filter can only see the pixels under its own element and a
sample fetched from beyond the edge would come back empty. The scale is capped
where the rim would fold over and invert the image. Dispersion runs the map
three times at slightly different scales, keeps one channel from each pass and
adds them, so the rim fringes red on one side and blue on the other.

The lens layer is a *sibling* of the frosted layer, never a child: an element
with a backdrop filter starts a new backdrop root, and a filter inside it would
see only the frost. The rim (a 1px gradient lip drawn with a mask, a sheen
across the top, a shade along the bottom) is plain CSS and works everywhere.

Browser support is the caveat. Chromium applies SVG filters to a backdrop and
is where this was verified (the pill's pixels change only inside its own
extent when refraction is toggled). Safari parses `backdrop-filter: url()` but
does not render it, and `CSS.supports` says yes, so there is no feature test;
the lens layer simply draws nothing there and the rim carries the glass. Firefox
was not tested. The stylesheet keeps the lens on its own layer for exactly this
reason: a browser that drops the declaration loses the lens, never the blur.

## Indicator styles

| `indicator` | the mark                                                             |
| ----------- | -------------------------------------------------------------------- |
| `capsule`   | the travelling glass capsule (default)                               |
| `dot`       | a 5px accent point under the glyph, which takes the accent           |
| `glow`      | a pool of accent light behind the glyph                              |
| `lift`      | no mark; the selected glyph rises and takes the accent               |

All four ride the same spring, stretch with speed, and get the landing bounce.

## Theme

Declare tokens on `:root` (or on `.anav` for one bar; the glass composites
resolve at `:root`, so for a per-bar material pass `glass` instead). The
material knobs and the composites they feed:

```css
:root {
  --anav-glass-base: #fff;                    /* knob: what the glass is made of */
  --anav-glass-opacity: 0.88;                 /* knob */
  --anav-glass: color-mix(in srgb, var(--anav-glass-base) calc(var(--anav-glass-opacity) * 100%), transparent);
  --anav-blur: 20px;                          /* knob */
  --anav-saturate: 160%;                      /* knob */
  --anav-glass-blur: blur(var(--anav-blur)) saturate(var(--anav-saturate));
  --anav-tint: #5433eb;                       /* knob */
  --anav-tint-amount: 0;                      /* knob */
  --anav-rim: 0.35;                           /* knob: lit lip and sheen, 0 turns them off */
  --anav-solid: #fff;                         /* surface under prefers-reduced-transparency */
}
```

Set a composite (`--anav-glass`, `--anav-glass-blur`) directly to take full
control of it, as before; the knobs then no longer feed it. The rest of the
palette:

```css
:root {
  --anav-fg: #0b0b0c;                         /* active icon, Back, action */
  --anav-fg-muted: #8a8a8f;                   /* inactive icons */
  --anav-indicator: …;                        /* travelling selection; defaults to lighter glass */
  --anav-indicator-solid: rgb(120 120 128 / 0.14);
  --anav-accent: #5433eb;                     /* buy CTA, focus ring, dot/glow/lift indicators */
  --anav-accent-fg: #fff;
  --anav-on: #ff3b30;                         /* toggled action (saved) */
  --anav-badge: #ff3b30;
  --anav-badge-fg: #fff;
  --anav-shadow: …;
  --anav-bottom: 14px;                        /* plus the safe-area inset */
  --anav-z: 40;
  --anav-ease: cubic-bezier(0.23, 1, 0.32, 1);
}
```

A dark theme is `--anav-glass-base: #1c1c1e` (or `setGlobalGlass({ base: '#1c1c1e' })`)
plus `--anav-fg: #fff; --anav-fg-muted: rgb(255 255 255 / 0.55); --anav-indicator: rgb(255 255 255 / 0.16); --anav-solid: #1c1c1e;`.

The component writes `--anav-slot`, `--anav-sat`, `--anav-pad`, `--anav-gap`,
`--anav-r-outer`, `--anav-r-inner` and the lens references
`--anav-refract-pill`, `--anav-refract-circle` on its root; read the geometry
ones if you nest something that has to share the bar's radii.

## Layout helpers

`solveSlot`, `capsuleRadii`, `pillWidth`, `indicatorBox` and `DEFAULT_METRICS`
are exported so a host can compute the bar's footprint without rendering it —
for a sheet that has to clear it, say. The bar's height is `slot + 2 · pad`
(64px at the default slot). `glassVars`, `resolveGlass`, `GLASS_PRESETS` and
`DEFAULT_GLASS` do the same for the material.

## Accessibility

- Tabs are a `tablist`; arrow keys, Home and End move the selection and focus.
- Back and the action circle are plain buttons with `aria-label`; toggles set `aria-pressed`.
- Badges render a visually hidden count (`labels.badge`).
- The buy confirmation is announced through a polite live region.
- `prefers-reduced-motion` drops the travel, the stretch and the landing
  bounce and keeps the feedback; a scrub still works, the indicator just
  arrives without travelling. `prefers-reduced-transparency` makes the glass
  solid and removes the lens; `prefers-contrast: more` adds a hard edge and
  removes the rim and lens.

## Develop

```sh
npm install
npm run dev         # playground at http://localhost:4321
npm run check       # tsc (strict) + node --test on geometry, glass and the lens map
```

The playground has every mode, dark, slot 44 and minimized, the six glass
presets, the four indicator styles, and a slider for each glass knob (the
sliders call `setGlobalGlass`, so they are the global option). It scrolls a
busy page under the bar — tiles, stripes, a grid — so the material has
something to blur, tint and bend. It loads only the package stylesheet, so
anything that looks wrong there is the package's fault, not a host's.
