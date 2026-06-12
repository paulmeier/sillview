/**
 * The kasas live-event consumer (main process).
 *
 * EventSource isn't available in the main process and the renderer can't open the
 * stream itself (no CORS), so we consume `/api/v1/events/stream` with streaming
 * `fetch` here, parse the text/event-stream frames by hand, and forward each
 * event to the renderer over IPC. Reconnects with a fixed backoff.
 */

import type { ConnectionConfig, EventStreamStatus } from '../../shared/ipc';
import { IpcChannels } from '../../shared/ipc';
import type { KasasEvent } from '../../shared/kasas-types';
import { MOCK, syntheticEvent } from './mock';

const RECONNECT_MS = 3000;
const MOCK_EVENT_MS = 12_000;

type Broadcast = (channel: string, payload: unknown) => void;

export class EventStream {
  private controller: AbortController | null = null;
  private stopped = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private mockTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly getConn: () => ConnectionConfig,
    private readonly broadcast: Broadcast,
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    // In mock mode there is no kasas to stream from — report "connected" and
    // emit a synthetic change event on a timer so the live widgets aren't idle.
    if (MOCK) {
      this.emitStatus({ connected: true });
      this.mockTimer = setInterval(
        () => this.broadcast(IpcChannels.kasasEvent, syntheticEvent()),
        MOCK_EVENT_MS,
      );
      return;
    }
    void this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.mockTimer) {
      clearInterval(this.mockTimer);
      this.mockTimer = null;
    }
    this.controller?.abort();
    this.controller = null;
    this.emitStatus({ connected: false });
  }

  /** Restart with whatever the current connection config is (after creds change). */
  restart(): void {
    const wasRunning = !this.stopped;
    this.stop();
    if (wasRunning) this.start();
  }

  private emitStatus(status: EventStreamStatus): void {
    this.broadcast(IpcChannels.eventStatus, status);
  }

  private async connect(): Promise<void> {
    const conn = this.getConn();
    this.controller = new AbortController();

    const headers: Record<string, string> = { Accept: 'text/event-stream' };
    if (conn.token) headers.Authorization = `Bearer ${conn.token}`;

    try {
      const res = await fetch(new URL('/api/v1/events/stream', conn.baseUrl).toString(), {
        headers,
        signal: this.controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`stream HTTP ${res.status}`);

      this.emitStatus({ connected: true });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE frames are separated by a blank line.
        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          this.dispatch(buffer.slice(0, sep));
          buffer = buffer.slice(sep + 2);
        }
      }
      throw new Error('stream closed');
    } catch (err) {
      if (this.stopped) return; // aborted on purpose
      this.emitStatus({
        connected: false,
        error: err instanceof Error ? err.message : String(err),
      });
      this.scheduleReconnect();
    }
  }

  private dispatch(frame: string): void {
    let eventType = 'message';
    const dataLines: string[] = [];

    for (const line of frame.split('\n')) {
      if (line === '' || line.startsWith(':')) continue; // heartbeat / comment
      if (line.startsWith('event:')) eventType = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
    }
    if (dataLines.length === 0) return;

    const dataStr = dataLines.join('\n');
    let parsed: unknown = dataStr;
    try {
      parsed = JSON.parse(dataStr);
    } catch {
      /* keep the raw string */
    }

    const event: KasasEvent =
      parsed && typeof parsed === 'object'
        ? { type: eventType, ...(parsed as Record<string, unknown>) }
        : { type: eventType, data: parsed };

    this.broadcast(IpcChannels.kasasEvent, event);
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    this.reconnectTimer = setTimeout(() => void this.connect(), RECONNECT_MS);
  }
}
