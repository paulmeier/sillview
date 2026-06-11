import { useAccounts, useTransactions } from '../api/hooks';
import { formatMoney, parseAmount } from '../lib/money';
import { DonutChart } from '../components/tremor/DonutChart';
import { WidgetState } from '../components/ui';
import { accountCurrencyMap, dominantCurrency } from './util';
import type { Transaction } from '../../shared/kasas-types';

const MAX_SLICES = 7;

/** Pick the label key present on the most transactions, or null if unlabeled. */
function pickLabelKey(txns: Transaction[]): string | null {
  const counts = new Map<string, number>();
  for (const t of txns) {
    for (const key of Object.keys(t.labels ?? {})) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [key, n] of counts) {
    if (n > bestN) {
      bestN = n;
      best = key;
    }
  }
  return best;
}

export function SpendByLabelWidget() {
  const txns = useTransactions({ limit: 300 });
  const accounts = useAccounts(false);

  if (txns.loading || txns.error)
    return <WidgetState loading={txns.loading} error={txns.error} />;
  if (!txns.data || txns.data.length === 0)
    return <WidgetState empty emptyLabel="No transactions" />;

  const currency = dominantCurrency(accounts.data ?? []) ?? '';
  const currencyOf = accountCurrencyMap(accounts.data ?? []);

  // Outflows in the dominant currency only (don't mix currencies in one donut).
  const outflows = txns.data.filter(
    (t) => parseAmount(t.amount) < 0 && (!currency || currencyOf.get(t.account_id) === currency),
  );
  if (outflows.length === 0) return <WidgetState empty emptyLabel="No spending yet" />;

  const labelKey = pickLabelKey(outflows);
  const groupOf = (t: Transaction): string =>
    labelKey ? (t.labels?.[labelKey] ?? 'Unlabeled') : t.payee || t.description || '—';

  const totals = new Map<string, number>();
  for (const t of outflows) {
    const g = groupOf(t);
    totals.set(g, (totals.get(g) ?? 0) + Math.abs(parseAmount(t.amount)));
  }

  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, MAX_SLICES);
  const rest = sorted.slice(MAX_SLICES).reduce((sum, [, v]) => sum + v, 0);
  const data = top.map(([name, value]) => ({ name, value }));
  if (rest > 0) data.push({ name: 'Other', value: rest });

  const grandTotal = sorted.reduce((sum, [, v]) => sum + v, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 text-xs text-slate-500">
        Spending by {labelKey ? `“${labelKey}”` : 'payee'}
      </div>
      <div className="min-h-0 flex-1">
        <DonutChart
          data={data}
          valueFormatter={(v) => formatMoney(v, currency)}
          centerValue={formatMoney(grandTotal, currency)}
          centerLabel="outflow"
        />
      </div>
    </div>
  );
}
