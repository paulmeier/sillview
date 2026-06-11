/**
 * Money formatting for kasas amounts.
 *
 * kasas amounts/balances are signed decimal STRINGS in major units with variable
 * scale (2 for USD, 8 for BTC, up to 18 for ETH). The rules:
 *   - For display of a single raw value, prefer the original string (no float
 *     round-trip) so crypto precision survives.
 *   - parseAmount() is ONLY for sorting/aggregation/charts, never for storage.
 *   - Intl currency formatting works for ISO fiat codes; crypto/unknown codes
 *     throw in the Intl constructor, so we fall back to "<value> <CODE>".
 */

/** Parse a decimal string to a number — for compare/sum/charts ONLY. */
export function parseAmount(amount: string | number): number {
  if (typeof amount === 'number') return amount;
  const n = parseFloat(amount.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Drop trailing zeros (and a dangling dot) from a decimal string. */
function trimDecimal(s: string): string {
  if (!s.includes('.')) return s;
  return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function isIsoCurrency(code: string): boolean {
  try {
    // Throws RangeError for non-ISO codes like BTC/ETH.
    new Intl.NumberFormat(undefined, { style: 'currency', currency: code });
    return true;
  } catch {
    return false;
  }
}

/**
 * Format a kasas amount against its account currency.
 * Accepts the raw string (preferred) or a pre-aggregated number.
 */
export function formatMoney(amount: string | number, currency: string): string {
  const code = (currency || '').toUpperCase();

  if (isIsoCurrency(code)) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
    }).format(parseAmount(amount));
  }

  // Crypto / unknown code: keep precision, append the symbol.
  const body =
    typeof amount === 'string'
      ? trimDecimal(amount.trim())
      : trimDecimal(amount.toFixed(8));
  return `${body} ${code}`.trim();
}

/** Like formatMoney but always shows an explicit + / − sign. */
export function formatSignedMoney(amount: string | number, currency: string): string {
  const value = parseAmount(amount);
  const formatted = formatMoney(typeof amount === 'string' ? amount.replace(/^-/, '') : Math.abs(value), currency);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}

/** Compact axis/label formatter, e.g. 12.3K, 1.2M. */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/** A tailwind text color class for an amount's sign. */
export function amountColor(amount: string | number): string {
  const v = parseAmount(amount);
  if (v > 0) return 'text-emerald-400';
  if (v < 0) return 'text-rose-400';
  return 'text-slate-400';
}
