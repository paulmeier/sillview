import type { ComponentType } from 'react';
import type { WidgetSize } from '../store/dashboards';

/** Props every widget component receives (most ignore them in v1). */
export interface WidgetProps {
  instanceId: string;
  config?: Record<string, unknown>;
}

export type WidgetCategory = 'Overview' | 'Accounts' | 'Spending' | 'Activity';

/**
 * The marketplace entry for a widget. `registry.ts` is the single source both the
 * marketplace UI and the dashboard engine read — adding a widget is one entry.
 */
export interface WidgetDefinition {
  type: string;
  title: string;
  description: string;
  category: WidgetCategory;
  icon: ComponentType<{ className?: string }>;
  defaultSize: WidgetSize;
  component: ComponentType<WidgetProps>;
}
