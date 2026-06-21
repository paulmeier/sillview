/**
 * Moving-average indicators over a price series.
 *
 * kasas serves only raw daily closes — it has no technical-indicator series kind
 * (see MarketKind: equity | fund | index | fx | crypto), so an SMA/EMA overlay
 * has to be derived on our side. These live in `src/shared/` (no React, no DOM)
 * so the market widget AND the unit tests can both import them.
 *
 * Both return an array the SAME length as `values`, with `null` across the
 * warm-up window where the average isn't defined yet (the first `period - 1`
 * points). Charts render a `null` as a gap, so a moving-average line correctly
 * begins only once it has enough history rather than drawing a misleading
 * partial average from day one.
 */

/** N-period simple moving average; `null` until `period` points are available. */
export function sma(values: number[], period: number): (number | null)[] {
  if (!Number.isInteger(period) || period < 1) return values.map(() => null);
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

/**
 * N-period exponential moving average, seeded at index `period - 1` with the
 * simple average of the first `period` values (the conventional seed). It's
 * therefore `null` across the same warm-up window as {@link sma}, so the two
 * lines start together.
 */
export function ema(values: number[], period: number): (number | null)[] {
  if (!Number.isInteger(period) || period < 1) return values.map(() => null);
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;

  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < period; i++) prev += values[i];
  prev /= period; // SMA seed at index period - 1
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}
