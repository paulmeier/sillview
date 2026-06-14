import { useMemo, useState } from 'react';
import { RiCloseLine, RiEqualizerLine } from '@remixicon/react';
import { Card } from '../components/tremor/Card';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui';
import { ErrorBoundary } from './ErrorBoundary';
import { widgetMap } from '../widgets/registry';
import { useDashboards, type WidgetInstance } from '../store/dashboards';
import type { WidgetDefinition } from '../widgets/types';
import { validateWidgetConfig } from '../../shared/widgets';
import {
  deriveConfigInputs,
  initConfigDraft,
  parseConfigDraft,
} from '../../shared/widget-config-form';
import { cx } from '../lib/utils';

const inputClass =
  'w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-slate-100 focus:border-blue-500/60 focus:outline-none';

function ConfigDialog({
  def,
  instance,
  open,
  onClose,
}: {
  def: WidgetDefinition;
  instance: WidgetInstance;
  open: boolean;
  onClose: () => void;
}) {
  const update = useDashboards((s) => s.updateWidgetConfig);
  // Prefer hand-authored configFields; fall back to deriving inputs from the
  // authoritative configSpec so any config-bearing widget is editable here.
  const inputs = useMemo(() => deriveConfigInputs(def), [def]);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    initConfigDraft(inputs, instance.config),
  );
  const [error, setError] = useState<string | null>(null);

  const setField = (key: string, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    const next = parseConfigDraft(inputs, draft);
    const merged = { ...instance.config, ...next };
    const result = validateWidgetConfig(def.type, merged);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    update(instance.id, next);
    onClose();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Configure ${def.title}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {inputs.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">
              {f.label}
              {f.required && <span className="text-rose-400"> *</span>}
            </span>
            {f.kind === 'select' ? (
              <select
                value={draft[f.key] ?? ''}
                onChange={(e) => setField(f.key, e.target.value)}
                className={inputClass}
              >
                {(f.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={f.kind === 'number' ? 'number' : 'text'}
                value={draft[f.key] ?? ''}
                onChange={(e) => setField(f.key, e.target.value)}
                placeholder={f.kind === 'list' ? 'comma-separated' : undefined}
                className={inputClass}
              />
            )}
            {f.help && <span className="mt-1 block text-xs text-slate-500">{f.help}</span>}
          </label>
        ))}
        {error && (
          <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function WidgetHost({ instance }: { instance: WidgetInstance }) {
  const def = widgetMap[instance.type];
  const editing = useDashboards((s) => s.editing);
  const removeWidget = useDashboards((s) => s.removeWidget);
  const [configOpen, setConfigOpen] = useState(false);

  if (!def) {
    return (
      <Card className="flex h-full items-center justify-center text-sm text-slate-500">
        Unknown widget: {instance.type}
      </Card>
    );
  }

  const Icon = def.icon;
  const Body = def.component;
  const configurable =
    (def.configFields?.length ?? 0) > 0 || (def.configSpec?.length ?? 0) > 0;

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
          <div className="widget-no-drag ml-auto flex items-center gap-0.5">
            {configurable && (
              <button
                onClick={() => setConfigOpen(true)}
                className="inline-flex size-6 items-center justify-center rounded text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200"
                title="Configure widget"
              >
                <RiEqualizerLine className="size-4" />
              </button>
            )}
            <button
              onClick={() => removeWidget(instance.id)}
              className="inline-flex size-6 items-center justify-center rounded text-slate-500 transition-colors hover:bg-white/5 hover:text-rose-300"
              title="Remove widget"
            >
              <RiCloseLine className="size-4" />
            </button>
          </div>
        )}
      </header>
      <div className="min-h-0 flex-1 p-3">
        <ErrorBoundary>
          <Body instanceId={instance.id} config={instance.config} />
        </ErrorBoundary>
      </div>

      {configOpen && (
        <ConfigDialog def={def} instance={instance} open={configOpen} onClose={() => setConfigOpen(false)} />
      )}
    </Card>
  );
}
