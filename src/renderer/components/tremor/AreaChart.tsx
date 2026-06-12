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

/**
 * Build a valid SVG gradient id from a category name. Category labels can contain
 * spaces, slashes, parens, etc. (e.g. "EUR/USD ($10k)"); those are invalid in an
 * SVG id / url(#…) reference and silently break the gradient fill, so map any
 * non-id character to '_'.
 */
function gradId(category: string): string {
  return `grad-${category.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

interface AreaChartProps {
  data: Row[];
  index: string;
  categories: string[];
  colors?: string[];
  valueFormatter?: (value: number) => string;
  className?: string;
  showLegend?: boolean;
}

export function AreaChart({
  data,
  index,
  categories,
  colors,
  valueFormatter,
  className,
  showLegend,
}: AreaChartProps) {
  return (
    <div className={cx('h-full w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <RAreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            {categories.map((cat, i) => {
              const color = colors?.[i] ?? colorAt(i);
              return (
                <linearGradient key={cat} id={gradId(cat)} x1="0" y1="0" x2="0" y2="1">
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
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradId(cat)})`}
              />
            );
          })}
        </RAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
