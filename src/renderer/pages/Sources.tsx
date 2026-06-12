/**
 * Sources page — connect and configure ingestion sources (SimpleFIN, Plaid,
 * Teller, Bitcoin, Ethereum, CSV) without the kasas web UI. Each source card
 * shows status, its editable per-source config, a credential form (paste,
 * multi-credential add/remove, or browser OAuth), and a per-source Sync Now.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  RiCloseLine,
  RiExternalLinkLine,
  RiRefreshLine,
} from '@remixicon/react';
import { kasas, KasasError } from '../api/kasas';
import { useFamilyKeys } from '../api/hooks';
import { PageShell } from '../shell/Page';
import { SettingRow } from '../components/settings/SettingRow';
import { RestartBanner } from '../components/settings/RestartBanner';
import { Button, Pill, Spinner } from '../components/ui';
import { cx } from '../lib/utils';
import { fromNow } from '../lib/time';
import type { SourceDTO, SourcesListResponse, SyncLog } from '../../shared/kasas-types';

const inputClass =
  'w-full rounded-lg border border-line bg-surface-raised px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/60 focus:outline-none';

function statusPill(s: SourceDTO) {
  if (!s.active) return <Pill tone="neutral">Inactive</Pill>;
  if (s.connected) return <Pill tone="green">Connected</Pill>;
  if (s.credentialed || s.oauth) return <Pill tone="amber">Needs credentials</Pill>;
  return <Pill tone="blue">Active</Pill>;
}

function CredentialForm({
  source,
  onChanged,
}: {
  source: SourceDTO;
  onChanged: () => Promise<void>;
}) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (!source.credentialed && !source.oauth) return null;

  const submit = async () => {
    if (!token.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      await kasas.setSourceCredential(source.type, token.trim());
      setToken('');
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await kasas.removeSourceCredential(source.type, id);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const oauth = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const { url } = await kasas.sourceOAuthStart(source.type);
      await window.api.system.openExternal(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const fieldTitle = source.credentials?.[0]?.title ?? 'Credential';
  const fieldHelp = source.credentials?.[0]?.help;

  return (
    <div className="space-y-2 border-t border-line/60 pt-3">
      {source.multi_credential && source.credential_entries && source.credential_entries.length > 0 && (
        <div className="space-y-1">
          {source.credential_entries.map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-sm text-slate-300">
              <span className="font-mono">{c.label}</span>
              {c.removable && (
                <button
                  className="text-slate-500 hover:text-rose-300"
                  disabled={busy}
                  onClick={() => void remove(c.id)}
                  title="Remove"
                >
                  <RiCloseLine className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {source.credentialed && (
        <div>
          <div className="mb-1 text-xs font-medium text-slate-400">
            {source.multi_credential ? `Add ${fieldTitle.toLowerCase()}` : fieldTitle}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              type="password"
              placeholder="Paste credential…"
              className={inputClass}
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
            />
            <Button variant="primary" onClick={() => void submit()} disabled={busy || !token.trim()}>
              {source.multi_credential ? 'Add' : 'Connect'}
            </Button>
          </div>
          {fieldHelp && <div className="mt-1 text-xs text-slate-500">{fieldHelp}</div>}
        </div>
      )}

      {source.oauth && (
        <Button variant="subtle" onClick={() => void oauth()} disabled={busy}>
          <RiExternalLinkLine className="size-4" />
          Connect with browser
        </Button>
      )}

      {error && <div className="text-xs text-rose-300/90">{error}</div>}
    </div>
  );
}

function SourceCard({
  source,
  onSaveSetting,
  onResetSetting,
  onChanged,
}: {
  source: SourceDTO;
  onSaveSetting: (key: string, value: string) => Promise<void>;
  onResetSetting: (key: string) => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string>();

  const syncNow = async () => {
    setSyncing(true);
    setMsg(undefined);
    try {
      await kasas.syncSource(source.type);
      setMsg('Sync started');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-100">{source.title}</span>
            {statusPill(source)}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {source.type} · {source.archetype}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-slate-500">{msg}</span>}
          <Button variant="subtle" onClick={() => void syncNow()} disabled={syncing || !source.active}>
            <RiRefreshLine className={cx('size-4', syncing && 'animate-spin')} />
            Sync now
          </Button>
        </div>
      </div>

      {source.config && source.config.length > 0 && (
        <div className="mt-3 divide-y divide-line/60 border-t border-line/60">
          {source.config.map((s) => (
            <SettingRow
              key={s.key}
              setting={s}
              onSave={(value) => onSaveSetting(s.key, value)}
              onReset={() => onResetSetting(s.key)}
            />
          ))}
        </div>
      )}

      <CredentialForm source={source} onChanged={onChanged} />
    </div>
  );
}

export function Sources() {
  const keys = useFamilyKeys(['sync', 'source', 'account']);
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

  const onSaveSetting = async (key: string, value: string) => {
    const res = await kasas.setSetting(key, value);
    setList((prev) =>
      prev
        ? {
            ...prev,
            restart_required: res.restart_required,
            sources: prev.sources.map((s) => ({
              ...s,
              config: s.config?.map((c) => (c.key === key ? res.setting : c)),
            })),
          }
        : prev,
    );
  };

  const onResetSetting = async (key: string) => {
    const res = await kasas.resetSetting(key);
    setList((prev) =>
      prev
        ? {
            ...prev,
            restart_required: res.restart_required,
            sources: prev.sources.map((s) => ({
              ...s,
              config: s.config?.map((c) => (c.key === key ? res.setting : c)),
            })),
          }
        : prev,
    );
  };

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
    <PageShell title="Sources" subtitle="Connect and configure where transactions come from" actions={actions}>
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
        <div className="mx-auto max-w-3xl space-y-4">
          <RestartBanner show={!!list?.restart_required} onRestarted={load} />

          {(list?.sources ?? []).map((s) => (
            <SourceCard
              key={s.type}
              source={s}
              onSaveSetting={onSaveSetting}
              onResetSetting={onResetSetting}
              onChanged={load}
            />
          ))}

          {history.length > 0 && (
            <div className="rounded-xl border border-line bg-surface p-4">
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
                    <span className="shrink-0 text-xs text-slate-500">
                      {fromNow(new Date(run.started_at))}
                    </span>
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
