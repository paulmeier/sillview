import { useAccounts } from '../api/hooks';
import { formatMoney, parseAmount } from '../lib/money';
import { BarChart } from '../components/tremor/BarChart';
import { WidgetState } from '../components/ui';
import { dominantCurrency } from './util';

export function AccountBalancesWidget() {
  const { data: accounts, loading, error } = useAccounts();

  if (loading || error) return <WidgetState loading={loading} error={error} />;
  if (!accounts || accounts.length === 0)
    return <WidgetState empty emptyLabel="No accounts" />;

  const currency = dominantCurrency(accounts) ?? accounts[0].currency;
  const rows = accounts
    .filter((a) => a.currency === currency)
    .map((a) => ({ name: a.name, balance: parseAmount(a.balance) }))
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
    .slice(0, 8);

  if (rows.length === 0) return <WidgetState empty emptyLabel="No balances" />;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 text-xs text-slate-500">Balances · {currency}</div>
      <div className="min-h-0 flex-1">
        <BarChart
          data={rows}
          index="name"
          categories={['balance']}
          layout="vertical"
          valueFormatter={(v) => formatMoney(v, currency)}
        />
      </div>
    </div>
  );
}
