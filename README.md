# @virag/adaptive-nav

MIT licensed. Free to use in anything.

A floating glass tab bar for web apps, built with React and
[Motion](https://motion.dev). One pill holds the sections. On a pushed screen a
**Back** circle slides out from under the pill's left end, and the screen can
hang an **action** circle (bag, save, share…) off the right end. On a product
the pill itself becomes the **call to action**; on a search screen it becomes
the **search field**; on a detail screen it holds the screen's own **toolbar**;
in a selection it shows the **count and Done**; under a sheet it asks for the
**decision**; for a full-screen gallery the whole cluster **hides**.

The bar reads what it floats over: above dark content it turns to dark glass
with white ink, and back again over light content, on its own.

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

The package ships TypeScript source, not a build, and depends only on React
and Motion as peers. Two ways to use it:

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
| `toolbar` | the `tools`, in the slots    | Back        | `action`, if any  |
| `select`  | `select` count and Done      | Close       | `action`, if any  |
| `confirm` | `confirm` secondary, primary | Close       | `action`, if any  |
| `hidden`  | slid off-screen, inert       | —           | —                 |

`search` focuses the field as the pill opens (synchronously, so iOS treats it
as part of the tap and raises the keyboard), lifts the bar above the on-screen
keyboard through the visual viewport, submits on Enter and leaves on Escape
through `onBack`. `toolbar` puts the screen's own actions where the tabs were,
each a plain button with press feedback, a toggle state (`active`) and a badge;
the pill is as wide as its tools, and there is no indicator because nothing is
selected. `select` is a session: the left circle becomes Close (a cross), the
pill shows the count and a Done button, and the action circle carries what to
do with the selection (delete, share). `confirm` is a sheet's decision: Close
on the left, a quiet secondary and the accent primary side by side. `hidden`
keeps the tab layout underneath, so the bar returns the shape it left; use it
for a gallery or a player that wants the whole screen. Every wide mode grows
from nothing as the pill widens and is inert while it is not the mode.

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
| `tools`     | `NavAction[]`                 | the toolbar's buttons: `{ id, label, Icon, badge?, active?, onPress }` |
| `select`    | `SelectSession`               | `{ label, done?, onDone }`                                   |
| `confirm`   | `ConfirmActions`              | `{ primary: { label, onPress }, secondary?: { label, onPress } }` |
| `minimized` | `boolean`                     |                                                              |
| `onExpand`  | `() => void`                  |                                                              |
| `glass`     | `GlassPreset \| Partial<GlassConfig>` | this bar's material, laid over the global one; see Glass |
| `indicator` | `'capsule' \| 'dot' \| 'glow' \| 'lift'` | how the selected tab is marked; default `capsule`  |
| `tone`      | `'auto' \| 'light' \| 'dark'` | which way the bar faces; default `auto` reads the page (see Tone) |
| `quality`   | `'auto' \| 'full' \| 'edges' \| 'off'` | how much lens the device is asked for; default `auto` (see Performance) |
| `labelled`  | `boolean`                     | print each section's and tool's name under its glyph         |
| `placement` | `'auto' \| 'bottom' \| 'top'` | where the bar lives; default `auto` switches on width (see Placement) |
| `title`     | `string`                      | the view's title, leading at regular width, under 15 characters; a selection's count stands in |
| `labels`    | `Partial<NavLabels>`          | `back`, `close`, `tools`, `selectDone`, `sections`, `done`, `search`, `clear`, `badge(n)`, `expandHint(label)` |
| `backIcon`  | `ReactNode`                   | replaces the built-in chevron                                |
| `metrics`   | `Partial<NavMetrics>`         | `slot`, `pad`, `gap`, `edge`, `buyInset`, `buyMaxWidth`      |
| `className` | `string`                      | added to the root                                            |

Icons are any component accepting `className`; they are sized to 25px by the
stylesheet and coloured with `currentColor`.

## Placement

On a phone the bar floats at the bottom, within reach of the thumb. At
regular width — an iPad, a Mac window, anything 768 CSS px or wider — Apple's
Human Interface Guidelines put the tab bar "near the top of the screen", with
"the icons and labels side by side", sharing one band with the toolbar: Back
and Close on the leading edge, the tabs in the centre, "an optional search
field" and "a primary action like Done" on the trailing edge, and only one
primary action. `placement="auto"` (the default) does exactly that, switching
on width rather than device, because Safari on an iPad reports itself as a
Mac and the guideline's own model is compact versus regular size class.
`placement="bottom"` or `"top"` pins it.

At the top the cluster is a row of glass sections, grouped the way the
guideline's *Item groupings* section orders a toolbar:

| edge     | sections, in order                                                              |
| -------- | ------------------------------------------------------------------------------- |
| leading  | Back or Close, "at the far leading edge"; then the title, its own section       |
| centre   | the tabs, glyph beside name, one cell width                                     |
| trailing | the symbol actions together in one section; the search field; the quiet secondary; last, the one prominent action, its whole section tinted |

| mode      | leading           | trailing                                  |
| --------- | ----------------- | ----------------------------------------- |
| `tabs`    | —                 | —                                         |
| `context` | Back, title       | the action                                |
| `buy`     | Back, title       | the action; the call to action, prominent |
| `search`  | Back              | the action; the field                     |
| `toolbar` | Back, title       | the tools and the action, one section     |
| `select`  | Close, the count  | the action; Done, prominent               |
| `confirm` | Close, title      | Cancel, quiet; the primary, prominent     |
| `hidden`  | slides off the top edge                                       |

Each section is its own glass body with fixed space between, which is what
the guideline asks for between a symbol and a text button and between two
text buttons. Actions are plain symbols with no bezel, since "the section
provides a visible container". There is exactly one prominent action, last
on the trailing edge, "so there's a clear focal point". The count is a title,
not an action, so it sits after Close. The tabs stay through every mode.

The band never overflows. The guideline leaves overflow menus to the system
and asks for layouts that do not need one, and it has the centre give way
before the edges: names beside glyphs while the cells fit the window, glyphs
alone when they do not, the title only after that, narrower cells last. The
pill shifts to centre the whole cluster, since the two edges rarely weigh the
same. All of it is measured from stand-ins before paint, and only sections
that are staying are counted, so a section on its way out never flickers the
fit. The band's edges are pinned to the window's margins and the tabs are
centred between them, as the guideline draws a toolbar. Every cell is one
width, the widest name's, which is what lets the capsule, the scrub and the
magnet keep the arithmetic of a compact pill.

### Sizes

Checked against the guideline's one hard number, "a hit region of at least
44x44 pt", and the platforms' own bars (an iOS tab bar is 49 pt, a toolbar
44 pt, a Mac's unified toolbar 52 pt with controls near 30 pt):

| | phone | iPad (touch) | Mac (pointer) |
| --- | --- | --- | --- |
| pill or section | 54 px | 48 px | 44 px |
| indicator cell | 46 px | 40 px | 36 px |
| hit region | 54 × 46 | 48 × cell | 44 × cell |
| circles | 54 px | 48 px | 44 px |
| symbols | 24 px | 20 px | 18 px |
| name | 10 px, under | 13 px, beside | 13 px, beside |

Every slot is hit-tested at the pill's full height, so the hit region never
falls under 44 px even where the visible cell does. A trackpad beside a
touch screen still counts as touch; only a pointer with no touch at all gets
the Mac scale. `minimized` has no effect at the top, where the
guideline asks that the tab bar stay visible.

**macOS.** "The toolbar resides in the frame at the top of a window" and
"window titles can display inline with controls": the band and its title.
"Toolbar items don't include a bezel": symbols in sections. A pointer gets
the hover states a Mac expects, a light fill within the section, only under
`(hover: hover) and (pointer: fine)`, so a finger never sees a stuck hover.
"Make every toolbar item available as a command in the menu bar" has no web
equivalent; every item is a real button, so it is reachable from the
keyboard, and the tabs answer arrow keys. Toolbar customization is not
offered.

## Tone

Over light content the bar is light glass with dark ink; over dark content it
is dark glass with white ink — the sections, the search field and its
placeholder, the circles, the count, all of it. With `tone="auto"` (the
default) the bar decides for itself. A page's pixels cannot be read, so the
bar asks the DOM what is painted at twelve points under the pill and the
circles — background colours, gradients averaged from their stops, same-origin
images read through a canvas — composites them top to bottom, takes the mean
perceived lightness (CIE L\*), and flips with hysteresis: dark below 45, light
again only above 55, so a boundary never flickers. It samples on scroll and
resize, on every mode change, and on a slow timer for everything else (a
screen fading in, an image finishing its load). Colours ease over 200–300ms.

Pass `tone="light"` or `tone="dark"` to pin it. What the dark face is made of
is yours to set:

```css
:root {
  --anav-glass-base-dark: #1c1c1e;             /* the material over dark content */
  --anav-fg-dark: #fff;
  --anav-fg-muted-dark: rgb(255 255 255 / 0.6);
  --anav-indicator-dark: rgb(255 255 255 / 0.18);
  --anav-solid-dark: #1c1c1e;
}
```

The material knob is `baseDark` in `GlassConfig` (`setGlobalGlass({ baseDark: '#101014' })`).
Set it equal to `base` to keep the glass light and flip only the ink.

What it cannot read: cross-origin images without CORS (`crossorigin="anonymous"`
and a permitting server fix that), video, canvas, and `background-image: url()`.
Where fewer than half the sample points are readable the bar keeps the tone it
has; if a screen is built from such content, pin the tone for it.

## Performance

Every backdrop layer is a read of the page beneath it, filtered and painted
back, on every frame in which anything under it moves. That is the cost that
matters on a phone, and it is paid on the compositor and the GPU, not the main
thread, so a frame counter will not show it. What can be counted is layers
and passes:

| view, liquid preset | before | now, `full` | now, `edges` | now, `off` |
| ------------------- | ------ | ----------- | ------------ | ---------- |
| tabs                | 3      | 2           | 1            | 1          |
| context (two circles) | 7    | 4           | 3            | 3          |

Three things got it there. On Chromium the frost and the lens of a shape are
one SVG filter on one layer (blur, saturation, the rim mask and the bend, with
`edgeMode="duplicate"` so the blur does not fade at the lip), where they were
a CSS blur layer and a lens layer before. Dispersion, which triples the bend,
runs on the pill alone. And `quality` decides per device: `auto` gives `full`
to a capable Chromium, `edges` (the pill's rim in one pass, circles and bubble
as plain frost) to one reporting four gigabytes or four cores or fewer, and
`off` where SVG backdrop filters do not render or transparency is reduced. On
an M1 the GPU process spends about a millisecond a frame on any of these; the
difference will show on a mid-range Android, which is where `auto` earns its
keep. Every animated property is a transform, an opacity or a filter, except
the pill's width, which lays out.

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
travels the indicator stretches along its motion in proportion to its speed,
the glyphs it passes lean toward it and swell a little beneath it (a magnet
on the compositor, no render in between), and when it lands it settles with
one small wobble and sends out a faint ring. Vertical movement is left to the
page (`touch-action: pan-y`). The wide modes, the toolbar, hidden and the
minimized bar do not scrub.

Elsewhere: a segment filling the pill materialises — sharpens from a blur as
it scales up — rather than fading; a badge pops when its count changes; the
hidden bar shrinks a little as it leaves; circles come out of the pill
squashed along the pull. All of it steps aside for `prefers-reduced-motion`.

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
2. **Frost** — the backdrop blur and saturation. Inside the lens filter it is
   masked thinner toward the lip (a per-size PNG the component rasterises), so
   the bend there stays crisp while the middle stays frosted. Without a lens
   it is uniform to the edge: a crisp ring with no bend to explain it reads as
   a cut-out.
3. **Tint** — the material's colour, and the drop shadow.
4. **Edge** — the light that gets into the slab: broad, soft, from above and
   fainter from below, blended `soft-light` so it lifts what is beneath rather
   than painting over it. Where a lens is bending for real it steps back.
5. **Shine** — light on the lip: an inset highlight offset away from the light,
   so it is widest where the surface faces the light (the crown of the top edge
   and of the round ends) and tapers to nothing at the sides, with a fainter
   return on the far lip. Nothing runs all the way round. A ring of any weight,
   however faint, reads as a stroke, and glass has no stroke; the first version
   had three and looked drawn.

They are siblings, never nested: an element with a backdrop filter starts a new
backdrop root, and a filter inside it would see only the frost. The edge and
the shine are plain CSS and work everywhere; so do the frost and the tint.

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

### Safari and everything that is not Chromium

Only Chromium applies an SVG filter to a backdrop. Safari parses
`backdrop-filter: url()` and `CSS.supports` says yes, but nothing renders, so
there is no feature test; instead the bar looks for `navigator.userAgentData`,
a Chromium-only API whose brands say "Chromium" outright, and renders no lens
layer anywhere else. What WebKit gets, and what was verified in Playwright's
WebKit build at a phone viewport: the frost, uniform to the edge; the tint;
the edge light and the lip highlight, both directional, both plain paint; and
the tone sampler, which reads colours back through a one-pixel canvas because
WebKit's `fillStyle` getter hands modern colour syntax back unparsed. One
backdrop layer per shape. Tap and pointer scrub work there; frames stay under
20 ms while scrolling. Firefox was not tested and is treated as not Chromium.

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
height in search mode) and the lens references (`--anav-refract-*`) on its
root; read the geometry ones if you nest something that has to share the
bar's radii.

## Layout helpers

`solveSlot`, `capsuleRadii`, `pillWidth`, `indicatorBox` and `DEFAULT_METRICS`
are exported so a host can compute the bar's footprint without rendering it —
for a sheet that has to clear it, say. The bar's height is `slot + 2 · pad`
(54px at the default slot). `glassVars`, `resolveGlass`, `GLASS_PRESETS` and
`DEFAULT_GLASS` do the same for the material.

## Accessibility

- Tabs are a `tablist`; arrow keys, Home and End move the selection and focus.
- Back and the action circle are plain buttons with `aria-label`; toggles set `aria-pressed`.
- Badges render a visually hidden count (`labels.badge`).
- The buy confirmation is announced through a polite live region.
- The search field is a real `<input type="search">` with an accessible name
  (`search.label` or `labels.search`); the clear button is named `labels.clear`.
- The toolbar is a `toolbar` of plain buttons; toggles set `aria-pressed`. The
  selection count is a polite live region. The left circle is named `labels.close`
  in `select` and `confirm`.
- A hidden bar is `inert` and `aria-hidden`, so nothing in it can be reached,
  and so is every wide-mode segment that is not the current mode.
- White ink over dark glass and dark ink over light glass are chosen for
  contrast, not decoration; pin `tone` if a screen's content defeats the sampler.
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

The playground is a small sample app — a hero, a shelf of cards, a near-black
room, a list, and a stripes-and-grid lens test — with the controls in an
inspector behind the **Playground** button. Tapping a card puts the bar in
`buy` mode with that card's price; tapping a row pushes a screen; scrolling
the dark room under the bar is what makes the ink turn. The inspector holds
every mode, the three placements, a dark page, slot 44, minimized and
labelled, the three tone settings, the four quality settings, the four glass
presets, the four indicator styles, and a slider for each glass knob (the
sliders call `setGlobalGlass`, so they are the global option).

The page has its own stylesheet and never writes a rule that touches `.anav`,
so anything that looks wrong on the bar there is the package's fault, not a
host's.
