import { RiCloseLine } from '@remixicon/react';
import { Card } from '../components/tremor/Card';
import { ErrorBoundary } from './ErrorBoundary';
import { widgetMap } from '../widgets/registry';
import { useDashboards, type WidgetInstance } from '../store/dashboards';
import { cx } from '../lib/utils';

export function WidgetHost({ instance }: { instance: WidgetInstance }) {
  const def = widgetMap[instance.type];
  const editing = useDashboards((s) => s.editing);
  const removeWidget = useDashboards((s) => s.removeWidget);

  if (!def) {
    return (
      <Card className="flex h-full items-center justify-center text-sm text-slate-500">
        Unknown widget: {instance.type}
      </Card>
    );
  }

  const Icon = def.icon;
  const Body = def.component;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <header
        className={cx(
          'widget-drag-handle flex items-center gap-2 border-b border-line px-3 py-2',
          editing && 'cursor-grab active:cursor-grabbing',
        )}
      >
        <Icon className="size-4 shrink-0 text-slate-500" />
        <span className="truncate text-sm font-medium text-slate-200">{def.title}</span>
        {editing && (
          <button
            onClick={() => removeWidget(instance.id)}
            className="widget-no-drag ml-auto inline-flex size-6 items-center justify-center rounded text-slate-500 transition-colors hover:bg-white/5 hover:text-rose-300"
            title="Remove widget"
          >
            <RiCloseLine className="size-4" />
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 p-3">
        <ErrorBoundary>
          <Body instanceId={instance.id} config={instance.config} />
        </ErrorBoundary>
      </div>
    </Card>
  );
}
