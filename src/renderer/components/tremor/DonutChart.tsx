import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { cx } from '../../lib/utils';
import { ChartTooltip } from './ChartTooltip';
import { colorAt } from './chartUtils';

export interface DonutDatum {
  name: string;
  value: number;
}

interface DonutChartProps {
  data: DonutDatum[];
  colors?: string[];
  valueFormatter?: (value: number) => string;
  className?: string;
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({
  data,
  colors,
  valueFormatter,
  className,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  return (
    <div className={cx('relative h-full w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={colors?.[i] ?? colorAt(i)} />
            ))}
          </Pie>
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content={(props: any) => (
              <ChartTooltip
                active={props.active}
                payload={props.payload}
                valueFormatter={valueFormatter}
              />
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      {(centerValue || centerLabel) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && (
            <span className="text-lg font-semibold text-slate-100">{centerValue}</span>
          )}
          {centerLabel && (
            <span className="text-xs text-slate-400">{centerLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
