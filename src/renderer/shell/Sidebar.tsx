/** Left navigation: grouped built-in routes + a connection/settings footer. */

import { NavLink } from 'react-router-dom';
import { RiPuzzleLine, RiSettings3Line, RiSignalTowerLine } from '@remixicon/react';
import { GROUP_ORDER, ROUTES, type NavRoute } from './routes';
import { useConnection } from '../store/connection';
import { useBackend } from '../store/backend';
import { usePluginPages } from './usePluginPages';
import { StatusDot } from '../components/ui';
import { cx } from '../lib/utils';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm',
    isActive ? 'bg-white/10 text-slate-100' : 'text-slate-400 hover:bg-white/5',
  );

function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

function NavItem({ route }: { route: NavRoute }) {
  const Icon = route.icon;
  return (
    <NavLink to={route.path} end={route.path === '/'} className={navLinkClass}>
      <Icon className="size-4 shrink-0 opacity-80" />
      <span className="truncate">{route.label}</span>
    </NavLink>
  );
}

export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const connStatus = useConnection((s) => s.status);
  const connConfig = useConnection((s) => s.config);
  const updateAvailable = useBackend((s) => !!s.updateInfo?.available);
  const binaryVersion = useBackend((s) => s.updateInfo?.current);
  const pluginPages = usePluginPages();

  const statusTone =
    connStatus === 'online' ? 'green' : connStatus === 'offline' ? 'red' : 'amber';

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
      <div className="app-drag flex items-center gap-2 px-4 pb-3 pt-10">
        <RiSignalTowerLine className="size-5 text-blue-400" />
        <span className="text-sm font-semibold tracking-tight text-slate-100">sillview</span>
      </div>

      <nav className="scroll-area flex-1 space-y-4 px-2 py-2">
        {GROUP_ORDER.map((group) => {
          const routes = ROUTES.filter((r) => r.group === group);
          if (routes.length === 0) return null;
          return (
            <div key={group}>
              <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {group}
              </div>
              <div className="space-y-0.5">
                {routes.map((route) => (
                  <NavItem key={route.path} route={route} />
                ))}
              </div>
            </div>
          );
        })}

        {pluginPages.length > 0 && (
          <div>
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Plugin Pages
            </div>
            <div className="space-y-0.5">
              {pluginPages.map((p) => (
                <NavLink key={p.name} to={`/ext/${p.name}`} className={navLinkClass}>
                  <RiPuzzleLine className="size-4 shrink-0 opacity-80" />
                  <span className="truncate">{p.title || p.name}</span>
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-line">
        {binaryVersion && (
          <div className="px-4 pt-1.5 text-[10px] text-slate-600">kasas {binaryVersion}</div>
        )}
        <button
          onClick={onOpenSettings}
          className="app-no-drag flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs text-slate-400 hover:bg-white/5"
        >
          <StatusDot tone={statusTone} pulse={connStatus === 'online'} />
          <span className="min-w-0 flex-1 truncate">{hostOf(connConfig.baseUrl)}</span>
          <span
            className="relative shrink-0"
            title={updateAvailable ? 'kasas update available' : undefined}
          >
            <RiSettings3Line className="size-4" />
            {updateAvailable && (
              <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-blue-400 ring-2 ring-surface" />
            )}
          </span>
        </button>
      </div>
    </aside>
  );
}
