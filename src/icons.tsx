const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** The default Back chevron; pass `backIcon` to the nav to use your own set. */
export function IconBack({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d="M14.5 5.5 8 12l6.5 6.5" {...stroke} />
    </svg>
  );
}

/** The magnifier inside the search field. */
export function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <circle cx="10.5" cy="10.5" r="6.5" {...stroke} />
      <path d="m15.5 15.5 4.5 4.5" {...stroke} />
    </svg>
  );
}

/** The cross that empties the search field. */
export function IconClear({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d="m7 7 10 10M17 7 7 17" {...stroke} />
    </svg>
  );
}
