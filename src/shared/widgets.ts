/**
 * The widget catalog as pure, serializable metadata — no React, no DOM imports.
 *
 * WHY THIS EXISTS: the renderer's `widgets/registry.ts` couples each widget to a
 * React icon + component, so it cannot be imported by a plain-Node process. The
 * standalone MCP server (src/mcp) needs to know which widgets exist and how to
 * validate an LLM-authored config without pulling in React. So the metadata lives
 * here; `registry.ts` imports it and attaches the React bits on top.
 *
 * `configFields` is the Configure-dialog UI contract (only a few widgets have
 * any). `configSpec` is the AUTHORITATIVE config contract used for validation —
 * it captures every key a widget actually reads, which `configFields` does not.
 */

export type WidgetCategory = 'Overview' | 'Accounts' | 'Spending' | 'Activity' | 'Market';

/** Marketplace display order for categories. */
export const CATEGORY_ORDER: WidgetCategory[] = [
  'Overview',
  'Accounts',
  'Spending',
  'Activity',
  'Market',
];

/** A widget's footprint on the 12-column grid (rowHeight 56px). */
export interface WidgetSize {
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

/** One configurable knob for a widget instance, rendered in the Configure dialog. */
export interface WidgetConfigField {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select';
  default?: string | number;
  options?: { value: string; label: string }[];
  help?: string;
}

/** A config key a widget actually reads — the unit of config validation. */
export interface WidgetConfigSpec {
  key: string;
  /**
   * Accepted runtime types; a value may satisfy any one of them (e.g.
   * market-series.series is a string OR a string[]). 'string[]' means an array
   * of strings.
   */
  types: ('string' | 'number' | 'string[]')[];
  required?: boolean;
  description: string;
}

/** Pure metadata for one widget type. */
export interface WidgetMeta {
  type: string;
  title: string;
  description: string;
  category: WidgetCategory;
  defaultSize: WidgetSize;
  /** UI knobs (Configure dialog). NOT a complete config schema — see configSpec. */
  configFields?: WidgetConfigField[];
  /** Authoritative config contract for validation. Absent = takes no config. */
  configSpec?: WidgetConfigSpec[];
}

export const WIDGET_META: WidgetMeta[] = [
  {
    type: 'net-worth',
    title: 'Net Worth',
    description: 'Total balance across all accounts, grouped by currency.',
    category: 'Overview',
    defaultSize: { w: 4, h: 3, minW: 3, minH: 2 },
  },
  {
    type: 'sync-status',
    title: 'Sync Status',
    description: 'Backend connectivity and the most recent sync run.',
    category: 'Overview',
    defaultSize: { w: 4, h: 3, minW: 3, minH: 2 },
  },
  {
    type: 'accounts-list',
    title: 'Accounts',
    description: 'Every account with its current balance.',
    category: 'Accounts',
    defaultSize: { w: 4, h: 6, minW: 3, minH: 3 },
  },
  {
    type: 'account-balances',
    title: 'Account Balances',
    description: 'Bar chart comparing balances across accounts.',
    category: 'Accounts',
    defaultSize: { w: 4, h: 6, minW: 3, minH: 4 },
  },
  {
    type: 'transactions',
    title: 'Transactions',
    description: 'The most recent transactions across all accounts.',
    category: 'Activity',
    defaultSize: { w: 6, h: 7, minW: 4, minH: 4 },
    configFields: [
      {
        key: 'limit',
        label: 'Rows shown',
        type: 'number',
        default: 40,
        help: 'How many recent transactions to list.',
      },
    ],
    configSpec: [
      {
        key: 'limit',
        types: ['number', 'string'],
        description: 'How many recent transactions to list (default 40).',
      },
      {
        key: 'accountId',
        types: ['string'],
        description: 'Restrict to a single account id; omit for all accounts.',
      },
    ],
  },
  {
    type: 'spend-by-label',
    title: 'Spending Breakdown',
    description: 'Outflow grouped by your most-used label (or payee).',
    category: 'Spending',
    defaultSize: { w: 4, h: 6, minW: 3, minH: 4 },
  },
  {
    type: 'cashflow',
    title: 'Cash Flow',
    description: 'Money in vs. out per month over the last six months.',
    category: 'Spending',
    defaultSize: { w: 8, h: 5, minW: 4, minH: 4 },
  },
  {
    type: 'activity-feed',
    title: 'Live Activity',
    description: 'A live feed of change events streamed from kasas.',
    category: 'Activity',
    defaultSize: { w: 4, h: 6, minW: 3, minH: 3 },
  },
  {
    type: 'benchmark-comparison',
    title: 'Benchmark Comparison',
    description:
      'A market series as "growth of $10k" alongside an account balance, for context.',
    category: 'Market',
    defaultSize: { w: 8, h: 5, minW: 4, minH: 4 },
    configSpec: [
      {
        key: 'series',
        types: ['string'],
        description: 'A market series id (e.g. "spy"). See the list_market_series tool.',
      },
      {
        key: 'account',
        types: ['string'],
        description: 'An account id (e.g. "acc_brokerage"). See the list_accounts tool.',
      },
    ],
  },
  {
    type: 'market-series',
    title: 'Market Series',
    description:
      'Overlay one or more market series on one chart — two or more compare as "growth of $10k". Toggle lines with checkboxes.',
    category: 'Market',
    defaultSize: { w: 6, h: 5, minW: 4, minH: 3 },
    configSpec: [
      {
        key: 'series',
        types: ['string', 'string[]'],
        description:
          'One market series id, or an array of ids to overlay (e.g. ["spy","agg"]). See the list_market_series tool.',
      },
    ],
  },
  {
    type: 'market-overlay',
    title: 'Price Overlay',
    description:
      'Raw spot prices of one or more market series on a shared axis (e.g. Gold/Silver/Platinum), with optional SMA/EMA moving-average lines overlaid on the first series.',
    category: 'Market',
    defaultSize: { w: 6, h: 5, minW: 4, minH: 3 },
    configSpec: [
      {
        key: 'series',
        types: ['string', 'string[]'],
        description:
          'One market series id, or an array of ids to overlay as raw prices (e.g. ["gold","silver","platinum"]). See the list_market_series tool.',
      },
      {
        key: 'sma',
        types: ['number', 'string'],
        description:
          'Simple moving-average period (e.g. 50) overlaid on the first series, computed in-app. Omit for none.',
      },
      {
        key: 'ema',
        types: ['number', 'string'],
        description:
          'Exponential moving-average period (e.g. 20) overlaid on the first series, computed in-app. Omit for none.',
      },
    ],
  },
];

export const widgetMetaByType: Record<string, WidgetMeta> = Object.fromEntries(
  WIDGET_META.map((w) => [w.type, w]),
);

/** Every valid widget `type` string. */
export const KNOWN_WIDGET_TYPES: string[] = WIDGET_META.map((w) => w.type);

export function isKnownWidgetType(type: string): boolean {
  return type in widgetMetaByType;
}

export type ConfigValidation =
  | { ok: true; config: Record<string, unknown> | undefined }
  | { ok: false; error: string };

/**
 * Validate an LLM-supplied config for a widget type. Lenient on value types where
 * the widgets themselves are (numeric strings, string|string[]); strict about
 * unknown keys so a typo surfaces as an error instead of silently rendering an
 * empty widget. Returns the config back (or undefined when empty) on success.
 */
export function validateWidgetConfig(type: string, config: unknown): ConfigValidation {
  const meta = widgetMetaByType[type];
  if (!meta) {
    return {
      ok: false,
      error: `Unknown widget type "${type}". Known types: ${KNOWN_WIDGET_TYPES.join(', ')}.`,
    };
  }

  if (config === undefined || config === null) return { ok: true, config: undefined };
  if (typeof config !== 'object' || Array.isArray(config)) {
    return { ok: false, error: `config for "${type}" must be an object.` };
  }

  const entries = Object.entries(config as Record<string, unknown>);
  const spec = meta.configSpec ?? [];

  if (spec.length === 0) {
    if (entries.length > 0) {
      return { ok: false, error: `Widget "${type}" takes no config.` };
    }
    return { ok: true, config: undefined };
  }

  const allowed = new Map(spec.map((s) => [s.key, s]));
  for (const [key, value] of entries) {
    const s = allowed.get(key);
    if (!s) {
      return {
        ok: false,
        error: `Unknown config key "${key}" for "${type}". Allowed: ${spec
          .map((x) => x.key)
          .join(', ')}.`,
      };
    }
    if (!matchesType(value, s.types)) {
      return { ok: false, error: `config.${key} for "${type}" must be ${s.types.join(' or ')}.` };
    }
  }
  for (const s of spec) {
    if (s.required && !(s.key in (config as Record<string, unknown>))) {
      return { ok: false, error: `config.${s.key} is required for "${type}".` };
    }
  }

  return { ok: true, config: entries.length ? (config as Record<string, unknown>) : undefined };
}

function matchesType(value: unknown, types: WidgetConfigSpec['types']): boolean {
  return types.some((t) => {
    if (t === 'string') return typeof value === 'string';
    if (t === 'number') return typeof value === 'number';
    if (t === 'string[]') return Array.isArray(value) && value.every((v) => typeof v === 'string');
    return false;
  });
}
