import type { ComponentType } from 'react';
import type { WidgetMeta } from '../../shared/widgets';

// Re-export the shared, React-free metadata types so existing renderer imports
// (`from '../widgets/types'`) keep working.
export type { WidgetCategory, WidgetConfigField, WidgetSize } from '../../shared/widgets';

/** Props every widget component receives (most ignore them in v1). */
export interface WidgetProps {
  instanceId: string;
  config?: Record<string, unknown>;
}

/**
 * The marketplace entry for a widget: the shared metadata (from
 * `src/shared/widgets.ts`) plus the React bits the renderer attaches in
 * `registry.ts`. The marketplace UI and the dashboard engine both read it.
 */
export interface WidgetDefinition extends WidgetMeta {
  icon: ComponentType<{ className?: string }>;
  component: ComponentType<WidgetProps>;
}
