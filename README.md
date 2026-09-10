# @virag/adaptive-nav

A floating glass tab bar for mobile web apps, built with React and
[Motion](https://motion.dev). One pill holds the sections. On a pushed screen a
**Back** circle slides out from under the pill's left end, and the screen can
hang an **action** circle (bag, save, share…) off the right end. On a product
the pill itself becomes the **call to action**; on a search screen it becomes
the **search field**; for a full-screen gallery the whole cluster **hides**.

Every curve comes from one rule: the pill is a capsule, the circles share its
height, and anything inset inside it is concentric (radius − inset), so nothing
pinches at the corners. The slot size solves itself from the viewport width, so
the cluster fits a 320px phone without changing composition.

The material is nine numbers (base, opacity, blur, saturation, tint, tint
amount, rim, refraction, dispersion) with four named presets from frosted to
liquid, built in layers the way a slab of glass is: a lens that bends the
backdrop at the lip, frost that thins toward it, tint, and light on the edges.
The selected tab can be marked four ways, and the tab strip is scrubbable:
press and the indicator swells like a bubble, drag sideways and it follows the
finger, flick and it lands on the tab the finger was headed for.

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
| `search`  | the `search` field           | Back        | `action`, if any  |
| `hidden`  | slid off-screen, inert       | —           | —                 |

`search` focuses the field as the pill opens (synchronously, so iOS treats it
as part of the tap and raises the keyboard), lifts the bar above the on-screen
keyboard through the visual viewport, submits on Enter and leaves on Escape
through `onBack`. `hidden` keeps the tab layout underneath, so the bar returns
the shape it left; use it for a gallery or a player that wants the whole screen.

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
| `search`    | `SearchField`                 | `{ value, onChange, onSubmit?, placeholder?, label? }`; controlled |
| `minimized` | `boolean`                     |                                                              |
| `onExpand`  | `() => void`                  |                                                              |
| `glass`     | `GlassPreset \| Partial<GlassConfig>` | this bar's material, laid over the global one; see Glass |
| `indicator` | `'capsule' \| 'dot' \| 'glow' \| 'lift'` | how the selected tab is marked; default `capsule`  |
| `labels`    | `Partial<NavLabels>`          | `back`, `sections`, `done`, `search`, `clear`, `badge(n)`, `expandHint(label)` |
| `backIcon`  | `ReactNode`                   | replaces the built-in chevron                                |
| `metrics`   | `Partial<NavMetrics>`         | `slot`, `pad`, `gap`, `edge`, `buyInset`, `buyMaxWidth`      |
| `className` | `string`                      | added to the root                                            |

Icons are any component accepting `className`; they are sized to 25px by the
stylesheet and coloured with `currentColor`.

## Gestures

A tap highlights on pointer-down — the indicator swells a little and lights
up, like a pressed bubble — and commits on the click that follows, so a
keyboard activation shares the same path. Move the pointer sideways past 10px
and the indicator is grabbed instead: it tracks the finger through a stiff
spring (so it reads as weight, not a cursor), rubber-bands past either end, and
the tab under it previews as you go. Letting go projects the finger's own
velocity forward the way a scroll view does, tuned so a finger that was merely
moving stays on its slot and a real flick jumps one; the settle spring leaves
at the finger's speed so there is no seam between drag and animation. While it
travels the indicator stretches along its motion in proportion to its speed and
lands with one small wobble. Vertical movement is left to the page
(`touch-action: pan-y`). Buy, search, hidden and the minimized bar do not scrub.

## Glass

The material is a `GlassConfig`:

| knob         | range   | what it is                                                                 |
| ------------ | ------- | -------------------------------------------------------------------------- |
| `base`       | colour  | what the glass is made of, opaque: `#fff` for light glass, `#1c1c1e` smoked |
| `opacity`    | 0–1     | how much of the page the material covers                                   |
| `blur`       | px      | backdrop blur radius across the middle; with a lens it thins toward the lip |
| `saturate`   | ×       | backdrop saturation; 1.6 keeps colour alive under frost                    |
| `tint`       | colour  | the colour soaked into the material                                        |
| `tintAmount` | 0–1     | how deeply                                                                 |
| `rim`        | 0–1     | the lit lip, the sheen and the edge glow that read as thickness            |
| `refraction` | 0–1     | how much the backdrop bends at the rim (Chromium; see below)               |
| `dispersion` | 0–1     | colour fringing at the rim; two extra filter passes                        |

`GLASS_PRESETS` names four points in that space: `frosted` (the default),
`clear`, `liquid` and `solid`. A dark screen is any of them with
`base: '#1c1c1e'`. Set the material three ways:

```ts
import { setGlobalGlass, GLASS_PRESETS } from '@virag/adaptive-nav';

setGlobalGlass('liquid');                 // every bar on the page
setGlobalGlass({ tint: '#e0812e', tintAmount: 0.4 });   // patch what is there
```

```tsx
<AdaptiveNav glass="clear" … />           // this bar only
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
sitting on it like a sticker; with refraction it is a bubble with its own lens.

### How the glass is built

The pill is four layers, back to front, and so is each circle:

1. **Lens** — `backdrop-filter: url(#…)` on an SVG `feDisplacementMap`, only
   when `refraction` is above 0. This is what bends the backdrop at the lip.
2. **Frost** — the backdrop blur and saturation. With a lens it is masked
   thinner toward the lip (a per-size PNG the component rasterises), so the
   bend there stays crisp while the middle stays frosted.
3. **Tint** — the material's colour, and the drop shadow.
4. **Shine** — light on the slab: offset inner highlights that fall where the
   surface faces the light (the whole top lip, the crowns of the round ends,
   nothing on the sides), a fainter return on the far lip, a glow all round for
   the brightening glass shows at grazing angles, and a 1px gradient ring.

They are siblings, never nested: an element with a backdrop filter starts a new
backdrop root, and a filter inside it would see only the frost. The shine is
plain CSS and works everywhere; so does the frost and the tint.

### How the lens works

Real glass with a rounded edge bends light *inward*: trace a vertical ray into
a slab whose edge is a quarter-round, and at the lip itself the glass is paper
thin and bends nothing, a little way in the surface is steep and the ray is
thrown hardest toward the middle, and from there the tilt eases off to the
flat top. The displacement map follows that profile. Each map pixel encodes a
shift as red (x) and green (y) around 128; the shift is zero at the lip, peaks
12% of the way into a band that is 40% of the pill's height, decays to nothing
at the band's inner limit, and always points inward — which is also the only
direction a backdrop filter can look, since it sees nothing beyond its own
element. Just inside the lip the backdrop is compressed, then magnified; the
filter's scale is held at the limit where the rim would fold over and invert.
Dispersion runs the map three times at slightly different scales, keeps one
channel from each pass and adds them, so the rim fringes red on one side and
blue on the other.

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

All four ride the same spring, stretch with speed, and get the landing bounce;
only the capsule is a lens.

## Theme

Declare tokens on `:root` (or on `.anav` for one bar; the glass composites
resolve at `:root`, so for a per-bar material pass `glass` instead). The
material knobs and the composites they feed:

```css
:root {
  --anav-glass-base: #fff;                    /* knob: what the glass is made of */
  --anav-glass-opacity: 0.72;                 /* knob */
  --anav-glass: color-mix(in srgb, var(--anav-glass-base) calc(var(--anav-glass-opacity) * 100%), transparent);
  --anav-blur: 24px;                          /* knob */
  --anav-saturate: 180%;                      /* knob */
  --anav-glass-blur: blur(var(--anav-blur)) saturate(var(--anav-saturate));
  --anav-tint: #5433eb;                       /* knob */
  --anav-tint-amount: 0;                      /* knob */
  --anav-rim: 0.5;                            /* knob: lit lip, sheen and glow; 0 turns them off */
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
`--anav-r-outer`, `--anav-r-inner`, `--anav-keyboard` (the on-screen keyboard's
height in search mode) and the lens references (`--anav-refract-*`,
`--anav-frost-mask-*`) on its root; read the geometry ones if you nest
something that has to share the bar's radii.

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
- The search field is a real `<input type="search">` with an accessible name
  (`search.label` or `labels.search`); the clear button is named `labels.clear`.
- A hidden bar is `inert` and `aria-hidden`, so nothing in it can be reached.
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

The playground opens on the `liquid` preset and has every mode, dark, slot 44
and minimized, the four glass presets, the four indicator styles, and a slider
for each glass knob (the sliders call `setGlobalGlass`, so they are the global
option). It scrolls a busy page under the bar — tiles, stripes, a grid — so the
material has something to blur, tint and bend. It loads only the package
stylesheet, so anything that looks wrong there is the package's fault, not a
host's.
