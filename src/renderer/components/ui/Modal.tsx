/** A small Radix-Dialog wrapper used by the management-page editors and modals. */

import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { RiCloseLine } from '@remixicon/react';
import { IconButton } from './index';
import { cx } from '../../lib/utils';

const widths = {
  sm: 'w-[min(460px,94vw)]',
  md: 'w-[min(560px,94vw)]',
  lg: 'w-[min(760px,94vw)]',
};

export function Modal({
  open,
  onOpenChange,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof widths;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cx(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line bg-surface shadow-2xl focus:outline-none',
            widths[size],
          )}
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-slate-100">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton aria-label="Close">
                <RiCloseLine className="size-5" />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="scroll-area flex-1 px-5 py-4">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-4">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
