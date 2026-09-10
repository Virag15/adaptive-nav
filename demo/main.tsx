import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { AdaptiveNav, type NavMode, type TabOption } from '../src';
import '../src/adaptive-nav.css';

const Dot = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8" fill="currentColor" />
  </svg>
);

// Three tabs, not four: exercises the generalised slot solver.
const TABS: TabOption[] = [
  { id: 'a', label: 'Alpha', Icon: Dot },
  { id: 'b', label: 'Beta', Icon: Dot, badge: 3 },
  { id: 'c', label: 'Gamma', Icon: Dot },
];

function Playground() {
  const [mode, setMode] = useState<NavMode>('tabs');
  const [tab, setTab] = useState('a');
  const [on, setOn] = useState(false);
  const [small, setSmall] = useState(false);
  const [min, setMin] = useState(false);
  const [dark, setDark] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const note = (s: string) => setLog((l) => [...l.slice(-11), s]);

  return (
    <>
      <div className="controls">
        {(['tabs', 'context', 'buy'] as const).map((m) => (
          <button key={m} id={`to-${m}`} aria-pressed={mode === m} onClick={() => setMode(m)}>
            {m}
          </button>
        ))}
        <button
          id="dark"
          aria-pressed={dark}
          onClick={() => {
            setDark((d) => !d);
            document.documentElement.classList.toggle('dark');
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
      </div>
      <pre id="log">{log.join('\n')}</pre>
      <div style={{ height: 1600 }} />

      <AdaptiveNav
        mode={mode}
        options={TABS}
        value={tab}
        onChange={(id) => {
          setTab(id);
          note('change:' + id);
        }}
        onBack={() => note('back')}
        action={
          mode !== 'tabs'
            ? { id: 'save', label: 'Save', Icon: Dot, active: on, onPress: () => setOn((o) => !o) }
            : undefined
        }
        buy={
          mode === 'buy'
            ? { label: 'Add to bag', price: '₹1,000', done: 'Added!', onPress: () => note('buy') }
            : undefined
        }
        metrics={small ? { slot: 44 } : undefined}
        minimized={min}
        onExpand={() => {
          setMin(false);
          note('expand');
        }}
      />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <Playground />
    </MotionConfig>
  </StrictMode>,
);
