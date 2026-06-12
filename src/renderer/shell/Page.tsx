/** Shared page chrome: a draggable title bar with optional actions + a scroll body. */

import type { ReactNode } from 'react';

export function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="app-drag flex items-center gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-slate-100">{title}</h1>
          {subtitle && <div className="truncate text-xs text-slate-500">{subtitle}</div>}
        </div>
        {actions && <div className="app-no-drag ml-auto flex items-center gap-2">{actions}</div>}
      </header>
      <div className="scroll-area flex-1 p-4">{children}</div>
    </div>
  );
}
