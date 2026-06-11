import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/utils';

/** A surface container — the base of every widget and panel. */
export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx('rounded-xl border border-line bg-surface-raised', className)}
      {...props}
    >
      {children}
    </div>
  );
}
