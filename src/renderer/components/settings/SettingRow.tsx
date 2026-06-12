/**
 * One editable kasas setting, rendered by `kind`. Shared by the app-settings
 * editor and the per-source config sections on the Sources page — both write
 * through the same /api/v1/settings endpoints.
 */

import { useEffect, useState } from 'react';
import { Button, Pill, Switch } from '../ui';
import { cx } from '../../lib/utils';
import type { SettingStatus } from '../../../shared/kasas-types';

const inputClass =
  'w-full rounded-lg border border-line bg-surface-raised px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/60 focus:outline-none';

/** sillview owns kasas-binary updates, so these stay locked off (see updater.ts). */
export const LOCKED_KEYS = new Set(['update.check', 'update.allow_apply']);

export function SettingRow({
  setting,
  onSave,
  onReset,
}: {
  setting: SettingStatus;
  onSave: (value: string) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(setting.value);
  const [busy, setBusy] = useState(false);
  const locked = LOCKED_KEYS.has(setting.key);

  // Re-sync the draft when the upstream value changes (after save/reset/refetch).
  useEffect(() => setDraft(setting.value), [setting.value]);

  const commit = async (value: string) => {
    setBusy(true);
    try {
      await onSave(value);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await onReset();
    } finally {
      setBusy(false);
    }
  };

  const dirty = draft !== setting.value;
  const placeholder = setting.secret && setting.set ? '•••••••• (set)' : undefined;

  let control: React.ReactNode;
  if (setting.kind === 'bool') {
    control = (
      <Switch
        checked={setting.value === 'true'}
        disabled={busy || locked}
        onChange={(v) => void commit(String(v))}
      />
    );
  } else if (setting.enum && setting.enum.length > 0) {
    control = (
      <select
        value={setting.value}
        disabled={busy || locked}
        onChange={(e) => void commit(e.target.value)}
        className={cx(inputClass, 'w-44')}
      >
        {setting.enum.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  } else if (setting.kind === 'json') {
    control = (
      <div className="flex flex-col items-end gap-1">
        <textarea
          value={draft}
          disabled={busy || locked}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          className={cx(inputClass, 'h-24 w-72 font-mono text-xs')}
        />
        {dirty && (
          <Button variant="primary" onClick={() => void commit(draft)} disabled={busy}>
            Save
          </Button>
        )}
      </div>
    );
  } else {
    control = (
      <div className="flex items-center gap-1.5">
        <input
          type={setting.kind === 'int' ? 'number' : setting.secret ? 'password' : 'text'}
          value={draft}
          placeholder={placeholder}
          disabled={busy || locked}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && dirty) void commit(draft);
          }}
          className={cx(inputClass, 'w-44')}
        />
        {dirty && (
          <Button variant="primary" onClick={() => void commit(draft)} disabled={busy}>
            Save
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm text-slate-200">
          {setting.title}
          {setting.overridden && !locked && <Pill tone="blue">overridden</Pill>}
          {setting.restart_required && <Pill tone="amber">restart</Pill>}
        </div>
        {setting.help && <div className="mt-0.5 text-xs text-slate-500">{setting.help}</div>}
        {locked && <div className="mt-0.5 text-xs text-slate-500">Managed by sillview.</div>}
        {setting.overridden && !locked && (
          <button
            className="mt-1 text-xs text-slate-500 hover:text-slate-300"
            disabled={busy}
            onClick={() => void reset()}
          >
            Reset to default
          </button>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
