/**
 * Data-driven editor over GET /api/v1/settings. Every editable app setting is
 * self-describing (key/kind/section/enum/restart_required), so this renders the
 * right control per kind with zero per-key code — covering sync, logging,
 * events, webhooks, plugins, MCP, dashboard, and updates, plus any future keys.
 *
 * Writes go straight to the API (PUT/DELETE); the config-file path only seeds
 * first-boot defaults, so the API is the runtime source of truth.
 */

import { useCallback, useEffect, useState } from 'react';
import { kasas, KasasError } from '../../api/kasas';
import { useConnection } from '../../store/connection';
import { Spinner } from '../ui';
import { SettingRow } from './SettingRow';
import { RestartBanner } from './RestartBanner';
import type { SettingStatus, SettingsListResponse } from '../../../shared/kasas-types';

export function KasasSettingsEditor() {
  const version = useConnection((s) => s.version);

  const [list, setList] = useState<SettingsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setList(await kasas.settings());
    } catch (e) {
      setError(
        e instanceof KasasError && e.status === 403
          ? 'A dashboard token is required to edit kasas settings.'
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, version]);

  const applyResult = (key: string, res: { setting: SettingStatus; restart_required: boolean }) =>
    setList((prev) =>
      prev
        ? {
            ...prev,
            restart_required: res.restart_required,
            settings: prev.settings.map((s) => (s.key === key ? res.setting : s)),
          }
        : prev,
    );

  const onSave = async (key: string, value: string) => applyResult(key, await kasas.setSetting(key, value));
  const onReset = async (key: string) => applyResult(key, await kasas.resetSetting(key));

  if (loading && !list) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-line bg-surface-raised p-4 text-sm text-rose-300/90">
        {error}
        <button className="ml-2 text-slate-400 underline hover:text-slate-200" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  if (list && !list.enabled) {
    return (
      <div className="rounded-lg border border-line bg-surface-raised p-4 text-sm text-slate-400">
        Runtime settings management is unavailable on this kasas instance.
      </div>
    );
  }

  // App settings only (per-source settings are configured on the Sources page).
  const appSettings = (list?.settings ?? []).filter((s) => !s.source);
  const sections: string[] = [];
  for (const s of appSettings) {
    const sec = s.section || 'Other';
    if (!sections.includes(sec)) sections.push(sec);
  }

  return (
    <div className="space-y-5">
      <RestartBanner show={!!list?.restart_required} onRestarted={load} />

      {sections.map((section) => (
        <div key={section}>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {section}
          </div>
          <div className="divide-y divide-line/60 rounded-lg border border-line bg-surface-raised px-3">
            {appSettings
              .filter((s) => (s.section || 'Other') === section)
              .map((s) => (
                <SettingRow
                  key={s.key}
                  setting={s}
                  onSave={(value) => onSave(s.key, value)}
                  onReset={() => onReset(s.key)}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
