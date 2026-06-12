/**
 * Labels page — the global label vocabulary (key:value pairs) with the number of
 * transactions carrying each, and a per-label delete that strips it everywhere.
 */

import { useCallback, useEffect, useState } from 'react';
import { RiDeleteBinLine, RiPriceTag3Line } from '@remixicon/react';
import { kasas } from '../api/kasas';
import { useFamilyKeys } from '../api/hooks';
import { PageShell } from '../shell/Page';
import { IconButton, Pill, Spinner } from '../components/ui';
import type { Label } from '../../shared/kasas-types';

export function Labels() {
  const keys = useFamilyKeys(['label', 'transaction']);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setLabels(await kasas.labels());
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

  const remove = async (l: Label) => {
    if (!confirm(`Remove label "${l.key}: ${l.value}" from all ${l.transaction_count} transactions?`)) return;
    const prev = labels;
    setLabels((list) => list.filter((x) => !(x.key === l.key && x.value === l.value)));
    try {
      await kasas.deleteLabel(l.key, l.value);
    } catch (e) {
      setLabels(prev);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <PageShell title="Labels" subtitle={`${labels.length} labels`}>
      {loading ? (
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
                  <th className="px-3 py-2 font-medium">Label</th>
                  <th className="px-3 py-2 text-right font-medium">Transactions</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {labels.map((l) => (
                  <tr key={`${l.key}:${l.value}`} className="border-b border-line/60 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <RiPriceTag3Line className="size-4 text-slate-500" />
                        <Pill tone="neutral">
                          {l.key}: {l.value}
                        </Pill>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-300">{l.transaction_count}</td>
                    <td className="px-2 py-2 text-right">
                      <IconButton aria-label="Delete label" onClick={() => void remove(l)}>
                        <RiDeleteBinLine className="size-4" />
                      </IconButton>
                    </td>
                  </tr>
                ))}
                {labels.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-sm text-slate-500">
                      No labels yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageShell>
  );
}
