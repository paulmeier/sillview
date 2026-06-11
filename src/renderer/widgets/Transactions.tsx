import { useAccounts, useTransactions } from '../api/hooks';
import { amountColor, formatSignedMoney } from '../lib/money';
import { formatDate } from '../lib/time';
import { Pill, WidgetState } from '../components/ui';
import { accountCurrencyMap } from './util';

export function TransactionsWidget() {
  const txns = useTransactions({ limit: 40 });
  const accounts = useAccounts(false);

  if (txns.loading || txns.error)
    return <WidgetState loading={txns.loading} error={txns.error} />;
  if (!txns.data || txns.data.length === 0)
    return <WidgetState empty emptyLabel="No transactions" />;

  const currencyOf = accountCurrencyMap(accounts.data ?? []);

  return (
    <div className="scroll-area h-full">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {txns.data.map((t) => {
            const currency = currencyOf.get(t.account_id) ?? '';
            const labels = Object.entries(t.labels ?? {});
            return (
              <tr key={t.id} className="border-b border-line/60 last:border-0">
                <td className="whitespace-nowrap py-2 pr-3 align-top text-xs text-slate-500">
                  {formatDate(t.date)}
                </td>
                <td className="py-2 pr-3 align-top">
                  <div className="truncate font-medium text-slate-200">
                    {t.payee || t.description || '—'}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {t.pending && <Pill tone="amber">pending</Pill>}
                    {labels.slice(0, 3).map(([k, v]) => (
                      <Pill key={k} tone="neutral">
                        {k}: {v}
                      </Pill>
                    ))}
                  </div>
                </td>
                <td
                  className={`whitespace-nowrap py-2 pl-2 text-right align-top font-semibold tabular-nums ${amountColor(t.amount)}`}
                >
                  {formatSignedMoney(t.amount, currency)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
