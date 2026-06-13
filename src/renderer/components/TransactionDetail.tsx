/**
 * Read-mostly detail modal for one transaction, with three tabs:
 *  - History: the version timeline with per-version field/label/extension diffs.
 *  - Provenance: where the row came from and how it reached its current state.
 *  - Relationships: the inbound/outbound neighborhood, with add/remove.
 */

import { useCallback, useEffect, useState } from 'react';
import { RiCloseLine } from '@remixicon/react';
import { kasas } from '../api/kasas';
import { Modal } from './ui/Modal';
import { Button, Pill, Spinner } from './ui';
import { cx } from '../lib/utils';
import { formatDate, formatDateTime } from '../lib/time';
import type {
  Provenance,
  RelationshipEdge,
  RelationshipKind,
  Transaction,
  TransactionHistory,
} from '../../shared/kasas-types';

type Tab = 'history' | 'provenance' | 'relationships';
const TABS: { id: Tab; label: string }[] = [
  { id: 'history', label: 'History' },
  { id: 'provenance', label: 'Provenance' },
  { id: 'relationships', label: 'Relationships' },
];

function HistoryView({ id }: { id: string }) {
  const [data, setData] = useState<TransactionHistory | null>(null);
  const [error, setError] = useState<string>();
  useEffect(() => {
    kasas
      .transactionHistory(id)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  if (error) return <div className="text-sm text-rose-300/90">{error}</div>;
  if (!data) return <Spinner />;
  if (data.versions.length === 0) return <div className="text-sm text-slate-500">No history.</div>;

  const labelLine = (prefix: string, m: Record<string, string>) =>
    Object.entries(m).map(([k, v]) => (
      <span key={prefix + k} className="mr-1 text-xs">
        <Pill tone={prefix === '+' ? 'green' : 'red'}>
          {prefix} {k}: {v}
        </Pill>
      </span>
    ));

  return (
    <div className="space-y-3">
      {[...data.versions].reverse().map((v) => (
        <div key={v.version} className="rounded-lg border border-line bg-surface-raised p-3">
          <div className="flex items-center gap-2">
            <Pill tone="blue">v{v.version}</Pill>
            <Pill tone="neutral">{v.change_kind}</Pill>
            <span className="ml-auto text-xs text-slate-500">{formatDateTime(v.occurred_at)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {labelLine('+', v.diff.labels_added)}
            {labelLine('−', v.diff.labels_removed)}
            {Object.entries(v.diff.labels_changed).map(([k, c]) => (
              <Pill key={k} tone="amber">
                {k}: {c.from} → {c.to}
              </Pill>
            ))}
            {v.diff.fields.map((f, i) => (
              <Pill key={i} tone="amber">
                {f.field}: {f.from ?? f.before ?? '∅'} → {f.to ?? f.after ?? '∅'}
              </Pill>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProvenanceView({ id }: { id: string }) {
  const [data, setData] = useState<Provenance | null>(null);
  const [error, setError] = useState<string>();
  useEffect(() => {
    kasas
      .transactionProvenance(id)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  if (error) return <div className="text-sm text-rose-300/90">{error}</div>;
  if (!data) return <Spinner />;

  const rows: [string, string][] = [
    ['Source', data.source],
    ['Source transaction ID', data.source_transaction_id || '—'],
    ['Account', data.account_id],
    ['Institution', data.institution || '—'],
    ['Imported', formatDateTime(data.imported_at)],
    ['Last seen', formatDateTime(data.last_seen)],
  ];

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <div className="text-slate-500">{k}</div>
            <div className="text-slate-300">{v}</div>
          </div>
        ))}
      </div>
      {data.transformations.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Transformations
          </div>
          <div className="space-y-1">
            {data.transformations.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Pill tone="neutral">{t.kind}</Pill>
                <span className="text-slate-400">{t.summary}</span>
                <span className="ml-auto text-slate-600">{formatDateTime(t.occurred_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Live validation of the manually-entered target id. */
type TargetState = '' | 'found' | 'checking' | 'missing';

/** Compact one-line confirmation of a resolved target: date · description · amount. */
function txnSummary(t: Transaction): string {
  return [formatDate(t.date), t.payee || t.description || t.id, t.amount]
    .filter(Boolean)
    .join(' · ');
}

function RelationshipsView({ id, txns }: { id: string; txns: Transaction[] }) {
  const [edges, setEdges] = useState<RelationshipEdge[] | null>(null);
  const [kinds, setKinds] = useState<RelationshipKind[]>([]);
  const [error, setError] = useState<string>();
  const [kind, setKind] = useState('');
  const [target, setTarget] = useState('');
  const [targetState, setTargetState] = useState<TargetState>('');
  const [targetFound, setTargetFound] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([kasas.transactionRelationships(id), kasas.relationshipKinds()])
      .then(([r, k]) => {
        setEdges(r.relationships);
        setKinds(k);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);
  useEffect(load, [load]);

  // Resolve the typed target id: instantly if it's in the loaded set, otherwise a
  // debounced backend lookup. An id we don't have loaded is only flagged "missing"
  // after the backend confirms a 404 — it may be a valid id outside the current
  // view. A transient lookup error stays silent (state "") so the backend's own
  // submit-time validation is the authority.
  useEffect(() => {
    const tid = target.trim();
    if (!tid) {
      setTargetState('');
      setTargetFound(null);
      return;
    }
    const local = txns.find((t) => t.id === tid);
    if (local) {
      setTargetState('found');
      setTargetFound(local);
      return;
    }
    setTargetState('checking');
    setTargetFound(null);
    let cancelled = false;
    const timer = setTimeout(() => {
      kasas
        .getTransaction(tid)
        .then((t) => {
          if (cancelled) return;
          if (t) {
            setTargetState('found');
            setTargetFound(t);
          } else {
            setTargetState('missing');
          }
        })
        .catch(() => {
          if (!cancelled) setTargetState('');
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [target, txns]);

  // Add is enabled once a kind is set and the target id is confirmed. A still-
  // "checking" or known-"missing" id keeps it disabled; a transient error (state
  // "") falls through to the backend's validation on submit.
  const canAdd =
    !!kind.trim() &&
    !!target.trim() &&
    targetState !== 'checking' &&
    targetState !== 'missing' &&
    !busy;

  const add = async () => {
    if (!canAdd) return;
    setBusy(true);
    setError(undefined);
    try {
      const r = await kasas.addRelationship(id, kind.trim(), target.trim());
      setEdges(r.relationships);
      setKind('');
      setTarget('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (e: RelationshipEdge) => {
    setBusy(true);
    try {
      const r = await kasas.removeRelationship(id, e.kind, e.target);
      setEdges(r.relationships);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const labelFor = (tid: string) => {
    const t = txns.find((x) => x.id === tid);
    return t ? `${t.payee || t.description || tid}` : tid;
  };

  if (error && !edges) return <div className="text-sm text-rose-300/90">{error}</div>;
  if (!edges) return <Spinner />;

  return (
    <div className="space-y-3">
      {edges.length === 0 && <div className="text-sm text-slate-500">No relationships.</div>}
      {edges.map((e, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm">
          <Pill tone="blue">{e.kind}</Pill>
          {e.direction && <Pill tone="neutral">{e.direction}</Pill>}
          <span className="truncate text-slate-300">{labelFor(e.target)}</span>
          <button className="ml-auto text-slate-500 hover:text-rose-300" disabled={busy} onClick={() => void remove(e)}>
            <RiCloseLine className="size-4" />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2 border-t border-line/60 pt-3">
        <input
          list="rel-kinds"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          placeholder="kind"
          className="w-32 rounded-lg border border-line bg-surface-raised px-2 py-1.5 text-sm text-slate-100 focus:border-blue-500/60 focus:outline-none"
        />
        <datalist id="rel-kinds">
          {kinds.map((k) => (
            <option key={k.kind} value={k.kind} />
          ))}
        </datalist>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="target transaction id"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface-raised px-2 py-1.5 font-mono text-sm text-slate-100 focus:border-blue-500/60 focus:outline-none"
        />
        <Button variant="primary" onClick={() => void add()} disabled={!canAdd}>
          Add
        </Button>
      </div>
      {target.trim() && targetState === 'found' && targetFound && (
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span>↳</span>
          <span className="truncate">{txnSummary(targetFound)}</span>
        </div>
      )}
      {target.trim() && targetState === 'checking' && (
        <div className="text-xs text-slate-400">Checking id…</div>
      )}
      {target.trim() && targetState === 'missing' && (
        <div className="flex items-center gap-1.5 text-xs text-rose-300/90">
          <span className="font-semibold">✕</span>
          <span>No transaction with id {target.trim()}</span>
        </div>
      )}
      {error && <div className="text-xs text-rose-300/90">{error}</div>}
    </div>
  );
}

export function TransactionDetail({
  open,
  onClose,
  txn,
  txns,
}: {
  open: boolean;
  onClose: () => void;
  txn: Transaction;
  txns: Transaction[];
}) {
  const [tab, setTab] = useState<Tab>('history');

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={txn.payee || txn.description || 'Transaction'}
      size="lg"
    >
      <div className="mb-3 flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              'rounded-md px-2.5 py-1 text-xs font-medium',
              tab === t.id ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'history' && <HistoryView id={txn.id} />}
      {tab === 'provenance' && <ProvenanceView id={txn.id} />}
      {tab === 'relationships' && <RelationshipsView id={txn.id} txns={txns} />}
    </Modal>
  );
}
