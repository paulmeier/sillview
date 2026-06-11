import { useEffect, useState } from 'react';
import {
  RiAddBoxLine,
  RiAddLine,
  RiCheckLine,
  RiCloseLine,
  RiDashboardLine,
  RiLayoutGridLine,
  RiPencilLine,
  RiSettings3Line,
  RiSignalTowerLine,
} from '@remixicon/react';
import { useConnection } from './store/connection';
import { useActiveDashboard, useDashboards } from './store/dashboards';
import { DashboardGrid } from './dashboard/DashboardGrid';
import { MarketplacePanel } from './marketplace/MarketplacePanel';
import { SettingsDialog } from './components/SettingsDialog';
import { Button, IconButton, Spinner, StatusDot } from './components/ui';
import { cx } from './lib/utils';

function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

function Splash() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0b0f17]">
      <Spinner className="size-6" />
    </div>
  );
}

function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-white/5 text-slate-400">
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium text-slate-200">{title}</div>
        <div className="mt-0.5 text-xs text-slate-500">{hint}</div>
      </div>
      {action}
    </div>
  );
}

export function App() {
  const hydrated = useDashboards((s) => s.hydrated);
  const dashboards = useDashboards((s) => s.dashboards);
  const activeId = useDashboards((s) => s.activeId);
  const setActive = useDashboards((s) => s.setActive);
  const addDashboard = useDashboards((s) => s.addDashboard);
  const removeDashboard = useDashboards((s) => s.removeDashboard);
  const renameDashboard = useDashboards((s) => s.renameDashboard);
  const editing = useDashboards((s) => s.editing);
  const toggleEditing = useDashboards((s) => s.toggleEditing);
  const active = useActiveDashboard();

  const connStatus = useConnection((s) => s.status);
  const connConfig = useConnection((s) => s.config);

  const [marketOpen, setMarketOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void useConnection.getState().init();
    const finish = () => useDashboards.getState().finishHydration();
    if (useDashboards.persist.hasHydrated()) finish();
    return useDashboards.persist.onFinishHydration(finish);
  }, []);

  if (!hydrated) return <Splash />;

  const statusTone =
    connStatus === 'online' ? 'green' : connStatus === 'offline' ? 'red' : 'amber';

  return (
    <div className="flex h-screen overflow-hidden bg-[#0b0f17] text-slate-200">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
        <div className="app-drag flex items-center gap-2 px-4 pb-3 pt-10">
          <RiSignalTowerLine className="size-5 text-blue-400" />
          <span className="text-sm font-semibold tracking-tight text-slate-100">sillview</span>
        </div>

        <div className="flex items-center justify-between px-3 pb-1 pt-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Dashboards
          </span>
          <IconButton aria-label="New dashboard" onClick={() => addDashboard()}>
            <RiAddLine className="size-4" />
          </IconButton>
        </div>

        <nav className="scroll-area flex-1 space-y-0.5 px-2">
          {dashboards.map((d) => (
            <div
              key={d.id}
              className={cx(
                'group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm',
                d.id === activeId ? 'bg-white/10 text-slate-100' : 'text-slate-400 hover:bg-white/5',
              )}
            >
              <button
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => setActive(d.id)}
              >
                <RiLayoutGridLine className="size-4 shrink-0 opacity-70" />
                <span className="truncate">{d.name}</span>
              </button>
              {dashboards.length > 1 && (
                <button
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => removeDashboard(d.id)}
                  title="Delete dashboard"
                >
                  <RiCloseLine className="size-3.5 text-slate-500 hover:text-rose-300" />
                </button>
              )}
            </div>
          ))}
        </nav>

        <button
          onClick={() => setSettingsOpen(true)}
          className="app-no-drag flex items-center gap-2 border-t border-line px-4 py-3 text-left text-xs text-slate-400 hover:bg-white/5"
        >
          <StatusDot tone={statusTone} pulse={connStatus === 'online'} />
          <span className="min-w-0 flex-1 truncate">{hostOf(connConfig.baseUrl)}</span>
          <RiSettings3Line className="size-4 shrink-0" />
        </button>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="app-drag flex items-center gap-3 border-b border-line px-5 py-3">
          {editing && active ? (
            <input
              value={active.name}
              onChange={(e) => renameDashboard(active.id, e.target.value)}
              className="app-no-drag w-56 rounded-md border border-line bg-surface-raised px-2 py-1 text-sm font-semibold text-slate-100 focus:border-blue-500/60 focus:outline-none"
            />
          ) : (
            <h1 className="text-sm font-semibold text-slate-100">
              {active?.name ?? 'No dashboard'}
            </h1>
          )}

          <div className="app-no-drag ml-auto flex items-center gap-2">
            <Button variant="subtle" onClick={() => setMarketOpen(true)} disabled={!active}>
              <RiAddBoxLine className="size-4" />
              Add widget
            </Button>
            <Button variant={editing ? 'primary' : 'ghost'} onClick={toggleEditing} disabled={!active}>
              {editing ? (
                <>
                  <RiCheckLine className="size-4" />
                  Done
                </>
              ) : (
                <>
                  <RiPencilLine className="size-4" />
                  Edit
                </>
              )}
            </Button>
          </div>
        </header>

        <div className="scroll-area flex-1 p-4">
          {!active ? (
            <EmptyState
              icon={<RiDashboardLine className="size-6" />}
              title="No dashboards"
              hint="Create a dashboard to start arranging widgets."
              action={
                <Button variant="primary" onClick={() => addDashboard()}>
                  <RiAddLine className="size-4" />
                  New dashboard
                </Button>
              }
            />
          ) : active.widgets.length === 0 ? (
            <EmptyState
              icon={<RiAddBoxLine className="size-6" />}
              title="This dashboard is empty"
              hint="Add widgets from the marketplace to build it out."
              action={
                <Button variant="primary" onClick={() => setMarketOpen(true)}>
                  <RiAddBoxLine className="size-4" />
                  Browse marketplace
                </Button>
              }
            />
          ) : (
            <DashboardGrid />
          )}
        </div>
      </main>

      <MarketplacePanel open={marketOpen} onOpenChange={setMarketOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
