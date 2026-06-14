/**
 * Widget Marketplace — browse the community widget registry and install/uninstall
 * widgets. Only an installed widget can be added to a dashboard (via the "Add
 * widget" panel). Distinct from the Plugin Marketplace, which installs kasas backend
 * plugins; these are sillview dashboard widgets.
 *
 * Today's widgets are first-party "builtin" widgets whose code ships with the app —
 * installing simply unlocks one to add. The registry is fetched in the main process
 * (the renderer's CSP forbids direct network access).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  RiCheckLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiRefreshLine,
  RiSearchLine,
  RiStore2Line,
} from '@remixicon/react';
import { PageShell } from '../shell/Page';
import { Button, Pill, Spinner } from '../components/ui';
import { cx } from '../lib/utils';
import { iconForName } from '../widgets/icons';
import { widgetMap } from '../widgets/registry';
import { CATEGORY_ORDER } from '../../shared/widgets';
import { useWidgets } from '../store/widgets';
import type { RegistryWidget } from '../../shared/widget-registry';

function WidgetCard({
  widget,
  installedVersion,
  busy,
  onInstall,
  onUninstall,
}: {
  widget: RegistryWidget;
  installedVersion?: string;
  busy: boolean;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  const Icon = iconForName(widget.icon);
  const installed = installedVersion !== undefined;
  const updateAvailable = installed && installedVersion !== widget.version;
  // A builtin whose type this app build doesn't know (e.g. a newer registry entry).
  const unavailable = widget.kind === 'builtin' && !widgetMap[widget.widget_type];

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-300">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-100">{widget.name}</span>
            <Pill tone="neutral">{widget.category}</Pill>
            {widget.tier === 'verified' && <Pill tone="green">verified</Pill>}
            <span className="text-xs text-slate-500">v{widget.version}</span>
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {widget.description}
            {widget.author && <span className="text-slate-600"> · by {widget.author}</span>}
          </div>
          {widget.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {widget.tags.map((t) => (
                <Pill key={t} tone="neutral">
                  {t}
                </Pill>
              ))}
            </div>
          )}
          {unavailable && (
            <div className="mt-2 text-xs text-amber-300/80">
              This widget needs a newer version of sillview to render.
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {updateAvailable ? (
            <Button variant="primary" disabled={busy} onClick={onInstall}>
              <RiDownloadLine className="size-4" />
              {busy ? 'Updating…' : 'Update'}
            </Button>
          ) : installed ? (
            <Pill tone="green">
              <RiCheckLine className="size-3.5" />
              installed
            </Pill>
          ) : (
            <Button variant="subtle" disabled={busy} onClick={onInstall}>
              <RiDownloadLine className="size-4" />
              {busy ? 'Installing…' : 'Install'}
            </Button>
          )}
          {installed && (
            <button
              onClick={onUninstall}
              disabled={busy}
              className="inline-flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-rose-300 disabled:opacity-50"
            >
              <RiDeleteBinLine className="size-3.5" />
              Uninstall
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Widgets() {
  const registry = useWidgets((s) => s.registry);
  const installed = useWidgets((s) => s.installed);
  const loading = useWidgets((s) => s.loadingRegistry);
  const registryError = useWidgets((s) => s.registryError);
  const loadRegistry = useWidgets((s) => s.loadRegistry);
  const install = useWidgets((s) => s.install);
  const uninstall = useWidgets((s) => s.uninstall);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string>();

  useEffect(() => {
    useWidgets.getState().init();
  }, []);

  const installedBySlug = useMemo(
    () => new Map(installed.map((w) => [w.slug, w.version])),
    [installed],
  );

  const categories = useMemo(() => {
    const present = new Set(registry.map((w) => w.category));
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [registry]);

  // If the selected category no longer has any widgets (e.g. after an uninstall or a
  // registry refresh), fall back to "All" so the user isn't stranded on empty results.
  const effectiveCategory =
    category === 'All' || (categories as string[]).includes(category) ? category : 'All';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return registry.filter((w) => {
      if (effectiveCategory !== 'All' && w.category !== effectiveCategory) return false;
      if (!q) return true;
      return (
        w.name.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.author.toLowerCase().includes(q) ||
        w.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [registry, query, effectiveCategory]);

  const grouped = useMemo(() => {
    const groups: Record<string, RegistryWidget[]> = {};
    for (const w of filtered) (groups[w.category] ??= []).push(w);
    return groups;
  }, [filtered]);

  const orderedCategories = useMemo(() => {
    const known = CATEGORY_ORDER.filter((c) => grouped[c]?.length);
    const extra = Object.keys(grouped)
      .filter((c) => !(CATEGORY_ORDER as readonly string[]).includes(c))
      .sort();
    return [...known, ...extra];
  }, [grouped]);

  const run = async (slug: string, fn: () => Promise<void>) => {
    setBusySlug(slug);
    setActionError(undefined);
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlug(null);
    }
  };

  const actions = (
    <Button variant="subtle" onClick={() => void loadRegistry(true)} disabled={loading}>
      <RiRefreshLine className={cx('size-4', loading && 'animate-spin')} />
      Refresh
    </Button>
  );

  return (
    <PageShell
      title="Widget Marketplace"
      subtitle="Install widgets, then add them to a dashboard"
      actions={actions}
    >
      {loading && registry.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-5">
          {registryError && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              The widget registry is unreachable: {registryError}
            </div>
          )}
          {actionError && <div className="text-sm text-rose-300/90">{actionError}</div>}

          {/* Search + category filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <RiSearchLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search widgets…"
                className="w-full rounded-lg border border-line bg-surface-raised py-2 pl-8 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/60 focus:outline-none"
              />
            </div>
          </div>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {['All', ...categories].map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
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

          {registry.length === 0 && !registryError ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-slate-500">
              <RiStore2Line className="size-8" />
              <span className="text-sm">No widgets in the registry.</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">No widgets match your search.</div>
          ) : (
            orderedCategories.map((cat) => (
              <div key={cat}>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {cat}
                </div>
                <div className="space-y-3">
                  {grouped[cat].map((w) => (
                    <WidgetCard
                      key={w.name}
                      widget={w}
                      installedVersion={installedBySlug.get(w.name)}
                      busy={busySlug === w.name}
                      onInstall={() => void run(w.name, () => install(w.name))}
                      onUninstall={() => void run(w.name, () => uninstall(w.name))}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </PageShell>
  );
}
