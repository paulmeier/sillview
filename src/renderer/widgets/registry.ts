/**
 * The widget marketplace catalog. The pure metadata (which widgets exist, sizes,
 * config contracts) lives in the React-free `src/shared/widgets.ts` so the
 * standalone MCP server can read it too; here we attach the renderer-only bits —
 * an icon and a React component — to each entry. Adding a widget is one entry in
 * the shared metadata plus an icon + component below.
 */

import type { ComponentType } from 'react';
import {
  RiBankLine,
  RiBarChart2Line,
  RiExchangeFundsLine,
  RiLineChartLine,
  RiListCheck,
  RiPieChart2Line,
  RiPulseLine,
  RiRefreshLine,
  RiScales3Line,
  RiWallet3Line,
} from '@remixicon/react';
import { WIDGET_META } from '../../shared/widgets';
import type { WidgetDefinition, WidgetProps } from './types';
import { NetWorthWidget } from './NetWorth';
import { AccountsListWidget } from './AccountsList';
import { AccountBalancesWidget } from './AccountBalances';
import { TransactionsWidget } from './Transactions';
import { SpendByLabelWidget } from './SpendByLabel';
import { CashflowWidget } from './Cashflow';
import { ActivityFeedWidget } from './ActivityFeed';
import { SyncStatusWidget } from './SyncStatus';
import { BenchmarkComparisonWidget } from './BenchmarkComparison';
import { MarketSeriesChartWidget } from './MarketSeriesChart';

/** Icon per widget type, keyed to the shared metadata. */
const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  'net-worth': RiWallet3Line,
  'sync-status': RiRefreshLine,
  'accounts-list': RiBankLine,
  'account-balances': RiBarChart2Line,
  transactions: RiListCheck,
  'spend-by-label': RiPieChart2Line,
  cashflow: RiExchangeFundsLine,
  'activity-feed': RiPulseLine,
  'benchmark-comparison': RiScales3Line,
  'market-series': RiLineChartLine,
};

/** React component per widget type, keyed to the shared metadata. */
const COMPONENTS: Record<string, ComponentType<WidgetProps>> = {
  'net-worth': NetWorthWidget,
  'sync-status': SyncStatusWidget,
  'accounts-list': AccountsListWidget,
  'account-balances': AccountBalancesWidget,
  transactions: TransactionsWidget,
  'spend-by-label': SpendByLabelWidget,
  cashflow: CashflowWidget,
  'activity-feed': ActivityFeedWidget,
  'benchmark-comparison': BenchmarkComparisonWidget,
  'market-series': MarketSeriesChartWidget,
};

// Metadata lives in src/shared/widgets.ts (so the MCP server can read it without
// React), while icons + components are attached here. The two can drift: a widget
// added to WIDGET_META but missing from ICONS/COMPONENTS would build an entry with
// `undefined` icon/component (Record index access isn't undefined-checked) that
// crashes when rendered. Drop and report any such entry so the rest still works.
const built = WIDGET_META.map((meta) => ({
  ...meta,
  icon: ICONS[meta.type],
  component: COMPONENTS[meta.type],
}));

const incomplete = built.filter((w) => !w.icon || !w.component);
if (incomplete.length) {
  console.error(
    '[widgets] missing icon/component in registry.ts for:',
    incomplete.map((w) => w.type).join(', '),
  );
}

export const WIDGETS: WidgetDefinition[] = built.filter((w) => w.icon && w.component);

export const widgetMap: Record<string, WidgetDefinition> = Object.fromEntries(
  WIDGETS.map((w) => [w.type, w]),
);
