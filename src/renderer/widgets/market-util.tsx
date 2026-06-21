/**
 * Shared bits for the market-data widgets (ADR 0006 / sillview ADR-0004).
 */

/**
 * MarketUnavailable is the capability-gated fallback (ADR-0002): shown when the
 * connected kasas predates the /api/v1/market/* endpoints, so the widget degrades
 * to an actionable tile instead of a broken chart.
 */
export function MarketUnavailable() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
      <span className="text-sm text-slate-300">Market data needs a newer kasas</span>
      <span className="text-xs text-slate-500">
        This backend doesn’t serve <code>/api/v1/market</code>. Update kasas to chart benchmarks.
      </span>
    </div>
  );
}

/** Normalize a value series to "growth of $amount" indexed to the first point. */
export function growthOf(values: number[], amount = 10_000): number[] {
  const base = values.find((v) => v > 0);
  if (!base) return values.map(() => amount);
  return values.map((v) => (amount * v) / base);
}

/**
 * A price/value formatter bound to a series' currency: `$1,234.56` for USD,
 * otherwise `1,234.56 CODE`. Used for both the y-axis ticks and the tooltip, so
 * it stays compact (no forced cents) while still distinguishing magnitudes.
 */
export function priceFormatter(currency: string): (v: number) => string {
  const usd = currency === 'USD';
  return (v: number) => {
    const n = v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return usd ? `$${n}` : `${n} ${currency}`;
  };
}

/** Percentage change from the first to the last positive value, e.g. "+8.3%". */
export function pctChange(values: number[]): string {
  const first = values.find((v) => v > 0);
  const last = [...values].reverse().find((v) => v > 0);
  if (!first || !last) return '—';
  const pct = ((last - first) / first) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

/**
 * Lookback presets for the market charts. The chosen window scopes the points
 * request (a `since` lower bound) so a widget fetches only what it displays —
 * not the series' full cached history. `days: 0` ("Max") means no lower bound.
 */
export const RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'Max', days: 0 },
] as const;

/** The default lookback — bounds the request without hiding a meaningful window. */
export const DEFAULT_RANGE_DAYS = 365;

/** ISO date `days` before today, or undefined for "Max" (no lower bound). */
export function sinceForDays(days: number): string | undefined {
  if (!days) return undefined;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Compact lookback picker shared by the market widgets. */
export function RangeSelect({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <select
      className="rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-xs text-slate-200"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      title="Time range"
    >
      {RANGES.map((r) => (
        <option key={r.label} value={r.days}>
          {r.label}
        </option>
      ))}
    </select>
  );
}
