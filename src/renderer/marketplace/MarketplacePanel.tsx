import * as Dialog from '@radix-ui/react-dialog';
import { RiAddLine, RiCloseLine } from '@remixicon/react';
import { WIDGETS } from '../widgets/registry';
import type { WidgetDefinition } from '../widgets/types';
import { CATEGORY_ORDER } from '../../shared/widgets';
import { useDashboards } from '../store/dashboards';
import { Button, IconButton } from '../components/ui';

function groupByCategory(): Record<string, WidgetDefinition[]> {
  const groups: Record<string, WidgetDefinition[]> = {};
  for (const def of WIDGETS) {
    (groups[def.category] ??= []).push(def);
  }
  return groups;
}

export function MarketplacePanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addWidget = useDashboards((s) => s.addWidget);
  const groups = groupByCategory();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed right-0 top-0 z-50 flex h-full w-[min(440px,92vw)] flex-col border-l border-line bg-surface shadow-2xl focus:outline-none"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-100">
                Widget Marketplace
              </Dialog.Title>
              <p className="text-xs text-slate-500">Add components to the active dashboard</p>
            </div>
            <Dialog.Close asChild>
              <IconButton aria-label="Close">
                <RiCloseLine className="size-5" />
              </IconButton>
            </Dialog.Close>
          </div>

          <div className="scroll-area flex-1 space-y-6 px-5 py-4">
            {CATEGORY_ORDER.filter((c) => groups[c]?.length).map((category) => (
              <section key={category}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {category}
                </h3>
                <div className="space-y-2">
                  {groups[category].map((def) => {
                    const Icon = def.icon;
                    return (
                      <div
                        key={def.type}
                        className="flex items-start gap-3 rounded-lg border border-line bg-surface-raised p-3"
                      >
                        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-white/5">
                          <Icon className="size-5 text-slate-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-200">{def.title}</div>
                          <div className="mt-0.5 text-xs leading-relaxed text-slate-500">
                            {def.description}
                          </div>
                        </div>
                        <Button
                          variant="subtle"
                          className="shrink-0"
                          onClick={() => addWidget(def.type, def.defaultSize)}
                        >
                          <RiAddLine className="size-4" />
                          Add
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
