/**
 * The widget marketplace catalog. This is the single source of truth that both
 * the marketplace UI and the dashboard engine read — adding a widget is one entry
 * here plus its component file.
 */

import {
  RiBankLine,
  RiBarChart2Line,
  RiExchangeFundsLine,
  RiListCheck,
  RiPieChart2Line,
  RiPulseLine,
  RiRefreshLine,
  RiWallet3Line,
} from '@remixicon/react';
import type { WidgetDefinition } from './types';
import { NetWorthWidget } from './NetWorth';
import { AccountsListWidget } from './AccountsList';
import { AccountBalancesWidget } from './AccountBalances';
import { TransactionsWidget } from './Transactions';
import { SpendByLabelWidget } from './SpendByLabel';
import { CashflowWidget } from './Cashflow';
import { ActivityFeedWidget } from './ActivityFeed';
import { SyncStatusWidget } from './SyncStatus';

export const WIDGETS: WidgetDefinition[] = [
  {
    type: 'net-worth',
    title: 'Net Worth',
    description: 'Total balance across all accounts, grouped by currency.',
    category: 'Overview',
    icon: RiWallet3Line,
    defaultSize: { w: 4, h: 3, minW: 3, minH: 2 },
    component: NetWorthWidget,
  },
  {
    type: 'sync-status',
    title: 'Sync Status',
    description: 'Backend connectivity and the most recent sync run.',
    category: 'Overview',
    icon: RiRefreshLine,
    defaultSize: { w: 4, h: 3, minW: 3, minH: 2 },
    component: SyncStatusWidget,
  },
  {
    type: 'accounts-list',
    title: 'Accounts',
    description: 'Every account with its current balance.',
    category: 'Accounts',
    icon: RiBankLine,
    defaultSize: { w: 4, h: 6, minW: 3, minH: 3 },
    component: AccountsListWidget,
  },
  {
    type: 'account-balances',
    title: 'Account Balances',
    description: 'Bar chart comparing balances across accounts.',
    category: 'Accounts',
    icon: RiBarChart2Line,
    defaultSize: { w: 4, h: 6, minW: 3, minH: 4 },
    component: AccountBalancesWidget,
  },
  {
    type: 'transactions',
    title: 'Transactions',
    description: 'The most recent transactions across all accounts.',
    category: 'Activity',
    icon: RiListCheck,
    defaultSize: { w: 6, h: 7, minW: 4, minH: 4 },
    component: TransactionsWidget,
    configFields: [
      { key: 'limit', label: 'Rows shown', type: 'number', default: 40, help: 'How many recent transactions to list.' },
    ],
  },
  {
    type: 'spend-by-label',
    title: 'Spending Breakdown',
    description: 'Outflow grouped by your most-used label (or payee).',
    category: 'Spending',
    icon: RiPieChart2Line,
    defaultSize: { w: 4, h: 6, minW: 3, minH: 4 },
    component: SpendByLabelWidget,
  },
  {
    type: 'cashflow',
    title: 'Cash Flow',
    description: 'Money in vs. out per month over the last six months.',
    category: 'Spending',
    icon: RiExchangeFundsLine,
    defaultSize: { w: 8, h: 5, minW: 4, minH: 4 },
    component: CashflowWidget,
  },
  {
    type: 'activity-feed',
    title: 'Live Activity',
    description: 'A live feed of change events streamed from kasas.',
    category: 'Activity',
    icon: RiPulseLine,
    defaultSize: { w: 4, h: 6, minW: 3, minH: 3 },
    component: ActivityFeedWidget,
  },
];

export const widgetMap: Record<string, WidgetDefinition> = Object.fromEntries(
  WIDGETS.map((w) => [w.type, w]),
);
