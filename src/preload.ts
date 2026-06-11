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
  KasasLogLine,
  KasasRequest,
  KasasResult,
  KasasSettings,
  KasasStatus,
  KasasUpdateInfo,
  KasasUpdateResult,
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
  backend: {
    getSettings: () =>
      ipcRenderer.invoke(IpcChannels.backendGetSettings) as Promise<KasasSettings>,
    setSettings: (settings: KasasSettings) =>
      ipcRenderer.invoke(IpcChannels.backendSetSettings, settings) as Promise<KasasStatus>,
    start: () => ipcRenderer.invoke(IpcChannels.backendStart) as Promise<KasasStatus>,
    stop: () => ipcRenderer.invoke(IpcChannels.backendStop) as Promise<KasasStatus>,
    restart: () => ipcRenderer.invoke(IpcChannels.backendRestart) as Promise<KasasStatus>,
    status: () => ipcRenderer.invoke(IpcChannels.backendStatus) as Promise<KasasStatus>,
    logs: () => ipcRenderer.invoke(IpcChannels.backendLogs) as Promise<KasasLogLine[]>,
    setBackground: (enabled: boolean) =>
      ipcRenderer.invoke(IpcChannels.backendSetBackground, enabled) as Promise<KasasStatus>,
    revealData: () => ipcRenderer.invoke(IpcChannels.backendRevealData) as Promise<void>,
    checkUpdate: () =>
      ipcRenderer.invoke(IpcChannels.backendCheckUpdate) as Promise<KasasUpdateInfo>,
    applyUpdate: () =>
      ipcRenderer.invoke(IpcChannels.backendApplyUpdate) as Promise<KasasUpdateResult>,
    onStatus: (cb: (status: KasasStatus) => void) => {
      const handler = (_: unknown, status: KasasStatus) => cb(status);
      ipcRenderer.on(IpcChannels.backendStatusEvent, handler);
      return () => ipcRenderer.removeListener(IpcChannels.backendStatusEvent, handler);
    },
    onLog: (cb: (line: KasasLogLine) => void) => {
      const handler = (_: unknown, line: KasasLogLine) => cb(line);
      ipcRenderer.on(IpcChannels.backendLogEvent, handler);
      return () => ipcRenderer.removeListener(IpcChannels.backendLogEvent, handler);
    },
    onUpdate: (cb: (info: KasasUpdateInfo) => void) => {
      const handler = (_: unknown, info: KasasUpdateInfo) => cb(info);
      ipcRenderer.on(IpcChannels.backendUpdateEvent, handler);
      return () => ipcRenderer.removeListener(IpcChannels.backendUpdateEvent, handler);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);
