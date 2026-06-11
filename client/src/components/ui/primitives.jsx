// Shared UI primitives — a small, shadcn-style system that gives every page the
// same neutral/emerald theme, soft surfaces, and breathing room as the dashboard.

// Base surface for every card/panel across the app.
export const CARD = 'rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm';

// Small uppercase section heading used to break a page into calm sections.
export function SectionLabel({ children, hint, className = '' }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 mb-5 ${className}`}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{children}</h2>
      {hint && <span className="text-xs text-gray-600">{hint}</span>}
    </div>
  );
}

const DIFFICULTY_BADGE = {
  Easy: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Hard: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

export function DifficultyBadge({ difficulty, size = 'md' }) {
  const sizing = size === 'sm'
    ? 'px-2 py-0.5 text-[10px]'
    : 'px-2.5 py-1 text-[11px]';
  return (
    <span className={`inline-block rounded-full font-bold tracking-wide uppercase border ${sizing} ${DIFFICULTY_BADGE[difficulty] || DIFFICULTY_BADGE.Medium}`}>
      {difficulty}
    </span>
  );
}

const BUTTON_VARIANTS = {
  primary: 'bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-white shadow-lg shadow-emerald-900/20',
  subtle: 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-200',
  ghost: 'bg-transparent border border-transparent hover:bg-white/5 text-gray-300',
  danger: 'bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300',
};

export function Button({ variant = 'subtle', className = '', children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.subtle} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
