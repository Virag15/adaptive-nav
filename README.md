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
| `labels`    | `Partial<NavLabels>`          | `back`, `sections`, `done`, `badge(n)`, `expandHint(label)`  |
| `backIcon`  | `ReactNode`                   | replaces the built-in chevron                                |
| `metrics`   | `Partial<NavMetrics>`         | `slot`, `pad`, `gap`, `edge`, `buyInset`, `buyMaxWidth`      |
| `className` | `string`                      | added to the root                                            |

Icons are any component accepting `className`; they are sized to 25px by the
stylesheet and coloured with `currentColor`.

## Theme

Declare tokens on `:root` (or on `.anav` for one bar). The defaults are a light
tinted glass; these are the ones you will usually map to your design system:

```css
:root {
  --anav-glass: rgb(255 255 255 / 0.88);      /* surface */
  --anav-glass-blur: blur(20px) saturate(160%);
  --anav-solid: #fff;                         /* surface under prefers-reduced-transparency */
  --anav-fg: #0b0b0c;                         /* active icon, Back, action */
  --anav-fg-muted: #8a8a8f;                   /* inactive icons */
  --anav-indicator: #fff;                     /* travelling selection */
  --anav-indicator-solid: rgb(120 120 128 / 0.14);
  --anav-accent: #5433eb;                     /* buy CTA and focus ring */
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

A dark theme is the same tokens with dark values, for example
`--anav-glass: rgb(28 28 30 / 0.82); --anav-fg: #fff; --anav-fg-muted: rgb(255 255 255 / 0.55); --anav-indicator: rgb(255 255 255 / 0.16); --anav-solid: #1c1c1e;`.

The component writes `--anav-slot`, `--anav-sat`, `--anav-pad`, `--anav-gap`,
`--anav-r-outer` and `--anav-r-inner` on its root; read them if you nest
something that has to share the bar's radii.

## Layout helpers

`solveSlot`, `capsuleRadii`, `pillWidth` and `DEFAULT_METRICS` are exported so a
host can compute the bar's footprint without rendering it — for a sheet that has
to clear it, say. The bar's height is `slot + 2 · pad` (64px at the default slot).

## Accessibility

- Tabs are a `tablist`; arrow keys, Home and End move the selection and focus.
- Back and the action circle are plain buttons with `aria-label`; toggles set `aria-pressed`.
- Badges render a visually hidden count (`labels.badge`).
- The buy confirmation is announced through a polite live region.
- `prefers-reduced-motion` drops the travel and keeps the feedback;
  `prefers-reduced-transparency` makes the glass solid; `prefers-contrast: more`
  adds a hard edge.

## Develop

```sh
npm install
npm run dev         # playground at http://localhost:4321 — every mode, dark, slot 44, minimized
npm run check       # tsc (strict) + node --test on the geometry module
```

The playground loads only the package stylesheet, so anything that looks wrong
there is the package's fault, not a host's.
