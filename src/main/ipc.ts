/**
 * Wires the renderer-facing IPC handlers to the kasas broker, connection storage,
 * and dashboard storage. Holds the single source of truth for the current
 * connection and owns the one live EventStream.
 */

import { BrowserWindow, ipcMain } from 'electron';
import type { ConnectionConfig, KasasRequest } from '../shared/ipc';
import { IpcChannels } from '../shared/ipc';
import { kasasRequest } from './kasas/http';
import { EventStream } from './kasas/sse';
import { loadConnection, saveConnection } from './storage/settings';
import { loadDashboards, saveDashboards } from './storage/dashboards';

let connection: ConnectionConfig;
let stream: EventStream;

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

export async function registerIpc(): Promise<void> {
  connection = await loadConnection();
  stream = new EventStream(() => connection, broadcast);

  ipcMain.handle(IpcChannels.kasasRequest, (_e, req: KasasRequest) =>
    kasasRequest(connection, req),
  );

  ipcMain.handle(IpcChannels.getConnection, () => connection);

  ipcMain.handle(IpcChannels.setConnection, async (_e, next: ConnectionConfig) => {
    connection = { ...connection, ...next };
    await saveConnection(connection);
    stream.restart(); // pick up new base URL / token
    return connection;
  });

  ipcMain.handle(IpcChannels.testConnection, (_e, candidate?: ConnectionConfig) =>
    kasasRequest(candidate ?? connection, { method: 'GET', path: '/api/v1/auth' }),
  );

  ipcMain.handle(IpcChannels.eventsStart, () => stream.start());
  ipcMain.handle(IpcChannels.eventsStop, () => stream.stop());

  ipcMain.handle(IpcChannels.dashboardsLoad, () => loadDashboards());
  ipcMain.handle(IpcChannels.dashboardsSave, (_e, contents: string) =>
    saveDashboards(contents),
  );
}
