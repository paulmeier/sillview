/**
 * Events page — the canonical change-event stream. Loads the recent tail, then
 * appends live events from the SSE bridge. Click a row for its full JSON payload.
 */

import { useEffect, useRef, useState } from 'react';
import { kasas } from '../api/kasas';
import { useConnection } from '../store/connection';
import { PageShell } from '../shell/Page';
import { Modal } from '../components/ui/Modal';
import { Pill, Spinner } from '../components/ui';
import { formatDateTime } from '../lib/time';
import type { KasasEvent, KasasEventRow } from '../../shared/kasas-types';

interface Row {
  key: string;
  sequence?: number;
  type: string;
  entity?: string;
  at: string;
  raw: unknown;
}

function rowFromHistory(e: KasasEventRow): Row {
  return {
    key: `h${e.sequence}`,
    sequence: e.sequence,
    type: e.type,
    entity: e.entity_id ? `${e.entity_type}:${e.entity_id}` : e.entity_type,
    at: e.occurred_at,
    raw: e,
  };
}

function rowFromLive(e: KasasEvent, i: number): Row {
  const entityType = typeof e.entity_type === 'string' ? e.entity_type : undefined;
  const entityId = typeof e.entity_id === 'string' ? e.entity_id : undefined;
  return {
    key: `l${e.sequence ?? ''}-${i}`,
    sequence: e.sequence,
    type: e.type,
    entity: entityId ? `${entityType ?? ''}:${entityId}` : entityType,
    at: new Date().toISOString(),
    raw: e,
  };
}

function familyTone(type: string): 'green' | 'blue' | 'amber' | 'neutral' {
  const fam = type.split('.')[0];
  if (fam === 'transaction') return 'green';
  if (fam === 'account' || fam === 'sync') return 'blue';
  if (fam === 'label' || fam === 'rule' || fam === 'plugin') return 'amber';
  return 'neutral';
}

export function Events() {
  const version = useConnection((s) => s.version);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [detail, setDetail] = useState<Row | null>(null);
  const liveSeq = useRef(0);

  // Initial tail load (re-runs on reconnect).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    kasas
      .recentEvents(80)
      .then((res) => {
        if (cancelled) return;
        setRows([...(res.events ?? [])].reverse().map(rowFromHistory));
        setError(undefined);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [version]);

  // Live append.
  useEffect(() => {
    const unsub = window.api.events.onEvent((e) => {
      const n = liveSeq.current++;
      setRows((prev) => [rowFromLive(e, n), ...prev].slice(0, 500));
    });
    return unsub;
  }, []);

  return (
    <PageShell title="Events" subtitle="Live change-event stream">
      {loading && rows.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-3">
          {error && <div className="text-sm text-rose-300/90">{error}</div>}
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-white/[0.03] text-left text-xs text-slate-400">
                <tr className="border-b border-line">
                  <th className="px-3 py-2 font-medium">Seq</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Entity</th>
                  <th className="px-3 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-white/[0.02]"
                    onClick={() => setDetail(r)}
                  >
                    <td className="px-3 py-1.5 tabular-nums text-xs text-slate-500">{r.sequence ?? '—'}</td>
                    <td className="px-3 py-1.5">
                      <Pill tone={familyTone(r.type)}>{r.type}</Pill>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-slate-400">{r.entity ?? '—'}</td>
                    <td className="px-3 py-1.5 text-xs text-slate-500">{formatDateTime(r.at)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                      No events yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detail && (
        <Modal open={!!detail} onOpenChange={(o) => !o && setDetail(null)} title={detail.type} size="lg">
          <pre className="scroll-area max-h-[60vh] overflow-auto rounded-lg bg-black/30 p-3 font-mono text-xs text-slate-300">
            {JSON.stringify(detail.raw, null, 2)}
          </pre>
        </Modal>
      )}
    </PageShell>
  );
}
