/**
 * The contract between the Electron main process and the renderer.
 *
 * WHY THIS EXISTS: kasas serves no CORS headers, so the renderer (a localhost /
 * file:// origin) cannot call http://127.0.0.1:8080 directly — the browser would
 * block it. Every kasas REST call and the SSE stream therefore run in the MAIN
 * process (Node `fetch`, no CORS), and the renderer reaches them only through the
 * narrow, validated `window.api` surface defined here and exposed by the preload.
 */

import type { KasasEvent } from './kasas-types';

/** Where to reach kasas, and the bearer token (empty in token-less dev). */
export interface ConnectionConfig {
  baseUrl: string;
  token: string;
}

/** A single REST call the renderer asks main to perform on its behalf. */
export interface KasasRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Path beginning with '/', e.g. '/api/v1/accounts'. */
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

/** Result of a brokered REST call. Never throws across IPC — errors are data. */
export interface KasasResult<T = unknown> {
  ok: boolean;
  /** HTTP status, or 0 if the request never reached the server. */
  status: number;
  data?: T;
  error?: string;
}

export interface EventStreamStatus {
  connected: boolean;
  error?: string;
}

/** IPC channel names. Kept in one place so main and preload cannot drift. */
export const IpcChannels = {
  // renderer -> main (invoke/handle)
  kasasRequest: 'kasas:request',
  getConnection: 'connection:get',
  setConnection: 'connection:set',
  testConnection: 'connection:test',
  eventsStart: 'events:start',
  eventsStop: 'events:stop',
  dashboardsLoad: 'dashboards:load',
  dashboardsSave: 'dashboards:save',
  // main -> renderer (send/on)
  kasasEvent: 'kasas:event',
  eventStatus: 'events:status',
} as const;

/**
 * The shape exposed on `window.api` by the preload. Declared here (not in the
 * preload) so the renderer can reference it without importing preload/electron
 * code into its type graph.
 */
export interface SillviewApi {
  kasas: {
    request<T = unknown>(req: KasasRequest): Promise<KasasResult<T>>;
  };
  connection: {
    get(): Promise<ConnectionConfig>;
    set(conn: ConnectionConfig): Promise<ConnectionConfig>;
    test(candidate?: ConnectionConfig): Promise<KasasResult<unknown>>;
  };
  events: {
    start(): Promise<void>;
    stop(): Promise<void>;
    /** Subscribe to live kasas change events. Returns an unsubscribe fn. */
    onEvent(cb: (e: KasasEvent) => void): () => void;
    /** Subscribe to stream connectivity changes. Returns an unsubscribe fn. */
    onStatus(cb: (s: EventStreamStatus) => void): () => void;
  };
  dashboards: {
    /** Returns the persisted JSON blob, or null on first run. */
    load(): Promise<string | null>;
    save(contents: string): Promise<void>;
  };
}
