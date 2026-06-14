/**
 * The "Add widget" drawer. It offers only the widgets the user has INSTALLED from
 * the marketplace (intersected with what this app build can render), with search +
 * category filters. To get more widgets the user opens the Widget Marketplace page.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiAddLine, RiCloseLine, RiSearchLine, RiStore2Line } from '@remixicon/react';
import * as Dialog from '@radix-ui/react-dialog';
import { widgetMap } from '../widgets/registry';
import type { WidgetDefinition } from '../widgets/types';
import { CATEGORY_ORDER, type WidgetCategory } from '../../shared/widgets';
import { useDashboards } from '../store/dashboards';
import { useWidgets } from '../store/widgets';
import { Button, IconButton } from '../components/ui';
import { cx } from '../lib/utils';

export function MarketplacePanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const addWidget = useDashboards((s) => s.addWidget);
  const installed = useWidgets((s) => s.installed);
  const loadInstalled = useWidgets((s) => s.loadInstalled);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<WidgetCategory | 'All'>('All');

  // Refresh the installed list whenever the drawer opens.
  useEffect(() => {
    if (open) void loadInstalled();
  }, [open, loadInstalled]);

  // Installed widgets this build can actually render, de-duplicated by type.
  const defs = useMemo(() => {
    const seen = new Set<string>();
    const out: WidgetDefinition[] = [];
    for (const w of installed) {
      const def = widgetMap[w.widget_type];
      if (def && !seen.has(def.type)) {
        seen.add(def.type);
        out.push(def);
      }
    }
    return out;
  }, [installed]);

  const categories = useMemo(
    () => CATEGORY_ORDER.filter((c) => defs.some((d) => d.category === c)),
    [defs],
  );

  // Fall back to "All" if the selected category no longer has installed widgets
  // (e.g. the last one was uninstalled), so the panel never shows an empty filter.
  const effectiveCategory =
    category === 'All' || (categories as readonly string[]).includes(category) ? category : 'All';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return defs.filter((d) => {
      if (effectiveCategory !== 'All' && d.category !== effectiveCategory) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
      );
    });
  }, [defs, query, effectiveCategory]);

  const grouped = useMemo(() => {
    const groups: Record<string, WidgetDefinition[]> = {};
    for (const d of filtered) (groups[d.category] ??= []).push(d);
    return groups;
  }, [filtered]);

  const goToMarketplace = () => {
    onOpenChange(false);
    navigate('/widgets');
  };

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
                Add a widget
              </Dialog.Title>
              <p className="text-xs text-slate-500">Installed widgets you can place on this dashboard</p>
            </div>
            <Dialog.Close asChild>
              <IconButton aria-label="Close">
                <RiCloseLine className="size-5" />
              </IconButton>
            </Dialog.Close>
          </div>

          {/* Search + category filter */}
          <div className="space-y-3 border-b border-line px-5 py-3">
            <div className="relative">
              <RiSearchLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search installed widgets…"
                className="w-full rounded-lg border border-line bg-surface-raised py-2 pl-8 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/60 focus:outline-none"
              />
            </div>
            {categories.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {(['All', ...categories] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c as WidgetCategory | 'All')}
                    className={cx(
                      'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                      effectiveCategory === c
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="scroll-area flex-1 space-y-6 px-5 py-4">
            {defs.length === 0 ? (
              <EmptyMarketplaceCta onBrowse={goToMarketplace} reason="none-installed" />
            ) : filtered.length === 0 ? (
              <EmptyMarketplaceCta onBrowse={goToMarketplace} reason="no-match" />
            ) : (
              CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((cat) => (
                <section key={cat}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {cat}
                  </h3>
                  <div className="space-y-2">
                    {grouped[cat].map((def) => {
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
              ))
            )}
          </div>

          <div className="border-t border-line px-5 py-3">
            <Button variant="ghost" className="w-full" onClick={goToMarketplace}>
              <RiStore2Line className="size-4" />
              Browse the Widget Marketplace
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EmptyMarketplaceCta({
  onBrowse,
  reason,
}: {
  onBrowse: () => void;
  reason: 'none-installed' | 'no-match';
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-white/5 text-slate-400">
        <RiStore2Line className="size-6" />
      </div>
      <div>
        <div className="text-sm font-medium text-slate-200">
          {reason === 'none-installed' ? 'No widgets installed' : 'No matching widgets'}
        </div>
        <div className="mt-0.5 text-xs text-slate-500">
          {reason === 'none-installed'
            ? 'Install widgets from the marketplace to add them here.'
            : 'Try a different search, or install more from the marketplace.'}
        </div>
      </div>
      <Button variant="primary" onClick={onBrowse}>
        <RiStore2Line className="size-4" />
        Open the marketplace
      </Button>
    </div>
  );
}
