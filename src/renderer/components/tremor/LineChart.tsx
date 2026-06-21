import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cx } from '../../lib/utils';
import { ChartTooltip } from './ChartTooltip';
import { axisTick, colorAt, gridStroke } from './chartUtils';

type Row = Record<string, string | number | null>;

interface LineChartProps {
  data: Row[];
  index: string;
  /** recharts dataKeys — must be unique and match the keys in `data` rows. */
  categories: string[];
  colors?: string[];
  /** Display names per category for the legend/tooltip; defaults to the category. */
  names?: string[];
  /** Per-category `strokeDasharray` (e.g. "4 3"); undefined draws a solid line. */
  dashes?: (string | undefined)[];
  valueFormatter?: (value: number) => string;
  className?: string;
  showLegend?: boolean;
}

/**
 * A multi-series LINE chart (no area fill) for overlaying values that share a
 * y-axis — raw prices, with moving-average lines drawn on top. Unlike AreaChart
 * the y-domain auto-fits the data (prices rarely start at zero). The fill is
 * omitted on purpose: stacked gradient fills turn three overlapping price lines
 * into mush. `connectNulls` bridges interior gaps (ragged coverage between
 * series), while a moving average's *leading* warm-up `null`s are never bridged
 * backwards — so the MA line simply begins once it has enough history.
 */
export function LineChart({
  data,
  index,
  categories,
  colors,
  names,
  dashes,
  valueFormatter,
  className,
  showLegend,
}: LineChartProps) {
  return (
    <div className={cx('h-full w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <RLineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
          <XAxis dataKey={index} tick={axisTick} axisLine={{ stroke: gridStroke }} tickLine={false} />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            width={52}
            domain={['auto', 'auto']}
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
              <Line
                key={cat}
                type="monotone"
                dataKey={cat}
                name={names?.[i] ?? cat}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={dashes?.[i]}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            );
          })}
        </RLineChart>
      </ResponsiveContainer>
    </div>
  );
}
