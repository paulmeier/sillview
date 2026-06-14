/**
 * Maps the registry's curated icon NAMES (e.g. "wallet") to Remixicon components.
 * The marketplace shows widgets from the registry, where the icon is a name string
 * (the registry owns no SVG — see `sillview-widgets`), so the renderer resolves the
 * name to a component here. Unknown names fall back to the puzzle icon.
 */

import type { ComponentType } from 'react';
import {
  RiBankLine,
  RiBarChart2Line,
  RiCoinLine,
  RiDashboard3Line,
  RiExchangeFundsLine,
  RiLineChartLine,
  RiListCheck,
  RiPieChart2Line,
  RiPulseLine,
  RiPuzzle2Line,
  RiRefreshLine,
  RiScales3Line,
  RiStarLine,
  RiWallet3Line,
} from '@remixicon/react';

type IconComponent = ComponentType<{ className?: string }>;

const ICONS: Record<string, IconComponent> = {
  wallet: RiWallet3Line,
  bank: RiBankLine,
  'bar-chart': RiBarChart2Line,
  'line-chart': RiLineChartLine,
  'pie-chart': RiPieChart2Line,
  list: RiListCheck,
  activity: RiPulseLine,
  refresh: RiRefreshLine,
  scales: RiScales3Line,
  exchange: RiExchangeFundsLine,
  gauge: RiDashboard3Line,
  coin: RiCoinLine,
  star: RiStarLine,
  puzzle: RiPuzzle2Line,
};

/** Resolve a curated icon name to a component (puzzle fallback for unknown names). */
export function iconForName(name: string | undefined): IconComponent {
  return (name && ICONS[name]) || RiPuzzle2Line;
}
