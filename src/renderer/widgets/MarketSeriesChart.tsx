import { useMemo, useState } from 'react';
import { useMarketAvailable, useMarketPointsMulti, useMarketSeries } from '../api/hooks';
import { parseAmount } from '../lib/money';
import { AreaChart } from '../components/tremor/AreaChart';
import { colorAt } from '../components/tremor/chartUtils';
import { WidgetState } from '../components/ui';
import type { MarketPoint, MarketSeries } from '../../shared/kasas-types';
import type { WidgetProps } from './types';
import { DEFAULT_RANGE_DAYS, growthOf, MarketUnavailable, pctChange, RangeSelect, sinceForDays } from './market-util';

/**
 * A comparison chart of one or more market series' daily closes, fetched on demand
 * through kasas's read-through cache (ADR 0006). Series are toggled with the
 * checkboxes in the header. With two or more selected, each line is normalized to
 * "growth of $10,000" indexed to the start of the window so series at different
 * price levels (and even different currencies) are comparable over the same
 * timeframe; a single series shows its raw price, as before. Values are a
 * benchmark series, not the user's account — labeled honestly as price vs total
 * return.
 */

/** Normalize the persisted `config.series` (string or string[]) to an id list. */
function configuredIds(config: WidgetProps['config']): string[] {
  const c = config?.series;
  if (Array.isArray(c)) return c.filter((x): x is string => typeof x === 'string');
  if (typeof c === 'string' && c) return [c];
  return [];
}

export function MarketSeriesChartWidget({ config }: WidgetProps) {
  const cap = useMarketAvailable();
  const list = useMarketSeries();

  if (!cap.available && !cap.loading) return <MarketUnavailable />;
  if (list.loading && !list.data) return <WidgetState loading />;
  if (list.error) return <WidgetState error={list.error} />;

  const series = list.data?.series ?? [];
  if (series.length === 0)
    return <WidgetState empty emptyLabel="No market series configured (add one in Settings)" />;

  return <Comparison series={series} initial={configuredIds(config)} />;
}

function Comparison({ series, initial }: { series: MarketSeries[]; initial: string[] }) {
  const byId = useMemo(() => Object.fromEntries(series.map((s) => [s.id, s])), [series]);
  // A stable color per series by its position in the full list, so a line keeps
  // its color (and matches its checkbox swatch) regardless of what else is on.
  const colorOf = useMemo(() => {
    const m: Record<string, string> = {};
    series.forEach((s, i) => (m[s.id] = colorAt(i)));
    return m;
  }, [series]);

  const ids = useMemo(() => series.map((s) => s.id), [series]);
  const validInitial = initial.filter((id) => ids.includes(id));
  const [selected, setSelected] = useState<string[]>(
    validInitial.length ? validInitial : ids.slice(0, 1),
  );
  const [days, setDays] = useState(DEFAULT_RANGE_DAYS);

  // Chart only series that still exist, in the order they appear in the list.
  const shown = series.filter((s) => selected.includes(s.id)).map((s) => s.id);
  const points = useMarketPointsMulti(shown, sinceForDays(days), true);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const data = points.data ?? {};

  // Parsed, non-empty lines for the currently shown series.
  const lines = shown
    .map((id) => {
      const pts: MarketPoint[] = data[id]?.points ?? [];
      const values = pts.map((p) => parseAmount(p.value));
      if (!values.some((v) => v > 0)) return null;
      return { id, meta: byId[id], pts, values };
    })
    .filter((l): l is { id: string; meta: MarketSeries; pts: MarketPoint[]; values: number[] } => l != null);

  // Two or more series selected → index each to "growth of $10k" for a fair
  // comparison; a single series keeps its raw price. Keyed off the selection (not
  // the data-bearing count) so the axis doesn't flip if one series lacks data.
  const indexed = shown.length >= 2;
  const labelOf = (m: MarketSeries) => (indexed ? `${m.symbol} ($10k)` : m.symbol);

  const series_ = lines.map((ln) => {
    const arr = indexed ? growthOf(ln.values, 10_000) : ln.values;
    const map = new Map<string, number>();
    ln.pts.forEach((p, i) => map.set(p.date, indexed ? Math.round(arr[i]) : arr[i]));
    return { id: ln.id, label: labelOf(ln.meta), color: colorOf[ln.id], map };
  });

  // Per-series % change, keyed by id, for the checkbox labels.
  const pctById: Record<string, string> = {};
  for (const ln of lines) pctById[ln.id] = pctChange(ln.values);

  const dateSet = new Set<string>();
  for (const ln of lines) for (const p of ln.pts) dateSet.add(p.date);
  const dates = [...dateSet].sort();
  // Key columns by the unique series id (not the display label, which can repeat
  // when two series share a symbol) so each line stays distinct; the label is
  // passed to the chart separately as the display name.
  const rows = dates.map((date) => {
    const row: Record<string, string | number> = { date };
    for (const s of series_) {
      const v = s.map.get(date);
      if (v !== undefined) row[s.id] = v;
    }
    return row;
  });

  const valueFormatter = indexed
    ? (v: number) => `$${v.toLocaleString()}`
    : (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });

  const single = !indexed && lines.length === 1 ? lines[0].meta : null;
  const asOf = data[shown[0]]?.as_of;
  const footer = indexed
    ? 'Each series grown from $10,000, indexed to the start of the window — a relative comparison, not dollars invested.'
    : single
      ? `${single.adjusted ? 'total return' : 'price'} · ${single.currency}${asOf ? ` · as of ${asOf}` : ''}`
      : '';

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        {series.map((s) => {
          const on = selected.includes(s.id);
          return (
            <label
              key={s.id}
              className="flex cursor-pointer select-none items-center gap-1 text-xs text-slate-300"
              title={s.name || s.symbol}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(s.id)}
                className="h-3 w-3 accent-blue-500"
              />
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ backgroundColor: colorOf[s.id], opacity: on ? 1 : 0.35 }}
              />
              <span className={on ? '' : 'text-slate-500'}>{s.symbol}</span>
              {on && pctById[s.id] && <span className="text-slate-500">{pctById[s.id]}</span>}
            </label>
          );
        })}
        <RangeSelect value={days} onChange={setDays} />
      </div>
      <div className="min-h-0 flex-1">
        {shown.length === 0 ? (
          <WidgetState empty emptyLabel="Pick a series to chart" />
        ) : points.loading && !points.data ? (
          <WidgetState loading />
        ) : points.error ? (
          <WidgetState error={points.error} />
        ) : rows.length === 0 ? (
          <WidgetState empty emptyLabel="No data yet" />
        ) : (
          <AreaChart
            data={rows}
            index="date"
            categories={series_.map((s) => s.id)}
            names={series_.map((s) => s.label)}
            colors={series_.map((s) => s.color)}
            valueFormatter={valueFormatter}
          />
        )}
      </div>
      <div className="mt-1 text-[11px] leading-tight text-slate-500">{footer}</div>
    </div>
  );
}
