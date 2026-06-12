/**
 * Read-only view of kasas's effective bootstrap configuration (GET /api/v1/config):
 * the file/env-managed keys that load before the database and can't be changed at
 * runtime (server, database, secret store, vault). Secrets are redacted server-side.
 */

import { useCallback, useEffect, useState } from 'react';
import { kasas, KasasError } from '../../api/kasas';
import { useConnection } from '../../store/connection';
import { Spinner } from '../ui';
import type { ConfigDTO } from '../../../shared/kasas-types';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <div className="text-slate-500">{label}</div>
      <div className="truncate text-slate-300" title={value}>
        {value || '—'}
      </div>
    </>
  );
}

export function BootstrapConfig() {
  const version = useConnection((s) => s.version);
  const [cfg, setCfg] = useState<ConfigDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setCfg(await kasas.config());
    } catch (e) {
      setError(e instanceof KasasError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, version]);

  if (loading && !cfg) {
    return (
      <div className="flex h-24 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (error || !cfg) {
    return <div className="text-sm text-rose-300/90">{error ?? 'Configuration unavailable.'}</div>;
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-slate-500">
        These keys load before the database and are managed in <code>config.toml</code> /
        environment — change them on the Backend tab (bundled) or your kasas config.
      </p>
      <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 rounded-lg border border-line bg-surface-raised p-4">
        <Field label="Server address" value={cfg.server.addr} />
        <Field label="Database driver" value={cfg.database.driver} />
        <Field label="Database path" value={cfg.database.path} />
        {cfg.database.dsn && <Field label="Database DSN" value={cfg.database.dsn} />}
        <Field label="Secret store" value={cfg.secrets.file} />
        <Field label="Vault" value={cfg.vault.enabled ? cfg.vault.address || 'enabled' : 'disabled'} />
        <Field label="MCP server" value={cfg.mcp.enabled ? 'enabled' : 'disabled'} />
        <Field label="Web dashboard" value={cfg.dashboard.enabled ? 'enabled' : 'disabled'} />
        <Field label="SimpleFIN" value={cfg.simplefin.connected ? 'connected' : 'not connected'} />
        <Field label="Auth required" value={cfg.security.auth_required ? 'yes' : 'no'} />
        <Field label="Token source" value={cfg.security.token_source} />
      </div>
    </div>
  );
}
