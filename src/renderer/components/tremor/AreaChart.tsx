import { useId } from 'react';
import {
  Area,
  AreaChart as RAreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cx } from '../../lib/utils';
import { ChartTooltip } from './ChartTooltip';
import { axisTick, colorAt, gridStroke } from './chartUtils';

type Row = Record<string, string | number>;

interface AreaChartProps {
  data: Row[];
  index: string;
  /** recharts dataKeys — must be unique and match the keys in `data` rows. */
  categories: string[];
  colors?: string[];
  /** Display names per category for the legend/tooltip; defaults to the category. */
  names?: string[];
  valueFormatter?: (value: number) => string;
  className?: string;
  showLegend?: boolean;
}

export function AreaChart({
  data,
  index,
  categories,
  colors,
  names,
  valueFormatter,
  className,
  showLegend,
}: AreaChartProps) {
  // A unique gradient-id prefix per chart instance. SVG ids are document-global,
  // so deriving them from the (possibly repeated or punctuated) category label let
  // one series' fill resolve to another series' — or another chart's — gradient.
  const uid = useId().replace(/:/g, '');
  const gradId = (i: number) => `${uid}-grad-${i}`;
  return (
    <div className={cx('h-full w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <RAreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            {categories.map((cat, i) => {
              const color = colors?.[i] ?? colorAt(i);
              return (
                <linearGradient key={cat} id={gradId(i)} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
          <XAxis dataKey={index} tick={axisTick} axisLine={{ stroke: gridStroke }} tickLine={false} />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            width={52}
            tickFormatter={(v) => (valueFormatter ? valueFormatter(Number(v)) : String(v))}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content={(props: any) => (
              <ChartTooltip
                active={props.active}
                payload={props.payload}
                label={props.label}
                valueFormatter={valueFormatter}
              />
            )}
          />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />}
          {categories.map((cat, i) => {
            const color = colors?.[i] ?? colorAt(i);
            return (
              <Area
                key={cat}
                type="monotone"
                dataKey={cat}
                name={names?.[i] ?? cat}
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradId(i)})`}
              />
            );
          })}
        </RAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
