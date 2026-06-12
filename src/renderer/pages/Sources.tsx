/**
 * Sources page — a compact list of every ingestion source (banks, on-chain
 * wallets, CSV, market data) with its icon and status. Each row opens a detail
 * page (/sources/:type) that holds the source's settings, credentials, and sync.
 * Sources come descriptor-driven from kasas; the icon/blurb come from sourceMeta.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiArrowRightSLine, RiRefreshLine } from '@remixicon/react';
import { kasas, KasasError } from '../api/kasas';
import { useFamilyKeys } from '../api/hooks';
import { PageShell } from '../shell/Page';
import { RestartBanner } from '../components/settings/RestartBanner';
import { sourceMeta, sourceStatusPill } from '../components/sources/meta';
import { Button, Pill, Spinner } from '../components/ui';
import { cx } from '../lib/utils';
import { fromNow } from '../lib/time';
import type { SourceDTO, SourcesListResponse, SyncLog } from '../../shared/kasas-types';

function SourceRow({ source, onOpen }: { source: SourceDTO; onOpen: () => void }) {
  const { icon: Icon, blurb } = sourceMeta(source.type);
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-white/15 hover:bg-surface-raised"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-300">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-100">{source.title}</span>
        <span className="block truncate text-xs text-slate-500">{blurb || source.archetype}</span>
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-2">
        {sourceStatusPill(source)}
        <RiArrowRightSLine className="size-5 text-slate-600" />
      </span>
    </button>
  );
}

export function Sources() {
  const keys = useFamilyKeys(['sync', 'source', 'account']);
  const navigate = useNavigate();
  const [list, setList] = useState<SourcesListResponse | null>(null);
  const [history, setHistory] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [syncingAll, setSyncingAll] = useState(false);

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const [sources, hist] = await Promise.all([kasas.sources(), kasas.syncHistory(10)]);
      setList(sources);
      setHistory(hist);
    } catch (e) {
      setError(
        e instanceof KasasError && e.status === 403
          ? 'A dashboard token is required to manage sources.'
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, ...keys]);

  const onSyncAll = async () => {
    setSyncingAll(true);
    try {
      await kasas.triggerSync();
    } finally {
      setSyncingAll(false);
    }
  };

  const actions = (
    <Button variant="primary" onClick={() => void onSyncAll()} disabled={syncingAll}>
      <RiRefreshLine className={cx('size-4', syncingAll && 'animate-spin')} />
      {syncingAll ? 'Syncing…' : 'Sync all'}
    </Button>
  );

  return (
    <PageShell title="Sources" subtitle="Connect and configure where your data comes from" actions={actions}>
      {loading && !list ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-line bg-surface-raised p-4 text-sm text-rose-300/90">
          {error}
          <button className="ml-2 underline hover:text-slate-200" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : list && !list.enabled ? (
        <div className="rounded-lg border border-line bg-surface-raised p-4 text-sm text-slate-400">
          Source management is unavailable on this kasas instance.
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-2">
          <RestartBanner show={!!list?.restart_required} onRestarted={load} />

          {(list?.sources ?? []).map((s) => (
            <SourceRow key={s.type} source={s} onOpen={() => navigate(`/sources/${s.type}`)} />
          ))}

          {history.length > 0 && (
            <div className="mt-6 rounded-xl border border-line bg-surface p-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Recent syncs
              </div>
              <div className="divide-y divide-line/60 text-sm">
                {history.map((run) => (
                  <div key={run.id} className="flex items-center justify-between gap-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <Pill
                        tone={
                          run.status === 'completed' || run.status === 'success'
                            ? 'green'
                            : run.status === 'error' || run.status === 'failed'
                              ? 'red'
                              : 'amber'
                        }
                      >
                        {run.status}
                      </Pill>
                      {run.error && <span className="truncate text-xs text-rose-300/80">{run.error}</span>}
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">{fromNow(new Date(run.started_at))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
