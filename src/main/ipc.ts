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
import { EventStream } from './kasas/sse';
import { loadConnection, saveConnection } from './storage/settings';
import { loadDashboards, saveDashboards } from './storage/dashboards';
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
    kasasRequest(connection, req),
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
    kasasRequest(candidate ?? connection, { method: 'GET', path: '/api/v1/auth' }),
  );

  // --- live event stream -------------------------------------------------
  ipcMain.handle(IpcChannels.eventsStart, () => stream.start());
  ipcMain.handle(IpcChannels.eventsStop, () => stream.stop());

  // --- saved dashboards --------------------------------------------------
  ipcMain.handle(IpcChannels.dashboardsLoad, () => loadDashboards());
  ipcMain.handle(IpcChannels.dashboardsSave, (_e, contents: string) =>
    saveDashboards(contents),
  );

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
}

/** Start the managed backend (called on app ready). Returns quickly. */
export async function startBackend(): Promise<void> {
  await manager.start();
  await syncConnection();
}

/** Stop the managed child on quit. A background daemon is left running. */
export async function stopBackend(): Promise<void> {
  if (manager && !manager.settings.background) {
    await manager.stop();
  }
}
