/**
 * Preload: the only bridge between the sandboxed renderer and the main process.
 * Exposes a narrow, typed `window.api` (shape: SillviewApi) via contextBridge —
 * the renderer never receives `ipcRenderer` itself.
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from './shared/ipc';
import type {
  ConnectionConfig,
  EventStreamStatus,
  KasasRequest,
  KasasResult,
  SillviewApi,
} from './shared/ipc';
import type { KasasEvent } from './shared/kasas-types';

const api: SillviewApi = {
  kasas: {
    request: <T = unknown>(req: KasasRequest) =>
      ipcRenderer.invoke(IpcChannels.kasasRequest, req) as Promise<KasasResult<T>>,
  },
  connection: {
    get: () => ipcRenderer.invoke(IpcChannels.getConnection) as Promise<ConnectionConfig>,
    set: (conn: ConnectionConfig) =>
      ipcRenderer.invoke(IpcChannels.setConnection, conn) as Promise<ConnectionConfig>,
    test: (candidate?: ConnectionConfig) =>
      ipcRenderer.invoke(IpcChannels.testConnection, candidate) as Promise<KasasResult>,
  },
  events: {
    start: () => ipcRenderer.invoke(IpcChannels.eventsStart) as Promise<void>,
    stop: () => ipcRenderer.invoke(IpcChannels.eventsStop) as Promise<void>,
    onEvent: (cb: (e: KasasEvent) => void) => {
      const handler = (_: unknown, e: KasasEvent) => cb(e);
      ipcRenderer.on(IpcChannels.kasasEvent, handler);
      return () => ipcRenderer.removeListener(IpcChannels.kasasEvent, handler);
    },
    onStatus: (cb: (s: EventStreamStatus) => void) => {
      const handler = (_: unknown, s: EventStreamStatus) => cb(s);
      ipcRenderer.on(IpcChannels.eventStatus, handler);
      return () => ipcRenderer.removeListener(IpcChannels.eventStatus, handler);
    },
  },
  dashboards: {
    load: () => ipcRenderer.invoke(IpcChannels.dashboardsLoad) as Promise<string | null>,
    save: (contents: string) =>
      ipcRenderer.invoke(IpcChannels.dashboardsSave, contents) as Promise<void>,
  },
};

contextBridge.exposeInMainWorld('api', api);
