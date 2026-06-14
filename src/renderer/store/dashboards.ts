/**
 * Saved-dashboards store. Persisted through IPC to a JSON file in userData (see
 * main/storage/dashboards.ts) via Zustand's `persist` middleware with async
 * storage. A single empty "Overview" dashboard is seeded once, after hydration,
 * only if nothing was loaded — so new users start with a clean slate they fill
 * themselves (and we never clobber a saved file).
 */

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { uid } from '../lib/utils';
import {
  addWidgetToDashboard,
  parseDashboardsFile,
  type Dashboard,
  type GridItem,
} from '../../shared/dashboards';
import type { WidgetSize } from '../../shared/widgets';

// The dashboard data model + on-disk format are shared (React-free) so the MCP
// server and the mock seeder produce the exact same file. Re-export the types so
// existing renderer imports (`from '../store/dashboards'`) keep working.
export type { Dashboard, GridItem, WidgetInstance } from '../../shared/dashboards';
export type { WidgetSize } from '../../shared/widgets';

interface DashboardsState {
  dashboards: Dashboard[];
  activeId: string | null;
  editing: boolean;
  hydrated: boolean;

  setActive: (id: string) => void;
  addDashboard: (name?: string) => void;
  removeDashboard: (id: string) => void;
  renameDashboard: (id: string, name: string) => void;
  setEditing: (editing: boolean) => void;
  toggleEditing: () => void;
  addWidget: (type: string, size: WidgetSize) => void;
  removeWidget: (instanceId: string) => void;
  updateWidgetConfig: (instanceId: string, config: Record<string, unknown>) => void;
  setLayout: (layout: GridItem[]) => void;
  finishHydration: () => void;
  /** Re-read dashboards.json after an external write (e.g. the MCP server). */
  reloadFromDisk: () => Promise<void>;
}

/** A single empty dashboard so new users start with a canvas, not content. */
function createStarterDashboard(): Dashboard {
  return { id: uid(), name: 'Overview', widgets: [], layout: [] };
}

/**
 * When true, a store `set()` must NOT write back to disk. The persist middleware
 * saves on every `set()`, but a reload triggered by an external (MCP) write is
 * just mirroring what's already on disk — echoing it back would be pure write
 * amplification and, worse, could clobber a racing MCP write with stale bytes.
 * Set synchronously around the reload `set()` (no awaits in between) so the
 * synchronous setItem the middleware fires sees it.
 */
let suppressPersist = false;

/** A watcher fired while the user was editing; re-run the reload once they stop. */
let pendingReload = false;

/** Zustand StateStorage backed by the main-process dashboards file. */
const ipcStorage: StateStorage = {
  getItem: (_name) => window.api.dashboards.load(),
  setItem: (_name, value) => {
    if (suppressPersist) return; // external reload — don't echo it back to disk
    return window.api.dashboards.save(value);
  },
  removeItem: (_name) => window.api.dashboards.save(''),
};

export const useDashboards = create<DashboardsState>()(
  persist(
    (set, get) => {
      const updateActive = (mutate: (d: Dashboard) => Dashboard) =>
        set((s) => ({
          dashboards: s.dashboards.map((d) => (d.id === s.activeId ? mutate(d) : d)),
        }));

      return {
        dashboards: [],
        activeId: null,
        editing: false,
        hydrated: false,

        setActive: (id) => set({ activeId: id }),

        addDashboard: (name) => {
          const d: Dashboard = {
            id: uid(),
            name: name?.trim() || 'New dashboard',
            widgets: [],
            layout: [],
          };
          set((s) => ({
            dashboards: [...s.dashboards, d],
            activeId: d.id,
            editing: true,
          }));
        },

        removeDashboard: (id) =>
          set((s) => {
            const dashboards = s.dashboards.filter((d) => d.id !== id);
            const activeId =
              s.activeId === id ? (dashboards[0]?.id ?? null) : s.activeId;
            return { dashboards, activeId };
          }),

        renameDashboard: (id, name) =>
          set((s) => ({
            dashboards: s.dashboards.map((d) =>
              d.id === id ? { ...d, name: name.trim() || d.name } : d,
            ),
          })),

        setEditing: (editing) => {
          set({ editing });
          if (!editing && pendingReload) {
            pendingReload = false;
            void get().reloadFromDisk();
          }
        },
        toggleEditing: () => {
          const editing = !get().editing;
          set({ editing });
          if (!editing && pendingReload) {
            pendingReload = false;
            void get().reloadFromDisk();
          }
        },

        addWidget: (type, size) =>
          updateActive((d) => addWidgetToDashboard(d, { id: uid(), type }, size)),

        removeWidget: (instanceId) =>
          updateActive((d) => ({
            ...d,
            widgets: d.widgets.filter((w) => w.id !== instanceId),
            layout: d.layout.filter((l) => l.i !== instanceId),
          })),

        updateWidgetConfig: (instanceId, config) =>
          updateActive((d) => ({
            ...d,
            widgets: d.widgets.map((w) =>
              w.id === instanceId ? { ...w, config: { ...w.config, ...config } } : w,
            ),
          })),

        setLayout: (layout) => updateActive((d) => ({ ...d, layout })),

        finishHydration: () =>
          set((s) => {
            if (s.hydrated) return s;
            if (s.dashboards.length === 0) {
              const starter = createStarterDashboard();
              return { dashboards: [starter], activeId: starter.id, hydrated: true };
            }
            const activeId =
              s.activeId && s.dashboards.some((d) => d.id === s.activeId)
                ? s.activeId
                : s.dashboards[0].id;
            return { activeId, hydrated: true };
          }),

        reloadFromDisk: async () => {
          // Don't yank the canvas out from under an in-progress drag/resize; defer
          // until the user leaves edit mode (see setEditing/toggleEditing).
          if (get().editing) {
            pendingReload = true;
            return;
          }
          const raw = await window.api.dashboards.load();
          if (!raw) return; // first-run/empty sentinel — nothing on disk to apply
          let parsed: ReturnType<typeof parseDashboardsFile>;
          try {
            parsed = parseDashboardsFile(raw);
          } catch {
            return; // torn/garbage read — keep the current state
          }
          // A valid empty state means an external delete-all (e.g. MCP deleted the
          // last dashboard). Reseed a starter like finishHydration does, and let it
          // persist so disk and the running app agree.
          if (parsed.dashboards.length === 0) {
            const starter = createStarterDashboard();
            set({ dashboards: [starter], activeId: starter.id });
            return;
          }
          // Mirror the on-disk dashboards WITHOUT persisting (suppressPersist) so we
          // don't echo a write that could race/clobber a concurrent MCP write.
          suppressPersist = true;
          try {
            set((s) => {
              const keep = (id: string | null) =>
                !!id && parsed.dashboards.some((d) => d.id === id);
              const next = keep(parsed.activeId)
                ? parsed.activeId
                : keep(s.activeId)
                  ? s.activeId
                  : parsed.dashboards[0].id;
              return { dashboards: parsed.dashboards, activeId: next };
            });
          } finally {
            suppressPersist = false;
          }
        },
      };
    },
    {
      name: 'sillview-dashboards',
      storage: createJSONStorage(() => ipcStorage),
      // Only the saved data is persisted; UI flags stay transient.
      partialize: (s) => ({ dashboards: s.dashboards, activeId: s.activeId }),
    },
  ),
);

export function useActiveDashboard(): Dashboard | null {
  return useDashboards((s) => s.dashboards.find((d) => d.id === s.activeId) ?? null);
}
