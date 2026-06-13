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

export interface WidgetInstance {
  id: string;
  type: string;
  config?: Record<string, unknown>;
}

export interface GridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  static?: boolean;
}

export interface Dashboard {
  id: string;
  name: string;
  widgets: WidgetInstance[];
  layout: GridItem[];
}

export interface WidgetSize {
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

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
}

/** A single empty dashboard so new users start with a canvas, not content. */
function createStarterDashboard(): Dashboard {
  return { id: uid(), name: 'Overview', widgets: [], layout: [] };
}

/** Zustand StateStorage backed by the main-process dashboards file. */
const ipcStorage: StateStorage = {
  getItem: (_name) => window.api.dashboards.load(),
  setItem: (_name, value) => window.api.dashboards.save(value),
  removeItem: (_name) => window.api.dashboards.save(''),
};

export const useDashboards = create<DashboardsState>()(
  persist(
    (set) => {
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

        setEditing: (editing) => set({ editing }),
        toggleEditing: () => set((s) => ({ editing: !s.editing })),

        addWidget: (type, size) =>
          updateActive((d) => {
            const id = uid();
            const y = d.layout.reduce((max, it) => Math.max(max, it.y + it.h), 0);
            const item: GridItem = {
              i: id,
              x: 0,
              y,
              w: size.w,
              h: size.h,
              minW: size.minW,
              minH: size.minH,
            };
            return {
              ...d,
              widgets: [...d.widgets, { id, type }],
              layout: [...d.layout, item],
            };
          }),

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
