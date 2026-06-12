/**
 * The widget dashboard surface — sillview's original home screen, now one route
 * inside the nav shell. Hosts the dashboard switcher, edit toggle, and the
 * "add widget" marketplace panel.
 */

import { useState } from 'react';
import {
  RiAddBoxLine,
  RiAddLine,
  RiCheckLine,
  RiCloseLine,
  RiDashboardLine,
  RiPencilLine,
} from '@remixicon/react';
import { useActiveDashboard, useDashboards } from '../store/dashboards';
import { DashboardGrid } from '../dashboard/DashboardGrid';
import { MarketplacePanel } from '../marketplace/MarketplacePanel';
import { PageShell } from '../shell/Page';
import { Button, IconButton } from '../components/ui';

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

export function Dashboards() {
  const dashboards = useDashboards((s) => s.dashboards);
  const activeId = useDashboards((s) => s.activeId);
  const setActive = useDashboards((s) => s.setActive);
  const addDashboard = useDashboards((s) => s.addDashboard);
  const removeDashboard = useDashboards((s) => s.removeDashboard);
  const renameDashboard = useDashboards((s) => s.renameDashboard);
  const editing = useDashboards((s) => s.editing);
  const toggleEditing = useDashboards((s) => s.toggleEditing);
  const active = useActiveDashboard();

  const [marketOpen, setMarketOpen] = useState(false);

  const title =
    editing && active ? (
      <input
        value={active.name}
        onChange={(e) => renameDashboard(active.id, e.target.value)}
        className="app-no-drag w-56 rounded-md border border-line bg-surface-raised px-2 py-1 text-sm font-semibold text-slate-100 focus:border-blue-500/60 focus:outline-none"
      />
    ) : dashboards.length > 1 ? (
      <select
        value={activeId ?? ''}
        onChange={(e) => setActive(e.target.value)}
        className="app-no-drag rounded-md border border-line bg-surface-raised px-2 py-1 text-sm font-semibold text-slate-100 focus:border-blue-500/60 focus:outline-none"
      >
        {dashboards.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    ) : (
      <span>{active?.name ?? 'No dashboard'}</span>
    );

  const actions = (
    <>
      <IconButton aria-label="New dashboard" onClick={() => addDashboard()}>
        <RiAddLine className="size-4" />
      </IconButton>
      {editing && active && dashboards.length > 1 && (
        <Button variant="danger" onClick={() => removeDashboard(active.id)}>
          <RiCloseLine className="size-4" />
          Delete
        </Button>
      )}
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
    </>
  );

  return (
    <PageShell title={title} actions={actions}>
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

      <MarketplacePanel open={marketOpen} onOpenChange={setMarketOpen} />
    </PageShell>
  );
}
