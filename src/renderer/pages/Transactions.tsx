/**
 * Transactions management page: filter by account, sort, paginate, inline-edit
 * labels, and create/edit/delete manual transactions. Amounts stay decimal
 * strings throughout (see lib/money). Synced rows are read-only (kasas 409s).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiDeleteBinLine,
  RiInformationLine,
  RiPencilLine,
} from '@remixicon/react';
import { kasas, KasasError } from '../api/kasas';
import { useFamilyKeys } from '../api/hooks';
import { PageShell } from '../shell/Page';
import { LabelEditor } from '../components/LabelEditor';
import { TransactionEditor } from '../components/TransactionEditor';
import { TransactionDetail } from '../components/TransactionDetail';
import { Button, IconButton, Pill, Spinner } from '../components/ui';
import { amountColor, formatSignedMoney, parseAmount } from '../lib/money';
import { formatDate } from '../lib/time';
import { accountCurrencyMap } from '../widgets/util';
import { cx } from '../lib/utils';
import type { Account, Label, Transaction } from '../../shared/kasas-types';

const PAGE_SIZE = 50;

type SortField = 'date' | 'account' | 'description' | 'amount';

async function fetchAllTransactions(accountId?: string): Promise<Transaction[]> {
  const all: Transaction[] = [];
  const limit = 1000;
  for (let offset = 0; ; offset += limit) {
    const batch = await kasas.transactions({ account_id: accountId, limit, offset });
    all.push(...batch);
    if (batch.length < limit) break;
    if (offset > 100_000) break; // hard safety stop
  }
  return all;
}

export function Transactions() {
  const keys = useFamilyKeys(['transaction', 'label', 'account', 'sync']);

  const [txns, setTxns] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vocabulary, setVocabulary] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const [accountFilter, setAccountFilter] = useState('all');
  const [text, setText] = useState('');
  const [sort, setSort] = useState<{ field: SortField; dir: 'asc' | 'desc' }>({
    field: 'date',
    dir: 'desc',
  });
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<{ open: boolean; txn?: Transaction }>({ open: false });
  const [detail, setDetail] = useState<Transaction | null>(null);

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const [t, a, l] = await Promise.all([
        fetchAllTransactions(),
        kasas.accounts(),
        kasas.labels(),
      ]);
      setTxns(t);
      setAccounts(a);
      setVocabulary(l);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, ...keys]);

  const currencyOf = useMemo(() => accountCurrencyMap(accounts), [accounts]);
  const nameOf = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.name])),
    [accounts],
  );

  const filtered = useMemo(() => {
    let list = txns;
    if (accountFilter !== 'all') list = list.filter((t) => t.account_id === accountFilter);
    const q = text.trim().toLowerCase();
    if (q) {
      list = list.filter((t) =>
        [t.payee, t.description, t.memo].some((s) => (s ?? '').toLowerCase().includes(q)),
      );
    }
    const dir = sort.dir === 'asc' ? 1 : -1;
    const sorted = [...list].sort((a, b) => {
      switch (sort.field) {
        case 'amount':
          return (parseAmount(a.amount) - parseAmount(b.amount)) * dir;
        case 'account':
          return (nameOf.get(a.account_id) ?? '').localeCompare(nameOf.get(b.account_id) ?? '') * dir;
        case 'description':
          return (a.payee || a.description).localeCompare(b.payee || b.description) * dir;
        default:
          return (Date.parse(a.date) - Date.parse(b.date)) * dir;
      }
    });
    return sorted;
  }, [txns, accountFilter, text, sort, nameOf]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (field: SortField) =>
    setSort((s) => (s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'desc' }));

  const saveLabels = async (txn: Transaction, next: Record<string, string>) => {
    const prev = txn.labels;
    setTxns((list) => list.map((t) => (t.id === txn.id ? { ...t, labels: next } : t)));
    try {
      await kasas.setLabels(txn.id, next);
    } catch (e) {
      setTxns((list) => list.map((t) => (t.id === txn.id ? { ...t, labels: prev } : t)));
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (txn: Transaction) => {
    if (!confirm(`Delete this transaction (${txn.payee || txn.description})?`)) return;
    try {
      await kasas.deleteTransaction(txn.id);
      setTxns((list) => list.filter((t) => t.id !== txn.id));
    } catch (e) {
      setError(
        e instanceof KasasError && e.status === 409
          ? 'Only manual transactions can be deleted.'
          : e instanceof Error
            ? e.message
            : String(e),
      );
    }
  };

  const SortHeader = ({ field, label, className }: { field: SortField; label: string; className?: string }) => (
    <th className={cx('cursor-pointer select-none py-2 font-medium text-slate-400 hover:text-slate-200', className)} onClick={() => toggleSort(field)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {sort.field === field &&
          (sort.dir === 'asc' ? <RiArrowUpSLine className="size-3.5" /> : <RiArrowDownSLine className="size-3.5" />)}
      </span>
    </th>
  );

  const actions = (
    <Button variant="primary" onClick={() => setEditing({ open: true })} disabled={accounts.length === 0}>
      <RiAddLine className="size-4" />
      New transaction
    </Button>
  );

  return (
    <PageShell title="Transactions" subtitle={`${filtered.length} transactions`} actions={actions}>
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={accountFilter}
              onChange={(e) => {
                setAccountFilter(e.target.value);
                setPage(0);
              }}
              className="rounded-lg border border-line bg-surface-raised px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500/60 focus:outline-none"
            >
              <option value="all">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setPage(0);
              }}
              placeholder="Filter by payee / description…"
              className="w-64 rounded-lg border border-line bg-surface-raised px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/60 focus:outline-none"
              spellCheck={false}
            />
          </div>

          {error && <div className="text-sm text-rose-300/90">{error}</div>}

          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-white/[0.03] text-left text-xs">
                <tr className="border-b border-line">
                  <SortHeader field="date" label="Date" className="px-3" />
                  <SortHeader field="account" label="Account" className="px-3" />
                  <SortHeader field="description" label="Payee" className="px-3" />
                  <th className="px-3 py-2 font-medium text-slate-400">Labels</th>
                  <SortHeader field="amount" label="Amount" className="px-3 text-right" />
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((t) => {
                  const currency = currencyOf.get(t.account_id) ?? '';
                  const manual = t.source === 'manual';
                  const extKeys = Object.keys(t.extensions ?? {});
                  return (
                    <tr key={t.id} className="border-b border-line/60 last:border-0 hover:bg-white/[0.02]">
                      <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-slate-500">
                        {formatDate(t.date)}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-slate-400">
                        {nameOf.get(t.account_id) ?? t.account_id}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="font-medium text-slate-200">{t.payee || t.description || '—'}</div>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {t.pending && <Pill tone="amber">pending</Pill>}
                          {!manual && <Pill tone="neutral">{t.source}</Pill>}
                          {extKeys.map((k) => (
                            <Pill key={k} tone="blue">
                              {k}
                            </Pill>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <LabelEditor
                          value={t.labels ?? {}}
                          vocabulary={vocabulary}
                          onSave={(next) => void saveLabels(t, next)}
                        />
                      </td>
                      <td className={cx('whitespace-nowrap px-3 py-2 text-right align-top font-semibold tabular-nums', amountColor(t.amount))}>
                        {formatSignedMoney(t.amount, currency)}
                      </td>
                      <td className="px-2 py-2 align-top">
                        <div className="flex items-center justify-end gap-0.5">
                          <IconButton aria-label="Details" title="History, provenance, relationships" onClick={() => setDetail(t)}>
                            <RiInformationLine className="size-4" />
                          </IconButton>
                          <IconButton
                            aria-label="Edit"
                            disabled={!manual}
                            title={manual ? 'Edit' : 'Synced rows are read-only'}
                            onClick={() => setEditing({ open: true, txn: t })}
                          >
                            <RiPencilLine className="size-4" />
                          </IconButton>
                          <IconButton aria-label="Delete" disabled={!manual} onClick={() => void remove(t)}>
                            <RiDeleteBinLine className="size-4" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                      No transactions match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-end gap-3 text-sm text-slate-400">
              <span>
                Page {clampedPage + 1} of {pageCount}
              </span>
              <Button variant="subtle" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={clampedPage === 0}>
                Prev
              </Button>
              <Button
                variant="subtle"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={clampedPage >= pageCount - 1}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {editing.open && (
        <TransactionEditor
          open={editing.open}
          accounts={accounts}
          existing={editing.txn}
          onClose={() => setEditing({ open: false })}
          onSaved={load}
        />
      )}

      {detail && (
        <TransactionDetail open={!!detail} txn={detail} txns={txns} onClose={() => setDetail(null)} />
      )}
    </PageShell>
  );
}
