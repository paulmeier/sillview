/**
 * The offline widget registry fixture used under KASAS_MOCK (and in tests).
 *
 * It is DERIVED from the compiled `WIDGET_META`, so the offline catalog always
 * matches exactly the widgets the app can render — there is no second list to keep
 * in sync. Only the marketplace-presentation extras (a curated icon name and search
 * tags) live here, keyed by widget type. This mirrors the real published catalog
 * (the `sillview-widgets` repo) closely enough for full offline development of the
 * install/add flow.
 */

import { WIDGET_META } from '../../shared/widgets';
import {
  WIDGET_REGISTRY_SCHEMA_VERSION,
  type RegistryIndex,
  type RegistryWidget,
} from '../../shared/widget-registry';

const REPO = 'https://github.com/paulmeier/sillview-widgets';

/** Curated icon name per widget type (matches the seeded `sillview-widgets` manifests). */
export const ICON_BY_TYPE: Record<string, string> = {
  'net-worth': 'wallet',
  'sync-status': 'refresh',
  'accounts-list': 'bank',
  'account-balances': 'bar-chart',
  transactions: 'list',
  'spend-by-label': 'pie-chart',
  cashflow: 'exchange',
  'activity-feed': 'activity',
  'benchmark-comparison': 'scales',
  'market-series': 'line-chart',
  'market-overlay': 'line-chart',
};

/** Search tags per widget type. */
export const TAGS_BY_TYPE: Record<string, string[]> = {
  'net-worth': ['balance', 'currency', 'overview'],
  'sync-status': ['sync', 'status', 'health'],
  'accounts-list': ['accounts', 'balance'],
  'account-balances': ['accounts', 'balance', 'chart'],
  transactions: ['transactions', 'activity', 'ledger'],
  'spend-by-label': ['spending', 'labels', 'chart'],
  cashflow: ['cashflow', 'income', 'expenses', 'chart'],
  'activity-feed': ['activity', 'live', 'events'],
  'benchmark-comparison': ['market', 'benchmark', 'comparison', 'chart'],
  'market-series': ['market', 'series', 'chart'],
  'market-overlay': ['market', 'price', 'sma', 'ema', 'gold', 'silver', 'chart'],
};

/** Build the offline registry index from the compiled widget catalog. */
export function mockRegistryIndex(): RegistryIndex {
  const widgets: RegistryWidget[] = WIDGET_META.map((m) => ({
    name: m.type,
    version: '1.0.0',
    description: m.description,
    author: 'sillview',
    license: 'MIT',
    homepage: `${REPO}/tree/main/widgets/${m.type}`,
    kind: 'builtin' as const,
    widget_type: m.type,
    category: m.category,
    icon: ICON_BY_TYPE[m.type] ?? 'puzzle',
    tags: TAGS_BY_TYPE[m.type] ?? [],
    tier: 'verified',
    default_size: m.defaultSize,
    config: m.configSpec ?? [],
    path: `widgets/${m.type}`,
    files: [],
    content_hash: 'sha256:mock',
    size_bytes: 0,
  })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  return {
    schema_version: WIDGET_REGISTRY_SCHEMA_VERSION,
    generated_at: '1970-01-01T00:00:00.000Z',
    repository: REPO,
    widgets,
  };
}
