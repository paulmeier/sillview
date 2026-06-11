import {
  Bar,
  BarChart as RBarChart,
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

interface BarChartProps {
  data: Row[];
  /** Key used for the category axis. */
  index: string;
  /** One or more value keys to plot as series. */
  categories: string[];
  colors?: string[];
  valueFormatter?: (value: number) => string;
  className?: string;
  stack?: boolean;
  showLegend?: boolean;
  /** 'horizontal' = vertical bars (default). 'vertical' = horizontal bars. */
  layout?: 'horizontal' | 'vertical';
}

export function BarChart({
  data,
  index,
  categories,
  colors,
  valueFormatter,
  className,
  stack,
  showLegend,
  layout = 'horizontal',
}: BarChartProps) {
  const isVertical = layout === 'vertical';
  const fmt = (v: number | string) =>
    valueFormatter ? valueFormatter(Number(v)) : String(v);

  return (
    <div className={cx('h-full w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <RBarChart
          data={data}
          layout={layout}
          margin={{ top: 8, right: 8, bottom: 0, left: isVertical ? 8 : 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={isVertical} horizontal={!isVertical} />
          {isVertical ? (
            <>
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={fmt} />
              <YAxis
                type="category"
                dataKey={index}
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                width={96}
              />
            </>
          ) : (
            <>
              <XAxis dataKey={index} tick={axisTick} axisLine={{ stroke: gridStroke }} tickLine={false} interval={0} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={52} tickFormatter={fmt} />
            </>
          )}
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.08)' }}
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
          {categories.map((cat, i) => (
            <Bar
              key={cat}
              dataKey={cat}
              stackId={stack ? 'a' : undefined}
              fill={colors?.[i] ?? colorAt(i)}
              radius={isVertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              maxBarSize={isVertical ? 22 : 48}
            />
          ))}
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}
