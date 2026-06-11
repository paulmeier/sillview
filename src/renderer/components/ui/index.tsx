import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { RiLoader4Line } from '@remixicon/react';
import { cx } from '../../lib/utils';

type ButtonVariant = 'primary' | 'ghost' | 'subtle' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-500',
  ghost: 'text-slate-300 hover:bg-white/5 hover:text-slate-100',
  subtle: 'bg-white/5 text-slate-200 hover:bg-white/10',
  danger: 'bg-rose-600/90 text-white hover:bg-rose-500',
};

export function Button({ variant = 'subtle', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
        'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60',
        'disabled:cursor-not-allowed disabled:opacity-50',
        buttonVariants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        'inline-flex size-7 items-center justify-center rounded-md text-slate-400',
        'transition-colors hover:bg-white/5 hover:text-slate-100',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

type Tone = 'neutral' | 'green' | 'red' | 'amber' | 'blue';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-white/5 text-slate-300 ring-white/10',
  green: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20',
  red: 'bg-rose-500/10 text-rose-300 ring-rose-500/20',
  amber: 'bg-amber-500/10 text-amber-300 ring-amber-500/20',
  blue: 'bg-blue-500/10 text-blue-300 ring-blue-500/20',
};

export function Pill({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone = 'neutral', pulse }: { tone?: Tone; pulse?: boolean }) {
  const color: Record<Tone, string> = {
    neutral: 'bg-slate-500',
    green: 'bg-emerald-400',
    red: 'bg-rose-400',
    amber: 'bg-amber-400',
    blue: 'bg-blue-400',
  };
  return (
    <span className="relative inline-flex size-2">
      {pulse && (
        <span
          className={cx('absolute inline-flex size-full animate-ping rounded-full opacity-60', color[tone])}
        />
      )}
      <span className={cx('relative inline-flex size-2 rounded-full', color[tone])} />
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <RiLoader4Line className={cx('size-5 animate-spin text-slate-500', className)} />;
}

/** Consistent loading / error / empty rendering for widget bodies. */
export function WidgetState({
  loading,
  error,
  empty,
  emptyLabel = 'Nothing to show yet',
}: {
  loading?: boolean;
  error?: string;
  empty?: boolean;
  emptyLabel?: string;
}) {
  return (
    <div className="flex h-full min-h-24 flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
      {loading && <Spinner />}
      {!loading && error && (
        <span className="max-w-[80%] text-rose-300/80">{error}</span>
      )}
      {!loading && !error && empty && <span>{emptyLabel}</span>}
    </div>
  );
}
