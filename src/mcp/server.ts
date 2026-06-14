/**
 * sillview MCP server — lets an LLM author dashboards and widgets.
 *
 * A standalone stdio MCP server (NOT part of the Electron app) that reads and
 * writes sillview's dashboards.json directly. The running app watches that file
 * and live-reloads, so changes appear without a restart; if the app is closed,
 * they show on next launch. Point an MCP client at the bundled output:
 *
 *   { "command": "node", "args": ["<repo>/dist-mcp/server.mjs"] }
 *
 * Build it with `npm run build:mcp`. Resolve a non-default data dir with the
 * SILLVIEW_DATA_DIR / SILLVIEW_APP_NAME env vars (see paths.ts) — e.g. set
 * SILLVIEW_APP_NAME=Electron when targeting a `npm start` dev build.
 *
 * Protocol note: stdout is reserved for the MCP transport — all logging goes to
 * stderr.
 */

import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  addWidgetToDashboard,
  type Dashboard,
  type DashboardsState,
  type WidgetInstance,
} from '../shared/dashboards';
import {
  KNOWN_WIDGET_TYPES,
  validateWidgetConfig,
  widgetMetaByType,
  WIDGET_META,
} from '../shared/widgets';
import type {
  Account,
  AccountsResponse,
  MarketSeriesResponse,
} from '../shared/kasas-types';
import { findDashboard, mutate, readState } from './store';
import { kasasGet, resolveConnection } from './kasas';

const SERVER_NAME = 'sillview';
const SERVER_VERSION = '0.1.0';

type ToolResult = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

/** Success result carrying a JSON payload the model can read. */
function ok(payload: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

/** Error result — surfaced to the model as an actionable message. */
function fail(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/** A thrown error we want reported verbatim to the model (not a 500-style crash). */
class ToolError extends Error {}

function replaceDashboard(state: DashboardsState, d: Dashboard): DashboardsState {
  return { ...state, dashboards: state.dashboards.map((x) => (x.id === d.id ? d : x)) };
}

/** Resolve a dashboard ref (id or name) within a mutation, or throw a ToolError. */
function requireDashboard(state: DashboardsState, ref: string): Dashboard {
  const d = findDashboard(state, ref);
  if (!d) throw new ToolError(`No dashboard matches "${ref}" (by id or name).`);
  return d;
}

/** A compact, model-friendly view of a dashboard (id, name, widget summary). */
function summarizeDashboard(d: Dashboard, activeId: string | null) {
  return {
    id: d.id,
    name: d.name,
    active: d.id === activeId,
    widgetCount: d.widgets.length,
    widgets: d.widgets.map((w) => ({ id: w.id, type: w.type, config: w.config })),
  };
}

/** Build a validated widget instance from a type + optional config, or throw. */
function buildWidget(type: string, config: unknown): WidgetInstance {
  const check = validateWidgetConfig(type, config);
  if (!check.ok) throw new ToolError(check.error);
  const widget: WidgetInstance = { id: randomUUID(), type };
  if (check.config) widget.config = check.config;
  return widget;
}

const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

// --- Catalog --------------------------------------------------------------

server.registerTool(
  'list_widget_types',
  {
    title: 'List widget types',
    description:
      'List every widget that can be placed on a dashboard, with its default grid size and config contract. Call this before add_widget so you use a valid `type` and the right `config` keys.',
    inputSchema: {},
  },
  async (): Promise<ToolResult> =>
    ok(
      WIDGET_META.map((m) => ({
        type: m.type,
        title: m.title,
        description: m.description,
        category: m.category,
        defaultSize: m.defaultSize,
        config:
          m.configSpec && m.configSpec.length
            ? m.configSpec.map((s) => ({
                key: s.key,
                accepts: s.types,
                required: !!s.required,
                description: s.description,
              }))
            : 'none',
      })),
    ),
);

// --- Read -----------------------------------------------------------------

server.registerTool(
  'list_dashboards',
  {
    title: 'List dashboards',
    description: 'List all saved dashboards with their ids, names, and widget counts.',
    inputSchema: {},
  },
  async (): Promise<ToolResult> => {
    const state = await readState();
    return ok({
      activeId: state.activeId,
      dashboards: state.dashboards.map((d) => summarizeDashboard(d, state.activeId)),
    });
  },
);

server.registerTool(
  'get_dashboard',
  {
    title: 'Get dashboard',
    description: 'Get one dashboard (by id or exact name), including its widgets and grid layout.',
    inputSchema: { dashboard: z.string().describe('Dashboard id or exact name.') },
  },
  async ({ dashboard }): Promise<ToolResult> => {
    const state = await readState();
    const d = findDashboard(state, dashboard);
    if (!d) return fail(`No dashboard matches "${dashboard}" (by id or name).`);
    return ok({ ...d, active: d.id === state.activeId });
  },
);

// --- Write ----------------------------------------------------------------

server.registerTool(
  'create_dashboard',
  {
    title: 'Create dashboard',
    description:
      'Create a new dashboard, optionally pre-filled with widgets and made the active dashboard. Widgets are stacked top-to-bottom in the order given.',
    inputSchema: {
      name: z.string().describe('Display name for the dashboard.'),
      activate: z
        .boolean()
        .optional()
        .describe('Make this the active (shown) dashboard. Default true.'),
      widgets: z
        .array(
          z.object({
            type: z.string().describe(`Widget type. One of: ${KNOWN_WIDGET_TYPES.join(', ')}.`),
            config: z.record(z.string(), z.unknown()).optional().describe('Optional widget config.'),
          }),
        )
        .optional()
        .describe('Optional initial widgets to add, in stacking order.'),
    },
  },
  async ({ name, activate, widgets }): Promise<ToolResult> => {
    const cleanName = name.trim();
    if (!cleanName) return fail('Dashboard name must not be empty.');
    // Validate every widget up front so we never write a partial dashboard.
    let built: WidgetInstance[];
    try {
      built = (widgets ?? []).map((w) => buildWidget(w.type, w.config));
    } catch (err) {
      return fail(err instanceof ToolError ? err.message : String(err));
    }

    try {
      const created = await mutate((state) => {
        let dashboard: Dashboard = { id: randomUUID(), name: cleanName, widgets: [], layout: [] };
        for (const widget of built) {
          dashboard = addWidgetToDashboard(
            dashboard,
            widget,
            widgetMetaByType[widget.type].defaultSize,
          );
        }
        const dashboards = [...state.dashboards, dashboard];
        const activeId = activate === false ? state.activeId : dashboard.id;
        return { state: { dashboards, activeId }, result: { dashboard, activeId } };
      });
      return ok({ created: summarizeDashboard(created.dashboard, created.activeId) });
    } catch (err) {
      return fail(err instanceof ToolError ? err.message : String(err));
    }
  },
);

server.registerTool(
  'add_widget',
  {
    title: 'Add widget',
    description:
      'Add a widget to a dashboard. The widget is placed full-width-left, stacked below existing widgets — exactly where the in-app "Add widget" button puts it.',
    inputSchema: {
      dashboard: z.string().describe('Dashboard id or exact name.'),
      type: z.string().describe(`Widget type. One of: ${KNOWN_WIDGET_TYPES.join(', ')}.`),
      config: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Optional widget config (see list_widget_types for valid keys).'),
    },
  },
  async ({ dashboard, type, config }): Promise<ToolResult> => {
    let widget: WidgetInstance;
    try {
      widget = buildWidget(type, config);
    } catch (err) {
      return fail(err instanceof ToolError ? err.message : String(err));
    }
    try {
      const result = await mutate((state) => {
        const d = requireDashboard(state, dashboard);
        const next = addWidgetToDashboard(d, widget, widgetMetaByType[type].defaultSize);
        return { state: replaceDashboard(state, next), result: { dashboardId: next.id, widget } };
      });
      return ok({ added: result });
    } catch (err) {
      return fail(err instanceof ToolError ? err.message : String(err));
    }
  },
);

server.registerTool(
  'update_widget_config',
  {
    title: 'Update widget config',
    description:
      'Update a widget instance’s config. By default the given keys are merged into the existing config; pass replace:true to overwrite it entirely.',
    inputSchema: {
      dashboard: z.string().describe('Dashboard id or exact name.'),
      widgetId: z.string().describe('The widget instance id (from get_dashboard).'),
      config: z.record(z.string(), z.unknown()).describe('Config keys to set.'),
      replace: z
        .boolean()
        .optional()
        .describe('Replace the whole config instead of merging. Default false.'),
    },
  },
  async ({ dashboard, widgetId, config, replace }): Promise<ToolResult> => {
    try {
      const result = await mutate((state) => {
        const d = requireDashboard(state, dashboard);
        const widget = d.widgets.find((w) => w.id === widgetId);
        if (!widget) throw new ToolError(`No widget "${widgetId}" in dashboard "${d.name}".`);
        const merged = replace ? config : { ...widget.config, ...config };
        const check = validateWidgetConfig(widget.type, merged);
        if (!check.ok) throw new ToolError(check.error);
        const nextWidget: WidgetInstance = { ...widget };
        if (check.config) nextWidget.config = check.config;
        else delete nextWidget.config;
        const next: Dashboard = {
          ...d,
          widgets: d.widgets.map((w) => (w.id === widgetId ? nextWidget : w)),
        };
        return { state: replaceDashboard(state, next), result: nextWidget };
      });
      return ok({ updated: result });
    } catch (err) {
      return fail(err instanceof ToolError ? err.message : String(err));
    }
  },
);

server.registerTool(
  'remove_widget',
  {
    title: 'Remove widget',
    description: 'Remove a widget instance (and its layout slot) from a dashboard.',
    inputSchema: {
      dashboard: z.string().describe('Dashboard id or exact name.'),
      widgetId: z.string().describe('The widget instance id (from get_dashboard).'),
    },
  },
  async ({ dashboard, widgetId }): Promise<ToolResult> => {
    try {
      const result = await mutate((state) => {
        const d = requireDashboard(state, dashboard);
        if (!d.widgets.some((w) => w.id === widgetId)) {
          throw new ToolError(`No widget "${widgetId}" in dashboard "${d.name}".`);
        }
        const next: Dashboard = {
          ...d,
          widgets: d.widgets.filter((w) => w.id !== widgetId),
          layout: d.layout.filter((l) => l.i !== widgetId),
        };
        return { state: replaceDashboard(state, next), result: { dashboardId: d.id, widgetId } };
      });
      return ok({ removed: result });
    } catch (err) {
      return fail(err instanceof ToolError ? err.message : String(err));
    }
  },
);

server.registerTool(
  'rename_dashboard',
  {
    title: 'Rename dashboard',
    description: 'Rename a dashboard.',
    inputSchema: {
      dashboard: z.string().describe('Dashboard id or exact name.'),
      name: z.string().describe('New display name.'),
    },
  },
  async ({ dashboard, name }): Promise<ToolResult> => {
    const cleanName = name.trim();
    if (!cleanName) return fail('Dashboard name must not be empty.');
    try {
      const result = await mutate((state) => {
        const d = requireDashboard(state, dashboard);
        const next: Dashboard = { ...d, name: cleanName };
        return { state: replaceDashboard(state, next), result: { id: d.id, name: cleanName } };
      });
      return ok({ renamed: result });
    } catch (err) {
      return fail(err instanceof ToolError ? err.message : String(err));
    }
  },
);

server.registerTool(
  'delete_dashboard',
  {
    title: 'Delete dashboard',
    description:
      'Delete a dashboard. If it was the active dashboard, the first remaining one becomes active.',
    inputSchema: { dashboard: z.string().describe('Dashboard id or exact name.') },
  },
  async ({ dashboard }): Promise<ToolResult> => {
    try {
      const result = await mutate((state) => {
        const d = requireDashboard(state, dashboard);
        const dashboards = state.dashboards.filter((x) => x.id !== d.id);
        const activeId =
          state.activeId === d.id ? (dashboards[0]?.id ?? null) : state.activeId;
        return { state: { dashboards, activeId }, result: { deletedId: d.id, activeId } };
      });
      return ok({ deleted: result });
    } catch (err) {
      return fail(err instanceof ToolError ? err.message : String(err));
    }
  },
);

server.registerTool(
  'set_active_dashboard',
  {
    title: 'Set active dashboard',
    description: 'Set which dashboard is shown when the app opens it.',
    inputSchema: { dashboard: z.string().describe('Dashboard id or exact name.') },
  },
  async ({ dashboard }): Promise<ToolResult> => {
    try {
      const result = await mutate((state) => {
        const d = requireDashboard(state, dashboard);
        return { state: { ...state, activeId: d.id }, result: { activeId: d.id } };
      });
      return ok(result);
    } catch (err) {
      return fail(err instanceof ToolError ? err.message : String(err));
    }
  },
);

// --- Discovery (read-only kasas data, for picking valid ids) --------------

server.registerTool(
  'list_accounts',
  {
    title: 'List accounts',
    description:
      'List kasas accounts (id, name, currency, balance) so you can use a real `account` id for benchmark-comparison or transactions widgets. Requires kasas to be running.',
    inputSchema: {},
  },
  async (): Promise<ToolResult> => {
    const conn = await resolveConnection();
    if (!conn) return fail('Could not resolve a kasas connection (no backend.json and no KASAS_BASE_URL).');
    const res = await kasasGet<AccountsResponse>(conn, '/api/v1/accounts');
    if (!res.ok) {
      return fail(
        `Could not reach kasas at ${conn.baseUrl} (${res.error}). Make sure sillview/kasas is running, or set KASAS_BASE_URL/KASAS_TOKEN.`,
      );
    }
    const accounts: Account[] = res.data?.accounts ?? [];
    return ok({
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        balance: a.balance,
      })),
    });
  },
);

server.registerTool(
  'list_market_series',
  {
    title: 'List market series',
    description:
      'List configured kasas market series (id, symbol, name) so you can use real `series` ids for market-series and benchmark-comparison widgets. Requires kasas to be running with market data enabled.',
    inputSchema: {},
  },
  async (): Promise<ToolResult> => {
    const conn = await resolveConnection();
    if (!conn) return fail('Could not resolve a kasas connection (no backend.json and no KASAS_BASE_URL).');
    const res = await kasasGet<MarketSeriesResponse>(conn, '/api/v1/market/series');
    if (!res.ok) {
      return fail(
        `Could not reach kasas at ${conn.baseUrl} (${res.error}). Make sure sillview/kasas is running, or set KASAS_BASE_URL/KASAS_TOKEN.`,
      );
    }
    const data = res.data;
    return ok({
      enabled: data?.enabled ?? false,
      provider: data?.provider ?? '',
      configured: data?.configured ?? false,
      series: (data?.series ?? []).map((s) => ({
        id: s.id,
        symbol: s.symbol,
        name: s.name,
        kind: s.kind,
        currency: s.currency,
      })),
    });
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVER_NAME}] MCP server ready (stdio).`);
}

main().catch((err) => {
  console.error(`[${SERVER_NAME}] fatal:`, err);
  process.exit(1);
});
