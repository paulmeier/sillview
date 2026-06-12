/**
 * Connection store: holds the kasas connection config, online/auth status, live
 * stream connectivity, and a couple of monotonic counters used to drive refetches
 * (`version` bumps on each successful (re)connect; `eventNonce` bumps — throttled
 * — when kasas pushes a change event, so widgets can refresh live).
 */

import { create } from 'zustand';
import type { ConnectionConfig } from '../../shared/ipc';
import type { AuthStatus } from '../../shared/kasas-types';

type Status = 'unknown' | 'connecting' | 'online' | 'offline';

interface ConnectionState {
  config: ConnectionConfig;
  status: Status;
  auth?: AuthStatus;
  error?: string;
  streamConnected: boolean;
  /** Bumped on each successful connection — widgets refetch when it changes. */
  version: number;
  /** Throttled live-event tick — widgets that opt in refetch when it changes. */
  eventNonce: number;
  /**
   * Per-family throttled ticks keyed by the event-type prefix (the part before
   * the first dot, e.g. "transaction", "rule", "plugin"). Pages subscribe only
   * to the families they care about so a label change doesn't refetch Plugins.
   */
  familyNonces: Record<string, number>;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  save: (config: ConnectionConfig) => Promise<void>;
}

let listenersBound = false;

export const useConnection = create<ConnectionState>((set, get) => ({
  config: { baseUrl: 'http://127.0.0.1:8080', token: '' },
  status: 'unknown',
  streamConnected: false,
  version: 0,
  eventNonce: 0,
  familyNonces: {},

  init: async () => {
    const config = await window.api.connection.get();
    set({ config });

    if (!listenersBound) {
      listenersBound = true;
      window.api.events.onStatus((s) => set({ streamConnected: s.connected }));

      let lastTick = 0;
      const familyTicks: Record<string, number> = {};
      window.api.events.onEvent((e) => {
        const now = Date.now();
        // Global throttled tick (back-compat for widgets that opt into `live`).
        if (now - lastTick > 1000) {
          lastTick = now;
          set((s) => ({ eventNonce: s.eventNonce + 1 }));
        }
        // Per-family throttled tick for targeted page refreshes.
        const family = String(e.type ?? '').split('.')[0] || 'message';
        if (now - (familyTicks[family] ?? 0) > 1000) {
          familyTicks[family] = now;
          set((s) => ({
            familyNonces: { ...s.familyNonces, [family]: (s.familyNonces[family] ?? 0) + 1 },
          }));
        }
      });

      await window.api.events.start();
    }

    await get().refresh();
  },

  refresh: async () => {
    set({ status: 'connecting', error: undefined });
    const res = await window.api.connection.test();
    if (res.ok) {
      set((s) => ({
        status: 'online',
        auth: res.data as AuthStatus,
        version: s.version + 1,
        error: undefined,
      }));
    } else {
      set({ status: 'offline', error: res.error });
    }
  },

  save: async (config) => {
    const saved = await window.api.connection.set(config);
    set({ config: saved });
    await get().refresh();
  },
}));
