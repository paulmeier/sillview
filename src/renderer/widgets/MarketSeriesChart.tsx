import { useState } from 'react';
import { useMarketAvailable, useMarketPoints, useMarketSeries } from '../api/hooks';
import { parseAmount } from '../lib/money';
import { AreaChart } from '../components/tremor/AreaChart';
import { WidgetState } from '../components/ui';
import type { WidgetProps } from './types';
import { DEFAULT_RANGE_DAYS, MarketUnavailable, RangeSelect, sinceForDays } from './market-util';

/**
 * A standalone line chart of one configured market series' daily closes, fetched
 * on demand through kasas's read-through cache (ADR 0006). The series is chosen
 * inline (or defaulted from the widget config). Values are a benchmark series, not
 * the user's account — labeled honestly as price vs total-return.
 */
export function MarketSeriesChartWidget({ config }: WidgetProps) {
  const cap = useMarketAvailable();
  const list = useMarketSeries();
  const [picked, setPicked] = useState<string>((config?.series as string) ?? '');

  if (!cap.available && !cap.loading) return <MarketUnavailable />;
  if (list.loading && !list.data) return <WidgetState loading />;
  if (list.error) return <WidgetState error={list.error} />;

  const series = list.data?.series ?? [];
  if (series.length === 0)
    return <WidgetState empty emptyLabel="No market series configured (add one in Settings)" />;

  const id = series.some((s) => s.id === picked) ? picked : series[0].id;
  const meta = series.find((s) => s.id === id);

  return <SeriesChart id={id} label={meta?.symbol ?? id} adjusted={!!meta?.adjusted} currency={meta?.currency ?? ''} options={series.map((s) => ({ id: s.id, label: s.name || s.symbol }))} picked={id} onPick={setPicked} />;
}

function SeriesChart({
  id,
  label,
  adjusted,
  currency,
  options,
  picked,
  onPick,
}: {
  id: string;
  label: string;
  adjusted: boolean;
  currency: string;
  options: { id: string; label: string }[];
  picked: string;
  onPick: (id: string) => void;
}) {
  const [days, setDays] = useState(DEFAULT_RANGE_DAYS);
  const points = useMarketPoints(id, sinceForDays(days), true);

  if (points.loading && !points.data) return <WidgetState loading />;
  if (points.error) return <WidgetState error={points.error} />;

  const rows = (points.data?.points ?? []).map((p) => ({ date: p.date, [label]: parseAmount(p.value) }));
  if (rows.length === 0) return <WidgetState empty emptyLabel="No data yet" />;

  const kindLabel = adjusted ? 'total return' : 'price';

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <select
            className="rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-xs text-slate-200"
            value={picked}
            onChange={(e) => onPick(e.target.value)}
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <RangeSelect value={days} onChange={setDays} />
        </div>
        <span className="text-xs text-slate-500">
          {kindLabel} · {currency}
          {points.data?.as_of ? ` · as of ${points.data.as_of}` : ''}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <AreaChart data={rows} index="date" categories={[label]} colors={['#6ea8fe']} valueFormatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
      </div>
    </div>
  );
}
