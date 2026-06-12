/**
 * The single source of truth for the app's navigation. Both the Sidebar and the
 * router read this list, so a new page is one entry here plus its component.
 *
 * Static built-in pages live here; plugin-contributed pages are discovered at
 * runtime (Phase 7) and merged into the sidebar separately.
 */

import type { ComponentType, ReactNode } from 'react';
import {
  RiArrowLeftRightLine,
  RiBankLine,
  RiGitBranchLine,
  RiLayoutGridLine,
  RiLinksLine,
  RiPriceTag3Line,
  RiPulseLine,
  RiPuzzle2Line,
  RiSearchLine,
  RiSendPlaneLine,
  RiStore2Line,
} from '@remixicon/react';
import { Dashboards } from '../pages/Dashboards';
import { Sources } from '../pages/Sources';
import { Transactions } from '../pages/Transactions';
import { Accounts } from '../pages/Accounts';
import { Search } from '../pages/Search';
import { Labels } from '../pages/Labels';
import { Events } from '../pages/Events';
import { Rules } from '../pages/Rules';
import { Webhooks } from '../pages/Webhooks';
import { Plugins } from '../pages/Plugins';
import { PluginMarketplace } from '../pages/PluginMarketplace';

export type NavGroup = 'Overview' | 'Ledger' | 'Configure' | 'Plugins';

export interface NavRoute {
  /** react-router path. The Dashboards route is the index ('/'). */
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  group: NavGroup;
  element: ReactNode;
}

export const GROUP_ORDER: NavGroup[] = ['Overview', 'Ledger', 'Configure', 'Plugins'];

export const ROUTES: NavRoute[] = [
  { path: '/', label: 'Dashboards', icon: RiLayoutGridLine, group: 'Overview', element: <Dashboards /> },

  { path: '/transactions', label: 'Transactions', icon: RiArrowLeftRightLine, group: 'Ledger', element: <Transactions /> },
  { path: '/accounts', label: 'Accounts', icon: RiBankLine, group: 'Ledger', element: <Accounts /> },
  { path: '/search', label: 'Search', icon: RiSearchLine, group: 'Ledger', element: <Search /> },
  { path: '/labels', label: 'Labels', icon: RiPriceTag3Line, group: 'Ledger', element: <Labels /> },
  { path: '/events', label: 'Events', icon: RiPulseLine, group: 'Ledger', element: <Events /> },

  { path: '/sources', label: 'Sources', icon: RiLinksLine, group: 'Configure', element: <Sources /> },
  { path: '/rules', label: 'Rules', icon: RiGitBranchLine, group: 'Configure', element: <Rules /> },
  { path: '/webhooks', label: 'Webhooks', icon: RiSendPlaneLine, group: 'Configure', element: <Webhooks /> },

  { path: '/plugins', label: 'Plugins', icon: RiPuzzle2Line, group: 'Plugins', element: <Plugins /> },
  { path: '/marketplace', label: 'Plugin Marketplace', icon: RiStore2Line, group: 'Plugins', element: <PluginMarketplace /> },
];
