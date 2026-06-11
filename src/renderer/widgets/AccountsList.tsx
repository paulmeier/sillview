import { useAccounts } from '../api/hooks';
import { amountColor, formatMoney, parseAmount } from '../lib/money';
import { Pill, WidgetState } from '../components/ui';

export function AccountsListWidget() {
  const { data: accounts, loading, error } = useAccounts();

  if (loading || error) return <WidgetState loading={loading} error={error} />;
  if (!accounts || accounts.length === 0)
    return <WidgetState empty emptyLabel="No accounts" />;

  const sorted = [...accounts].sort(
    (a, b) => Math.abs(parseAmount(b.balance)) - Math.abs(parseAmount(a.balance)),
  );

  return (
    <div className="scroll-area h-full">
      <ul className="divide-y divide-line/70">
        {sorted.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-200">{a.name}</div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="text-xs text-slate-500">{a.currency}</span>
                {a.source === 'manual' && <Pill tone="blue">manual</Pill>}
              </div>
            </div>
            <div className={`shrink-0 text-sm font-semibold tabular-nums ${amountColor(a.balance)}`}>
              {formatMoney(a.balance, a.currency)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
