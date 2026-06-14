/**
 * Wires the renderer-facing IPC handlers to the kasas broker, connection storage,
 * dashboard storage, and the managed kasas backend. Holds the single source of
 * truth for the current connection and owns the one live EventStream.
 *
 * Connection coupling: in bundled mode the connection (base URL + token) is
 * derived from the managed kasas instance; in external mode it comes from
 * connection.json (edited via the connection dialog).
 */

import { BrowserWindow, ipcMain, shell } from 'electron';
import type { ConnectionConfig, KasasRequest, KasasSettings } from '../shared/ipc';
import { IpcChannels } from '../shared/ipc';
import { kasasRequest } from './kasas/http';
import { MOCK, mockKasasRequest } from './kasas/mock';
import { EventStream } from './kasas/sse';
import { loadConnection, saveConnection } from './storage/settings';
import { loadDashboards, saveDashboards, watchDashboards } from './storage/dashboards';
import { loadInstalled, saveInstalled, watchInstalled } from './storage/installed-widgets';
import { fetchRegistry } from './widgets/registry-client';
import { installedFromRegistry, type InstalledWidget } from '../shared/widget-registry';
import { KasasManager } from './kasas/manager';
import { kasasDataDir } from './kasas/paths';

let connection: ConnectionConfig;
let stream: EventStream;
let manager: KasasManager;

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

/** Recompute the effective connection from the backend mode, then refresh SSE. */
async function syncConnection(): Promise<void> {
  if (manager.managesConnection()) {
    connection = { baseUrl: manager.baseUrl(), token: manager.token };
  } else {
    connection = await loadConnection();
  }
  await saveConnection(connection);
  stream.restart();
}

export function getManager(): KasasManager {
  return manager;
}

/** Install a widget by slug: look it up in the registry, record it locally. */
async function installWidget(slug: string): Promise<InstalledWidget[]> {
  const reg = await fetchRegistry();
  if (!reg.ok || !reg.index) {
    throw new Error(reg.error ? `Could not reach the widget registry: ${reg.error}` : 'registry unavailable');
  }
  const entry = reg.index.widgets.find((w) => w.name === slug);
  if (!entry) throw new Error(`Widget "${slug}" is not in the registry.`);
  const current = await loadInstalled();
  const next = [
    ...current.filter((w) => w.slug !== slug),
    installedFromRegistry(entry, new Date().toISOString()),
  ];
  await saveInstalled(next);
  return next;
}

/** Uninstall a widget by slug. Existing dashboard tiles degrade to a "not installed" card. */
async function uninstallWidget(slug: string): Promise<InstalledWidget[]> {
  const current = await loadInstalled();
  const next = current.filter((w) => w.slug !== slug);
  await saveInstalled(next);
  return next;
}

export async function registerIpc(): Promise<void> {
  manager = new KasasManager({
    status: (s) => broadcast(IpcChannels.backendStatusEvent, s),
    log: (l) => broadcast(IpcChannels.backendLogEvent, l),
  });
  await manager.init();

  connection = await loadConnection();
  stream = new EventStream(() => connection, broadcast);
  await syncConnection();

  // --- kasas REST broker + connection -----------------------------------
  ipcMain.handle(IpcChannels.kasasRequest, (_e, req: KasasRequest) =>
    MOCK ? mockKasasRequest(req) : kasasRequest(connection, req),
  );

  ipcMain.handle(IpcChannels.getConnection, () => connection);

  ipcMain.handle(IpcChannels.setConnection, async (_e, next: ConnectionConfig) => {
    // Only meaningful in external mode; bundled mode derives its connection.
    connection = { ...connection, ...next };
    await saveConnection(connection);
    stream.restart();
    return connection;
  });

  ipcMain.handle(IpcChannels.testConnection, (_e, candidate?: ConnectionConfig) =>
    MOCK
      ? mockKasasRequest({ method: 'GET', path: '/api/v1/auth' })
      : kasasRequest(candidate ?? connection, { method: 'GET', path: '/api/v1/auth' }),
  );

  // --- live event stream -------------------------------------------------
  ipcMain.handle(IpcChannels.eventsStart, () => stream.start());
  ipcMain.handle(IpcChannels.eventsStop, () => stream.stop());

  // --- saved dashboards --------------------------------------------------
  ipcMain.handle(IpcChannels.dashboardsLoad, () => loadDashboards());
  ipcMain.handle(IpcChannels.dashboardsSave, (_e, contents: string) =>
    saveDashboards(contents),
  );
  // Pick up dashboards.json written by an external editor (the MCP server) and
  // tell the renderer to reload. The app's own saves are filtered out.
  watchDashboards(() => broadcast(IpcChannels.dashboardsChanged, undefined));

  // --- widget marketplace ------------------------------------------------
  ipcMain.handle(IpcChannels.widgetsRegistry, (_e, force?: boolean) => fetchRegistry(!!force));
  ipcMain.handle(IpcChannels.widgetsInstalled, () => loadInstalled());
  ipcMain.handle(IpcChannels.widgetsInstall, (_e, slug: string) => installWidget(slug));
  ipcMain.handle(IpcChannels.widgetsUninstall, (_e, slug: string) => uninstallWidget(slug));
  // External install/uninstall (the MCP server) → tell the renderer to reload.
  watchInstalled(() => broadcast(IpcChannels.widgetsChanged, undefined));

  // --- managed kasas backend --------------------------------------------
  ipcMain.handle(IpcChannels.backendGetSettings, () => manager.settings);

  ipcMain.handle(IpcChannels.backendSetSettings, async (_e, settings: KasasSettings) => {
    const status = await manager.applySettings(settings);
    await syncConnection();
    return status;
  });

  ipcMain.handle(IpcChannels.backendStart, async () => {
    const status = await manager.start();
    await syncConnection();
    return status;
  });

  ipcMain.handle(IpcChannels.backendStop, () => manager.stop());

  ipcMain.handle(IpcChannels.backendRestart, async () => {
    const status = await manager.restart();
    await syncConnection();
    return status;
  });

  ipcMain.handle(IpcChannels.backendStatus, () => manager.status());
  ipcMain.handle(IpcChannels.backendLogs, () => manager.recentLogs());

  ipcMain.handle(IpcChannels.backendSetBackground, async (_e, enabled: boolean) => {
    const status = await manager.setBackground(enabled);
    await syncConnection();
    return status;
  });

  ipcMain.handle(IpcChannels.backendRevealData, () => shell.openPath(kasasDataDir()));

  // --- open an external URL (OAuth consent, etc.) ------------------------
  // Restricted to http(s) so the renderer can't drive shell into arbitrary
  // schemes (file:, etc.). The narrowest hole in the broker boundary.
  ipcMain.handle(IpcChannels.systemOpenExternal, async (_e, url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
      await shell.openExternal(parsed.toString());
    } catch {
      /* ignore malformed URLs */
    }
  });

  ipcMain.handle(IpcChannels.backendCheckUpdate, async () => {
    const info = await manager.checkUpdate();
    broadcast(IpcChannels.backendUpdateEvent, info);
    return info;
  });

  ipcMain.handle(IpcChannels.backendApplyUpdate, async () => {
    const result = await manager.applyUpdate();
    broadcast(IpcChannels.backendStatusEvent, manager.status());
    const info = manager.lastUpdateInfo();
    if (info) broadcast(IpcChannels.backendUpdateEvent, info);
    await syncConnection();
    return result;
  });
}

/** Start the managed backend (called on app ready). Returns quickly. */
export async function startBackend(): Promise<void> {
  await manager.start();
  await syncConnection();
  // The launch auto-check is renderer-driven (store.init → checkUpdate) so it
  // can't race a broadcast fired before the renderer bound its listener.
}

/** Stop the managed child on quit. A background daemon is left running. */
export async function stopBackend(): Promise<void> {
  if (manager && !manager.settings.background) {
    await manager.stop();
  }
}
