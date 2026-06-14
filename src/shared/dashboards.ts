/**
 * The saved-dashboards data model and on-disk format — pure and React-free, so it
 * is shared by the renderer's Zustand store, the mock seeder, and the standalone
 * MCP server (src/mcp).
 *
 * WHY THIS EXISTS: dashboards.json is the Zustand `persist` envelope
 * `{ "state": { dashboards, activeId }, "version": 0 }`, NOT a bare array. Anything
 * that reads or writes the file must go through the (de)serialize helpers here to
 * stay byte-compatible with what the renderer hydrates.
 */

import type { WidgetSize } from './widgets';

export interface WidgetInstance {
  id: string;
  type: string;
  config?: Record<string, unknown>;
}

/** A react-grid-layout item. `i` MUST equal the matching WidgetInstance.id. */
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

/** The persisted slice (Zustand `partialize`). */
export interface DashboardsState {
  dashboards: Dashboard[];
  activeId: string | null;
}

/** The full on-disk envelope Zustand's persist middleware writes. */
export interface DashboardsFile {
  state: DashboardsState;
  version: number;
}

/** Zustand defaults the persist version to 0; the store declares no migrations. */
export const PERSIST_VERSION = 0;

/**
 * Serialize dashboards to the exact JSON the renderer's persist store writes.
 * Key order (state before version; dashboards before activeId) matches Zustand so
 * an MCP write is byte-identical to an app save of the same data.
 */
export function serializeDashboardsFile(
  dashboards: Dashboard[],
  activeId: string | null,
): string {
  const file: DashboardsFile = {
    state: { dashboards, activeId },
    version: PERSIST_VERSION,
  };
  return JSON.stringify(file);
}

/**
 * Parse a dashboards.json blob into its state. Tolerates the empty cases the store
 * can produce (null on first run, '' from removeItem) by returning an empty state;
 * throws only on malformed JSON.
 */
export function parseDashboardsFile(contents: string | null): DashboardsState {
  if (!contents) return { dashboards: [], activeId: null };
  const parsed = JSON.parse(contents) as Partial<DashboardsFile>;
  const state = parsed.state ?? { dashboards: [], activeId: null };
  return {
    dashboards: Array.isArray(state.dashboards) ? state.dashboards : [],
    activeId: state.activeId ?? null,
  };
}

/**
 * The grid slot the UI gives a freshly added widget: left-aligned (x:0), stacked
 * directly below the tallest existing item. Mirrors the renderer's addWidget
 * reducer so MCP-added widgets land exactly where the marketplace would put them.
 */
export function placeWidgetBelow(layout: GridItem[], size: WidgetSize, id: string): GridItem {
  const y = layout.reduce((max, it) => Math.max(max, it.y + it.h), 0);
  return { i: id, x: 0, y, w: size.w, h: size.h, minW: size.minW, minH: size.minH };
}

/** Append a widget instance + its stacked layout slot to a dashboard (immutably). */
export function addWidgetToDashboard(
  dashboard: Dashboard,
  widget: WidgetInstance,
  size: WidgetSize,
): Dashboard {
  return {
    ...dashboard,
    widgets: [...dashboard.widgets, widget],
    layout: [...dashboard.layout, placeWidgetBelow(dashboard.layout, size, widget.id)],
  };
}
