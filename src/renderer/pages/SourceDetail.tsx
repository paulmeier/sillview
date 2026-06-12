/**
 * Per-source detail page (/sources/:type) — everything needed to configure one
 * ingestion source: its editable settings, the credential/OAuth form, a Sync now,
 * and (for the market source) its series manager. Reached by clicking a row on the
 * Sources list; registered in AppShell like the plugin /ext/:name route, so it is
 * routable without appearing in the sidebar.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RiArrowLeftLine, RiRefreshLine } from '@remixicon/react';
import { kasas, KasasError } from '../api/kasas';
import { useFamilyKeys } from '../api/hooks';
import { PageShell } from '../shell/Page';
import { SettingRow } from '../components/settings/SettingRow';
import { RestartBanner } from '../components/settings/RestartBanner';
import { CredentialForm } from '../components/sources/CredentialForm';
import { MarketSeries } from '../components/sources/MarketSeries';
import { sourceMeta, sourceStatusPill } from '../components/sources/meta';
import { Button, Spinner } from '../components/ui';
import { cx } from '../lib/utils';
import type { SetSettingResponse, SourcesListResponse } from '../../shared/kasas-types';

export function SourceDetail() {
  const { type = '' } = useParams();
  const navigate = useNavigate();
  const keys = useFamilyKeys(['sync', 'source', 'account']);
  const [list, setList] = useState<SourcesListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setList(await kasas.sources());
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

  const source = useMemo(() => list?.sources.find((s) => s.type === type), [list, type]);

  const patchSetting = (key: string, res: SetSettingResponse) =>
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

  const onSaveSetting = async (key: string, value: string) => patchSetting(key, await kasas.setSetting(key, value));
  const onResetSetting = async (key: string) => patchSetting(key, await kasas.resetSetting(key));

  const syncNow = async () => {
    if (!source) return;
    setSyncing(true);
    setSyncMsg(undefined);
    try {
      await kasas.syncSource(source.type);
      setSyncMsg('Sync started');
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  };

  const { icon: Icon } = sourceMeta(type);

  const titleNode = (
    <span className="flex items-center gap-2">
      <Link to="/sources" className="app-no-drag text-slate-500 hover:text-slate-200" title="Back to sources">
        <RiArrowLeftLine className="size-4" />
      </Link>
      <span className="flex size-6 items-center justify-center rounded-md bg-white/5 text-slate-300">
        <Icon className="size-4" />
      </span>
      <span className="truncate">{source?.title ?? type}</span>
      {source && sourceStatusPill(source)}
    </span>
  );

  const actions = source ? (
    <>
      {syncMsg && <span className="text-xs text-slate-500">{syncMsg}</span>}
      <Button variant="subtle" onClick={() => void syncNow()} disabled={syncing || !source.active}>
        <RiRefreshLine className={cx('size-4', syncing && 'animate-spin')} />
        Sync now
      </Button>
    </>
  ) : undefined;

  return (
    <PageShell
      title={titleNode}
      subtitle={source ? `${source.type} · ${source.archetype}` : undefined}
      actions={actions}
    >
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
      ) : !source ? (
        <div className="rounded-lg border border-line bg-surface-raised p-4 text-sm text-slate-400">
          Unknown source “{type}”.{' '}
          <button className="underline hover:text-slate-200" onClick={() => navigate('/sources')}>
            Back to sources
          </button>
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-4">
          <RestartBanner show={!!list?.restart_required} onRestarted={load} />

          {source.config && source.config.length > 0 && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="divide-y divide-line/60">
                {source.config.map((s) => (
                  <SettingRow
                    key={s.key}
                    setting={s}
                    onSave={(value) => onSaveSetting(s.key, value)}
                    onReset={() => onResetSetting(s.key)}
                  />
                ))}
              </div>
            </div>
          )}

          {(source.credentialed || source.oauth) && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <CredentialForm source={source} onChanged={load} />
            </div>
          )}

          {source.type === 'market' && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <MarketSeries />
            </div>
          )}

          {source.egress && source.egress.length > 0 && (
            <div className="text-xs text-slate-500">Contacts {source.egress.join(', ')}</div>
          )}
        </div>
      )}
    </PageShell>
  );
}
