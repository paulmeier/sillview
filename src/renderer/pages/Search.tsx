/**
 * Search page — kasas query language over transactions, with a syntax help modal
 * and the last query persisted. Results reuse the inline label editor and the
 * transaction detail modal.
 */

import { useCallback, useEffect, useState } from 'react';
import { RiInformationLine, RiQuestionLine, RiSearchLine } from '@remixicon/react';
import { kasas, KasasError } from '../api/kasas';
import { PageShell } from '../shell/Page';
import { LabelEditor } from '../components/LabelEditor';
import { TransactionDetail } from '../components/TransactionDetail';
import { Modal } from '../components/ui/Modal';
import { Button, IconButton, Pill, Spinner } from '../components/ui';
import { amountColor, formatSignedMoney } from '../lib/money';
import { formatDate } from '../lib/time';
import { accountCurrencyMap } from '../widgets/util';
import { cx } from '../lib/utils';
import type { Account, Label, Transaction } from '../../shared/kasas-types';

const STORAGE_KEY = 'sillview.search.query';

const EXAMPLES = [
  ['coffee', 'free-text match on payee/description/memo'],
  ['amount:<0', 'outflows only (amount:>0 for inflows)'],
  ['date:2024', 'transactions in 2024 (date:2024-06 for a month)'],
  ['label:category=food', 'has the label category:food'],
  ['coffee amount:<-5', 'combine terms (AND)'],
];

function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Search syntax" size="sm">
      <div className="space-y-2 text-sm">
        {EXAMPLES.map(([q, desc]) => (
          <div key={q} className="flex flex-col gap-0.5">
            <code className="w-fit rounded bg-black/30 px-1.5 py-0.5 text-xs text-blue-300">{q}</code>
            <span className="text-xs text-slate-500">{desc}</span>
          </div>
        ))}
        <p className="pt-1 text-xs text-slate-500">An empty query matches everything.</p>
      </div>
    </Modal>
  );
}

export function Search() {
  const [query, setQuery] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');
  const [results, setResults] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vocabulary, setVocabulary] = useState<Label[]>([]);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [error, setError] = useState<string>();
  const [help, setHelp] = useState(false);
  const [detail, setDetail] = useState<Transaction | null>(null);

  useEffect(() => {
    void Promise.all([kasas.accounts(), kasas.labels()]).then(([a, l]) => {
      setAccounts(a);
      setVocabulary(l);
    });
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    localStorage.setItem(STORAGE_KEY, query);
    try {
      const res = await kasas.search(query, { limit: 200 });
      setResults(res.transactions ?? []);
      setTotal(res.total ?? res.transactions?.length ?? 0);
      setRan(true);
    } catch (e) {
      setError(
        e instanceof KasasError && e.status === 400
          ? `Invalid query: ${e.message}`
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      setLoading(false);
    }
  }, [query]);

  const currencyOf = accountCurrencyMap(accounts);

  const saveLabels = async (txn: Transaction, next: Record<string, string>) => {
    const prev = txn.labels;
    setResults((list) => list.map((t) => (t.id === txn.id ? { ...t, labels: next } : t)));
    try {
      await kasas.setLabels(txn.id, next);
    } catch (e) {
      setResults((list) => list.map((t) => (t.id === txn.id ? { ...t, labels: prev } : t)));
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const actions = (
    <IconButton aria-label="Search help" onClick={() => setHelp(true)}>
      <RiQuestionLine className="size-4" />
    </IconButton>
  );

  return (
    <PageShell title="Search" subtitle={ran ? `${total} matches` : 'kasas query language'} actions={actions}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void run()}
              placeholder="e.g. coffee amount:<0 label:category=food"
              spellCheck={false}
              className="w-full rounded-lg border border-line bg-surface-raised py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/60 focus:outline-none"
            />
          </div>
          <Button variant="primary" onClick={() => void run()} disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </Button>
        </div>

        {error && <div className="text-sm text-rose-300/90">{error}</div>}

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner />
          </div>
        ) : ran ? (
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {results.map((t) => {
                  const currency = currencyOf.get(t.account_id) ?? '';
                  return (
                    <tr key={t.id} className="border-b border-line/60 last:border-0 hover:bg-white/[0.02]">
                      <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-slate-500">
                        {formatDate(t.date)}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="font-medium text-slate-200">{t.payee || t.description || '—'}</div>
                        <div className="mt-0.5">
                          {t.pending && <Pill tone="amber">pending</Pill>}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <LabelEditor value={t.labels ?? {}} vocabulary={vocabulary} onSave={(n) => void saveLabels(t, n)} />
                      </td>
                      <td className={cx('whitespace-nowrap px-3 py-2 text-right align-top font-semibold tabular-nums', amountColor(t.amount))}>
                        {formatSignedMoney(t.amount, currency)}
                      </td>
                      <td className="px-2 py-2 text-right align-top">
                        <IconButton aria-label="Details" onClick={() => setDetail(t)}>
                          <RiInformationLine className="size-4" />
                        </IconButton>
                      </td>
                    </tr>
                  );
                })}
                {results.length === 0 && (
                  <tr>
                    <td className="px-3 py-8 text-center text-sm text-slate-500">No matches.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-slate-500">
            Enter a query and press Search.
          </div>
        )}
      </div>

      <HelpModal open={help} onClose={() => setHelp(false)} />
      {detail && <TransactionDetail open={!!detail} txn={detail} txns={results} onClose={() => setDetail(null)} />}
    </PageShell>
  );
}
