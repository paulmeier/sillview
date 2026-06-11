import { cx } from '../../lib/utils';

interface TooltipEntry {
  name?: string;
  value?: number;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: unknown;
  payload?: TooltipEntry[];
  valueFormatter?: (value: number) => string;
}

/**
 * Dark-themed tooltip shared by the chart components. Recharts injects
 * `active`/`payload`/`label` at runtime via its `content` render prop.
 */
export function ChartTooltip({ active, label, payload, valueFormatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className={cx(
        'rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-xl',
      )}
    >
      {label != null && label !== '' && (
        <div className="mb-1 font-medium text-slate-200">{String(label)}</div>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: entry.color }}
            />
            {entry.name && <span className="text-slate-400">{entry.name}</span>}
            <span className="ml-auto font-medium text-slate-100">
              {typeof entry.value === 'number' && valueFormatter
                ? valueFormatter(entry.value)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
