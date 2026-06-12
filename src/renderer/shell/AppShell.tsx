/** The routed layout: sidebar + the active page, with the global Settings dialog. */

import { useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RiErrorWarningLine } from '@remixicon/react';
import { Sidebar } from './Sidebar';
import { ROUTES } from './routes';
import { PluginPage } from '../pages/PluginPage';
import { SourceDetail } from '../pages/SourceDetail';
import { SettingsDialog } from '../components/SettingsDialog';
import { useConnection } from '../store/connection';
import { useBackend } from '../store/backend';

/** Warn when a remote (external) kasas reports no auth — anyone reachable can read/write. */
function UnsecuredBanner({ onSecure }: { onSecure: () => void }) {
  const mode = useBackend((s) => s.settings?.mode ?? 'bundled');
  const authRequired = useConnection((s) => s.auth?.auth_required);
  const [dismissed, setDismissed] = useState(false);

  if (mode !== 'external' || authRequired !== false || dismissed) return null;

  return (
    <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-5 py-2 text-xs text-amber-200">
      <RiErrorWarningLine className="size-4 shrink-0" />
      <span className="flex-1">
        This kasas instance has no authentication — anyone who can reach it can view and modify
        your data.
      </span>
      <button className="font-medium underline hover:text-amber-100" onClick={onSecure}>
        Secure it
      </button>
      <button className="text-amber-300/70 hover:text-amber-100" onClick={() => setDismissed(true)}>
        Dismiss
      </button>
    </div>
  );
}

export function AppShell() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0b0f17] text-slate-200">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />

      <main className="flex min-w-0 flex-1 flex-col">
        <UnsecuredBanner onSecure={() => setSettingsOpen(true)} />
        <Routes>
          {ROUTES.map((route) =>
            route.path === '/' ? (
              <Route key={route.path} index element={route.element} />
            ) : (
              <Route key={route.path} path={route.path} element={route.element} />
            ),
          )}
          <Route path="/sources/:type" element={<SourceDetail />} />
          <Route path="/ext/:name" element={<PluginPage />} />
        </Routes>
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
