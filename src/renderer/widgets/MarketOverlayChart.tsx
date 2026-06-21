import { useMemo, useState } from 'react';
import { useMarketAvailable, useMarketPointsMulti, useMarketSeries } from '../api/hooks';
import { parseAmount } from '../lib/money';
import { LineChart } from '../components/tremor/LineChart';
import { colorAt } from '../components/tremor/chartUtils';
import { WidgetState } from '../components/ui';
import { ema, sma } from '../../shared/indicators';
import type { MarketPoint, MarketSeries } from '../../shared/kasas-types';
import type { WidgetProps } from './types';
import {
  DEFAULT_RANGE_DAYS,
  MarketUnavailable,
  pctChange,
  priceFormatter,
  RangeSelect,
  sinceForDays,
} from './market-util';

/**
 * A raw-PRICE overlay of one or more market series, drawn on a shared y-axis
 * (unlike the "growth of $10k" comparison in MarketSeriesChart). Each line keeps
 * the series' real spot price and its configured display name, so a Gold/Silver/
 * Platinum chart reads as actual prices with correct labels.
 *
 * With `config.sma` / `config.ema` set it also overlays moving-average lines on
 * the FIRST series — computed in-app (kasas has no indicator series kind), drawn
 * dashed on top of the price. That covers "S&P 500 with SMA and EMA": one price
 * line plus its two averages, all on the same axis.
 */

// MA overlay colors — distinct from the first price-palette entries (blue/emerald).
const SMA_COLOR = '#f59e0b'; // amber
const EMA_COLOR = '#ec4899'; // pink

/** Normalize the persisted `config.series` (string or string[]) to an id list. */
function configuredIds(config: WidgetProps['config']): string[] {
  const c = config?.series;
  if (Array.isArray(c)) return c.filter((x): x is string => typeof x === 'string');
  if (typeof c === 'string' && c) return [c];
  return [];
}

/** A positive integer period from config (number or numeric string), else null. */
function periodFrom(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function MarketOverlayChartWidget({ config }: WidgetProps) {
  const cap = useMarketAvailable();
  const list = useMarketSeries();

  if (!cap.available && !cap.loading) return <MarketUnavailable />;
  if (list.loading && !list.data) return <WidgetState loading />;
  if (list.error) return <WidgetState error={list.error} />;

  const series = list.data?.series ?? [];
  if (series.length === 0)
    return <WidgetState empty emptyLabel="No market series configured (add one in Settings)" />;

  return (
    <Overlay
      series={series}
      ids={configuredIds(config)}
      smaPeriod={periodFrom(config?.sma)}
      emaPeriod={periodFrom(config?.ema)}
    />
  );
}

interface Plot {
  key: string;
  label: string;
  color: string;
  dash?: string;
  map: Map<string, number>;
  /** Only set for raw price lines, not moving averages. */
  pct?: string;
}

function Overlay({
  series,
  ids,
  smaPeriod,
  emaPeriod,
}: {
  series: MarketSeries[];
  ids: string[];
  smaPeriod: number | null;
  emaPeriod: number | null;
}) {
  const byId = useMemo(() => Object.fromEntries(series.map((s) => [s.id, s])), [series]);
  // Configured series that still exist, in the order configured.
  const shownIds = ids.filter((id) => byId[id]);

  const [days, setDays] = useState(DEFAULT_RANGE_DAYS);
  const [hidden, setHidden] = useState<string[]>([]);
  const points = useMarketPointsMulti(shownIds, sinceForDays(days), true);
  const data = points.data ?? {};

  const baseCurrency = byId[shownIds[0]]?.currency ?? 'USD';
  const fmt = priceFormatter(baseCurrency);

  // Raw price lines (only those that actually came back with positive data).
  const rawLines = shownIds
    .map((id, i) => {
      const pts: MarketPoint[] = data[id]?.points ?? [];
      const values = pts.map((p) => parseAmount(p.value));
      return { id, meta: byId[id], pts, values, color: colorAt(i) };
    })
    .filter((l) => l.values.some((v) => v > 0));

  const priceLines: Plot[] = rawLines.map((l) => {
    const map = new Map<string, number>();
    l.pts.forEach((p, i) => map.set(p.date, l.values[i]));
    return { key: l.id, label: l.meta.name || l.meta.symbol, color: l.color, map, pct: pctChange(l.values) };
  });

  // Moving averages overlay the FIRST series with data (the base).
  const base = rawLines[0];
  const maLines: Plot[] = [];
  const maOverlay = (period: number, prefix: string, color: string, dash: string) => {
    const fn = prefix === 'SMA' ? sma : ema;
    const out = fn(base.values, period);
    if (!out.some((v) => v !== null)) return;
    const map = new Map<string, number>();
    base.pts.forEach((p, i) => {
      if (out[i] !== null) map.set(p.date, out[i] as number);
    });
    maLines.push({ key: `__${prefix.toLowerCase()}`, label: `${prefix} ${period}`, color, dash, map });
  };
  if (base) {
    if (smaPeriod) maOverlay(smaPeriod, 'SMA', SMA_COLOR, '5 3');
    if (emaPeriod) maOverlay(emaPeriod, 'EMA', EMA_COLOR, '2 3');
  }

  const lines: Plot[] = [...priceLines, ...maLines];
  const shown = lines.filter((l) => !hidden.includes(l.key));
  const toggle = (key: string) =>
    setHidden((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  // Union of every shown line's dates, ascending, with null where a line lacks one.
  const dateSet = new Set<string>();
  for (const l of shown) for (const d of l.map.keys()) dateSet.add(d);
  const dates = [...dateSet].sort();
  const rows = dates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    for (const l of shown) row[l.key] = l.map.has(date) ? (l.map.get(date) as number) : null;
    return row;
  });

  const asOf = data[shownIds[0]]?.as_of;
  const maParts = [smaPeriod && `SMA ${smaPeriod}`, emaPeriod && `EMA ${emaPeriod}`].filter(Boolean);
  const maNote =
    base && maLines.length
      ? ` · ${maParts.join(' & ')} computed in-app from ${base.meta.name || base.meta.symbol} closes`
      : '';
  const footer = `Spot prices · ${baseCurrency}${asOf ? ` · as of ${asOf}` : ''}${maNote}`;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        {lines.map((l) => {
          const on = !hidden.includes(l.key);
          return (
            <label
              key={l.key}
              className="flex cursor-pointer select-none items-center gap-1 text-xs text-slate-300"
              title={l.label}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(l.key)}
                className="h-3 w-3 accent-blue-500"
              />
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ backgroundColor: l.color, opacity: on ? 1 : 0.35 }}
              />
              <span className={on ? '' : 'text-slate-500'}>{l.label}</span>
              {on && l.pct && <span className="text-slate-500">{l.pct}</span>}
            </label>
          );
        })}
        <RangeSelect value={days} onChange={setDays} />
      </div>
      <div className="min-h-0 flex-1">
        {shownIds.length === 0 ? (
          <WidgetState empty emptyLabel="Configure a market series to chart" />
        ) : points.loading && !points.data ? (
          <WidgetState loading />
        ) : points.error ? (
          <WidgetState error={points.error} />
        ) : shown.length === 0 ? (
          <WidgetState empty emptyLabel="Pick a line to show" />
        ) : rows.length === 0 ? (
          <WidgetState empty emptyLabel="No data yet" />
        ) : (
          <LineChart
            data={rows}
            index="date"
            categories={shown.map((l) => l.key)}
            names={shown.map((l) => l.label)}
            colors={shown.map((l) => l.color)}
            dashes={shown.map((l) => l.dash)}
            valueFormatter={fmt}
          />
        )}
      </div>
      <div className="mt-1 text-[11px] leading-tight text-slate-500">{footer}</div>
    </div>
  );
}
