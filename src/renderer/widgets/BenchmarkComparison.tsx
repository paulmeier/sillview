import { useState } from 'react';
import { useAccounts, useMarketAvailable, useMarketPoints, useMarketSeries } from '../api/hooks';
import { formatMoney, parseAmount } from '../lib/money';
import { AreaChart } from '../components/tremor/AreaChart';
import { WidgetState } from '../components/ui';
import type { WidgetProps } from './types';
import { growthOf, MarketUnavailable, pctChange } from './market-util';

/**
 * Benchmark comparison (sillview ADR-0004): chart a market series as "growth of
 * $10,000" against the latest balance of one of the user's accounts, for context.
 *
 * Honest by construction (ADR-0004 devil's advocate): kasas keeps only the LATEST
 * balance per account — there is no account value history yet (that needs balance
 * snapshots) — so this is a benchmark OVERLAY, not performance attribution. The
 * account is shown as its current *balance*, never a *return*, and the series is
 * labeled price vs total-return.
 */
export function BenchmarkComparisonWidget({ config }: WidgetProps) {
  const cap = useMarketAvailable();
  const list = useMarketSeries();
  const accounts = useAccounts(false);
  const [pickedSeries, setPickedSeries] = useState<string>((config?.series as string) ?? '');
  const [pickedAccount, setPickedAccount] = useState<string>((config?.account as string) ?? '');

  if (!cap.available && !cap.loading) return <MarketUnavailable />;
  if (list.loading && !list.data) return <WidgetState loading />;
  if (list.error) return <WidgetState error={list.error} />;

  const series = list.data?.series ?? [];
  if (series.length === 0)
    return <WidgetState empty emptyLabel="No market series configured (add one in Settings)" />;

  const seriesId = series.some((s) => s.id === pickedSeries) ? pickedSeries : series[0].id;
  const seriesMeta = series.find((s) => s.id === seriesId);
  const accountList = accounts.data ?? [];
  const accountId = accountList.some((a) => a.id === pickedAccount) ? pickedAccount : accountList[0]?.id ?? '';
  const account = accountList.find((a) => a.id === accountId);

  return (
    <Body
      seriesId={seriesId}
      seriesLabel={seriesMeta?.symbol ?? seriesId}
      adjusted={!!seriesMeta?.adjusted}
      seriesOptions={series.map((s) => ({ id: s.id, label: s.name || s.symbol }))}
      pickedSeries={seriesId}
      onPickSeries={setPickedSeries}
      accountOptions={accountList.map((a) => ({ id: a.id, label: a.name }))}
      pickedAccount={accountId}
      onPickAccount={setPickedAccount}
      accountBalance={account ? formatMoney(account.balance, account.currency) : '—'}
    />
  );
}

function Body(props: {
  seriesId: string;
  seriesLabel: string;
  adjusted: boolean;
  seriesOptions: { id: string; label: string }[];
  pickedSeries: string;
  onPickSeries: (id: string) => void;
  accountOptions: { id: string; label: string }[];
  pickedAccount: string;
  onPickAccount: (id: string) => void;
  accountBalance: string;
}) {
  const points = useMarketPoints(props.seriesId, true);

  if (points.loading && !points.data) return <WidgetState loading />;
  if (points.error) return <WidgetState error={points.error} />;

  const raw = points.data?.points ?? [];
  if (raw.length === 0) return <WidgetState empty emptyLabel="No data yet" />;

  const values = raw.map((p) => parseAmount(p.value));
  // Guard against unparseable/empty data (growth indexing needs a positive base):
  // a flat $10k line would silently misrepresent it.
  if (!values.some((v) => v > 0)) return <WidgetState empty emptyLabel="No data yet" />;
  const growth = growthOf(values, 10_000);
  const label = `${props.seriesLabel} ($10k)`;
  const rows = raw.map((p, i) => ({ date: p.date, [label]: Math.round(growth[i]) }));
  const kindLabel = props.adjusted ? 'total return' : 'price';

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <select
          className="rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-xs text-slate-200"
          value={props.pickedSeries}
          onChange={(e) => props.onPickSeries(e.target.value)}
        >
          {props.seriesOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">vs</span>
        <select
          className="rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-xs text-slate-200"
          value={props.pickedAccount}
          onChange={(e) => props.onPickAccount(e.target.value)}
        >
          {props.accountOptions.length === 0 && <option value="">No accounts</option>}
          {props.accountOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-slate-400">
          {props.seriesLabel} {pctChange(values)} · balance {props.accountBalance}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <AreaChart data={rows} index="date" categories={[label]} colors={['#10b981']} valueFormatter={(v) => `$${v.toLocaleString()}`} />
      </div>
      <div className="mt-1 text-[11px] leading-tight text-slate-500">
        {props.seriesLabel} {kindLabel} grown from $10,000 · your account shows its latest <strong>balance</strong> (deposits
        included), not a return — a benchmark overlay for context.
      </div>
    </div>
  );
}
