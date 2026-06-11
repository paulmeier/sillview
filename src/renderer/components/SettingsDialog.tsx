import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { RiCloseLine } from '@remixicon/react';
import { useConnection } from '../store/connection';
import { Button, IconButton, Pill } from './ui';
import type { AuthStatus } from '../../shared/kasas-types';

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const config = useConnection((s) => s.config);
  const save = useConnection((s) => s.save);

  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [token, setToken] = useState(config.token);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (open) {
      setBaseUrl(config.baseUrl);
      setToken(config.token);
      setResult(null);
    }
  }, [open, config]);

  const test = async () => {
    setTesting(true);
    setResult(null);
    const res = await window.api.connection.test({ baseUrl: baseUrl.trim(), token: token.trim() });
    if (res.ok) {
      const auth = res.data as AuthStatus | undefined;
      const msg = auth?.auth_required
        ? auth.authenticated
          ? 'Connected & authenticated'
          : 'Reachable — token required'
        : 'Connected';
      setResult({ ok: true, msg });
    } else {
      setResult({ ok: false, msg: res.error ?? 'Connection failed' });
    }
    setTesting(false);
  };

  const onSave = async () => {
    setSaving(true);
    await save({ baseUrl: baseUrl.trim(), token: token.trim() });
    setSaving(false);
    onOpenChange(false);
  };

  const inputClass =
    'w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/60 focus:outline-none';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6 shadow-2xl focus:outline-none"
        >
          <div className="mb-4 flex items-start justify-between">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-100">
                Connection
              </Dialog.Title>
              <p className="text-xs text-slate-500">Point sillview at your kasas backend</p>
            </div>
            <Dialog.Close asChild>
              <IconButton aria-label="Close">
                <RiCloseLine className="size-5" />
              </IconButton>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">Base URL</span>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:8080"
                className={inputClass}
                spellCheck={false}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">
                API token <span className="text-slate-600">(optional in dev)</span>
              </span>
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                type="password"
                placeholder="kasas_…"
                className={inputClass}
                spellCheck={false}
              />
            </label>
            {result && <Pill tone={result.ok ? 'green' : 'red'}>{result.msg}</Pill>}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={test} disabled={testing}>
              {testing ? 'Testing…' : 'Test'}
            </Button>
            <Button variant="primary" onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
