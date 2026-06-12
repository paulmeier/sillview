/**
 * Security panel in the Kasas settings section: dashboard-token management and
 * API keys. Token rotation/revoke is offered only in EXTERNAL mode — in bundled
 * mode sillview owns the loopback token, and rotating it via the API would lock
 * the broker out, so it's shown as managed. API keys are safe in both modes.
 */

import { useCallback, useEffect, useState } from 'react';
import { RiDeleteBinLine } from '@remixicon/react';
import { kasas, KasasError } from '../../api/kasas';
import { useBackend } from '../../store/backend';
import { useConnection } from '../../store/connection';
import { Button, IconButton, Pill, Spinner } from '../ui';
import { cx } from '../../lib/utils';
import { fromNow } from '../../lib/time';
import type { ApiKey, ConfigDTO } from '../../../shared/kasas-types';

const inputClass =
  'w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/60 focus:outline-none';

function SecretBox({ label, value, onDismiss }: { label: string; value: string; onDismiss: () => void }) {
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
      <div className="mb-1 font-medium text-emerald-200">{label} (shown once)</div>
      <code className="block break-all rounded bg-black/30 px-2 py-1 font-mono text-xs text-emerald-100">{value}</code>
      <button className="mt-2 text-xs text-emerald-300/80 hover:text-emerald-100" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}

export function Security() {
  const version = useConnection((s) => s.version);
  const mode = useBackend((s) => s.settings?.mode ?? 'bundled');

  const [cfg, setCfg] = useState<ConfigDTO | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const [customToken, setCustomToken] = useState('');
  const [revealToken, setRevealToken] = useState<string>();
  const [revealKey, setRevealKey] = useState<string>();
  const [keyName, setKeyName] = useState('');
  const [keyScope, setKeyScope] = useState('read');

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const [c, k] = await Promise.all([kasas.config(), kasas.apiKeys()]);
      setCfg(c);
      setApiKeys(k);
    } catch (e) {
      setError(
        e instanceof KasasError && e.status === 403
          ? 'A dashboard token is required to manage security.'
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

  const generate = async () => {
    try {
      const res = await kasas.setToken('');
      if (res.token) setRevealToken(res.token);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const setCustom = async () => {
    try {
      const res = await kasas.setToken(customToken.trim());
      setCustomToken('');
      if (res.token) setRevealToken(res.token);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const revoke = async () => {
    if (!confirm('Revoke the dashboard token? This disables authentication entirely.')) return;
    try {
      await kasas.clearToken();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const createKey = async () => {
    try {
      const k = await kasas.createApiKey({ name: keyName.trim(), scope: keyScope });
      if (k.key) setRevealKey(k.key);
      setKeyName('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const revokeKey = async (id: number) => {
    if (!confirm('Revoke this API key?')) return;
    try {
      await kasas.revokeApiKey(id);
      setApiKeys((list) => list.filter((k) => k.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading && !cfg) {
    return (
      <div className="flex h-24 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (error && !cfg) return <div className="text-sm text-rose-300/90">{error}</div>;

  return (
    <div className="space-y-6">
      {error && <div className="text-sm text-rose-300/90">{error}</div>}

      {/* Dashboard token */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Dashboard token
        </div>
        <div className="space-y-3 rounded-lg border border-line bg-surface-raised p-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Status:</span>
            {cfg?.security.auth_required ? (
              <Pill tone="green">protected ({cfg.security.token_source})</Pill>
            ) : (
              <Pill tone="amber">no token (unsecured)</Pill>
            )}
          </div>

          {mode === 'bundled' ? (
            <p className="text-xs text-slate-500">
              Managed by sillview — the bundled instance runs on loopback with a token sillview mints.
              Rotate it from the Backend tab if needed.
            </p>
          ) : cfg?.security.token_source === 'config' ? (
            <p className="text-xs text-slate-500">
              The token is set in this instance's config file / environment, so it can't be changed here.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Button variant="subtle" onClick={() => void generate()}>
                  Generate random
                </Button>
                {cfg?.security.auth_required && (
                  <Button variant="danger" onClick={() => void revoke()}>
                    Revoke (disable auth)
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={customToken}
                  onChange={(e) => setCustomToken(e.target.value)}
                  placeholder="Set a custom token (min 16 chars)"
                  className={inputClass}
                  type="password"
                  spellCheck={false}
                />
                <Button variant="primary" onClick={() => void setCustom()} disabled={customToken.trim().length < 16}>
                  Set
                </Button>
              </div>
              {revealToken && (
                <SecretBox label="Dashboard token" value={revealToken} onDismiss={() => setRevealToken(undefined)} />
              )}
            </>
          )}
        </div>
      </div>

      {/* API keys */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">API keys</div>
        <div className="space-y-3 rounded-lg border border-line bg-surface-raised p-4">
          {revealKey && <SecretBox label="API key" value={revealKey} onDismiss={() => setRevealKey(undefined)} />}

          <div className="flex items-center gap-2">
            <input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="Key name"
              className={inputClass}
            />
            <select
              value={keyScope}
              onChange={(e) => setKeyScope(e.target.value)}
              className={cx(inputClass, 'w-40')}
            >
              <option value="read">read</option>
              <option value="read_write">read_write</option>
            </select>
            <Button variant="primary" onClick={() => void createKey()}>
              Create
            </Button>
          </div>

          {apiKeys.length === 0 ? (
            <div className="text-xs text-slate-500">No API keys.</div>
          ) : (
            <div className="divide-y divide-line/60 text-sm">
              {apiKeys.map((k) => (
                <div key={k.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200">{k.name || '(unnamed)'}</span>
                      <Pill tone="neutral">{k.scope}</Pill>
                      <code className="text-xs text-slate-500">{k.prefix}…</code>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {k.last_used_at ? `last used ${fromNow(k.last_used_at)}` : 'never used'}
                    </div>
                  </div>
                  <IconButton aria-label="Revoke" onClick={() => void revokeKey(k.id)}>
                    <RiDeleteBinLine className="size-4" />
                  </IconButton>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
