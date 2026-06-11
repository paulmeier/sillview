import { useAccounts } from '../api/hooks';
import { formatMoney, parseAmount } from '../lib/money';
import { WidgetState } from '../components/ui';

export function NetWorthWidget() {
  const { data: accounts, loading, error } = useAccounts();

  if (loading || error) return <WidgetState loading={loading} error={error} />;
  if (!accounts || accounts.length === 0)
    return <WidgetState empty emptyLabel="No accounts connected" />;

  // Balances can't be summed across currencies — total per currency instead.
  const byCurrency = new Map<string, number>();
  for (const a of accounts) {
    byCurrency.set(a.currency, (byCurrency.get(a.currency) ?? 0) + parseAmount(a.balance));
  }
  const totals = [...byCurrency.entries()].sort(
    (a, b) => Math.abs(b[1]) - Math.abs(a[1]),
  );
  const [primaryCur, primaryVal] = totals[0];

  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Net worth
        </div>
        <div className="mt-1 text-3xl font-semibold tracking-tight text-slate-50">
          {formatMoney(primaryVal, primaryCur)}
        </div>
      </div>

      {totals.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
          {totals.slice(1).map(([cur, val]) => (
            <span key={cur}>{formatMoney(val, cur)}</span>
          ))}
        </div>
      )}

      <div className="text-xs text-slate-500">
        Across {accounts.length} account{accounts.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
