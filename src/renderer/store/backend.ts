/**
 * Managed-backend store: kasas settings, live process status, and a log tail.
 * Mirrors the connection store pattern. When the backend transitions to ready,
 * it nudges the connection store to re-test so widgets refetch real data.
 */

import { create } from 'zustand';
import type {
  KasasLogLine,
  KasasSettings,
  KasasStatus,
  KasasUpdateInfo,
  KasasUpdateResult,
} from '../../shared/ipc';
import { useConnection } from './connection';

interface BackendStore {
  settings: KasasSettings | null;
  status: KasasStatus | null;
  logs: KasasLogLine[];
  updateInfo: KasasUpdateInfo | null;
  checking: boolean;
  updating: boolean;

  init: () => Promise<void>;
  saveSettings: (settings: KasasSettings) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  restart: () => Promise<void>;
  setBackground: (enabled: boolean) => Promise<void>;
  revealData: () => Promise<void>;
  checkUpdate: () => Promise<void>;
  applyUpdate: () => Promise<KasasUpdateResult>;
}

let listenersBound = false;

export const useBackend = create<BackendStore>((set, get) => ({
  settings: null,
  status: null,
  logs: [],
  updateInfo: null,
  checking: false,
  updating: false,

  init: async () => {
    const [settings, status, logs] = await Promise.all([
      window.api.backend.getSettings(),
      window.api.backend.status(),
      window.api.backend.logs(),
    ]);
    set({ settings, status, logs });

    if (!listenersBound) {
      listenersBound = true;
      let lastReady = status.ready;
      window.api.backend.onStatus((s) => {
        set({ status: s });
        if (s.ready && !lastReady) void useConnection.getState().init();
        lastReady = s.ready;
      });
      window.api.backend.onLog((line) => {
        set((st) => ({ logs: [...st.logs, line].slice(-500) }));
      });
      window.api.backend.onUpdate((info) => set({ updateInfo: info }));
      // Renderer-driven auto-check on launch (reliable — avoids racing a
      // main-side broadcast fired before this listener was bound).
      void get().checkUpdate();
    }
  },

  saveSettings: async (settings) => {
    const status = await window.api.backend.setSettings(settings);
    set({ settings, status });
    await useConnection.getState().init();
  },

  start: async () => set({ status: await window.api.backend.start() }),
  stop: async () => set({ status: await window.api.backend.stop() }),

  restart: async () => {
    set({ status: await window.api.backend.restart() });
    await useConnection.getState().init();
  },

  setBackground: async (enabled) => {
    const status = await window.api.backend.setBackground(enabled);
    set((st) => ({
      status,
      settings: st.settings ? { ...st.settings, background: enabled } : st.settings,
    }));
    await useConnection.getState().init();
  },

  revealData: async () => {
    await window.api.backend.revealData();
  },

  checkUpdate: async () => {
    set({ checking: true });
    try {
      const updateInfo = await window.api.backend.checkUpdate();
      set({ updateInfo });
    } finally {
      set({ checking: false });
    }
  },

  applyUpdate: async () => {
    set({ updating: true });
    try {
      const result = await window.api.backend.applyUpdate();
      await useConnection.getState().init();
      return result;
    } finally {
      set({ updating: false });
    }
  },
}));
