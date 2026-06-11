import { useAccounts, useTransactions } from '../api/hooks';
import { formatMoney, parseAmount } from '../lib/money';
import { monthKey, monthLabel } from '../lib/time';
import { BarChart } from '../components/tremor/BarChart';
import { WidgetState } from '../components/ui';
import { accountCurrencyMap, dominantCurrency } from './util';

const MONTHS = 6;

export function CashflowWidget() {
  const txns = useTransactions({ limit: 600 });
  const accounts = useAccounts(false);

  if (txns.loading || txns.error)
    return <WidgetState loading={txns.loading} error={txns.error} />;
  if (!txns.data || txns.data.length === 0)
    return <WidgetState empty emptyLabel="No transactions" />;

  const currency = dominantCurrency(accounts.data ?? []) ?? '';
  const currencyOf = accountCurrencyMap(accounts.data ?? []);

  const buckets = new Map<string, { In: number; Out: number }>();
  for (const t of txns.data) {
    if (currency && currencyOf.get(t.account_id) !== currency) continue;
    const key = monthKey(t.date);
    const bucket = buckets.get(key) ?? { In: 0, Out: 0 };
    const amount = parseAmount(t.amount);
    if (amount >= 0) bucket.In += amount;
    else bucket.Out += Math.abs(amount);
    buckets.set(key, bucket);
  }

  const rows = [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-MONTHS)
    .map(([key, v]) => ({ month: monthLabel(key), In: v.In, Out: v.Out }));

  if (rows.length === 0) return <WidgetState empty emptyLabel="No activity" />;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 text-xs text-slate-500">Cash flow · {currency}</div>
      <div className="min-h-0 flex-1">
        <BarChart
          data={rows}
          index="month"
          categories={['In', 'Out']}
          colors={['#10b981', '#f43f5e']}
          showLegend
          valueFormatter={(v) => formatMoney(v, currency)}
        />
      </div>
    </div>
  );
}
