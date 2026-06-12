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

/** Percentage change from the first to the last positive value, e.g. "+8.3%". */
export function pctChange(values: number[]): string {
  const first = values.find((v) => v > 0);
  const last = [...values].reverse().find((v) => v > 0);
  if (!first || !last) return '—';
  const pct = ((last - first) / first) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}
