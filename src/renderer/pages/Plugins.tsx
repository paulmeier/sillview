/**
 * Plugins page — manage installed kasas plugins (requirement #5). Lists each
 * plugin with state/hooks/capabilities/net-grants/health and supports enable
 * (with a net:fetch grant modal), disable, reload, uninstall, and an egress log.
 * Requires plugins.enabled + events.enabled (toggled in Settings → Kasas).
 */

import { useCallback, useEffect, useState } from 'react';
import { RiDeleteBinLine, RiPlugLine, RiRefreshLine } from '@remixicon/react';
import { Link } from 'react-router-dom';
import { kasas, KasasError } from '../api/kasas';
import { useFamilyKeys } from '../api/hooks';
import { PageShell } from '../shell/Page';
import { Modal } from '../components/ui/Modal';
import { Button, Pill, Spinner, Switch } from '../components/ui';
import { fromNow } from '../lib/time';
import type { EgressEntry, Plugin } from '../../shared/kasas-types';

function stateTone(state: string): 'green' | 'neutral' | 'red' | 'amber' {
  if (state === 'loaded') return 'green';
  if (state === 'error') return 'red';
  if (state === 'missing') return 'amber';
  return 'neutral';
}

function NetGrantModal({
  plugin,
  open,
  onClose,
  onConfirm,
}: {
  plugin: Plugin;
  open: boolean;
  onClose: () => void;
  onConfirm: (grants: string[]) => void;
}) {
  const [grants, setGrants] = useState<Set<string>>(new Set(plugin.net_grants ?? []));
  const toggle = (host: string) =>
    setGrants((s) => {
      const next = new Set(s);
      if (next.has(host)) next.delete(host);
      else next.add(host);
      return next;
    });

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Enable ${plugin.name}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onConfirm([...grants])}>
            Enable
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-slate-400">
          This plugin can reach the network. Grant private/LAN access only to hosts you trust —
          public hosts work without a grant.
        </p>
        <div className="space-y-1.5">
          {(plugin.net_allow ?? []).map((host) => (
            <label key={host} className="flex items-center gap-2">
              <input type="checkbox" checked={grants.has(host)} onChange={() => toggle(host)} />
              <code className="text-xs text-slate-300">{host}</code>
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function EgressModal({ plugin, open, onClose }: { plugin: Plugin; open: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState<EgressEntry[] | null>(null);
  useEffect(() => {
    kasas.pluginEgress(plugin.id).then((r) => setEntries(r.entries)).catch(() => setEntries([]));
  }, [plugin.id]);

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={`${plugin.name} — egress log`} size="lg">
      {!entries ? (
        <Spinner />
      ) : entries.length === 0 ? (
        <div className="text-sm text-slate-500">No network requests recorded.</div>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-line">
              <th className="py-1 pr-2">When</th>
              <th className="py-1 pr-2">Method</th>
              <th className="py-1 pr-2">Host</th>
              <th className="py-1 pr-2 text-right">Status</th>
              <th className="py-1 pr-2 text-right">Bytes</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} className="border-b border-line/60">
                <td className="py-1 pr-2 text-slate-500">{fromNow(e.time)}</td>
                <td className="py-1 pr-2 text-slate-300">{e.method}</td>
                <td className="py-1 pr-2 text-slate-300">{e.host}</td>
                <td className="py-1 pr-2 text-right tabular-nums text-slate-300">{e.error ? '—' : e.status}</td>
                <td className="py-1 pr-2 text-right tabular-nums text-slate-400">{e.bytes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

function PluginCard({ plugin, onChanged }: { plugin: Plugin; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [grantOpen, setGrantOpen] = useState(false);
  const [egressOpen, setEgressOpen] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onToggle = (next: boolean) => {
    if (next) {
      if ((plugin.net_allow?.length ?? 0) > 0) setGrantOpen(true);
      else void run(() => kasas.enablePlugin(plugin.id));
    } else {
      void run(() => kasas.disablePlugin(plugin.id));
    }
  };

  const uninstall = async () => {
    if (!confirm(`Uninstall ${plugin.name}? This removes it from disk.`)) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await kasas.uninstallPlugin(plugin.id);
      if (res.hook_error) setError(`Uninstalled, but the OnUninstall hook errored: ${res.hook_error}`);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <RiPlugLine className="size-4 text-slate-500" />
            <span className="font-semibold text-slate-100">{plugin.name}</span>
            <Pill tone={stateTone(plugin.state)}>{plugin.state}</Pill>
            <Pill tone="neutral">{plugin.runtime}</Pill>
            {plugin.version && <span className="text-xs text-slate-500">{plugin.version}</span>}
          </div>
          {plugin.description && <div className="mt-0.5 text-xs text-slate-500">{plugin.description}</div>}
        </div>
        <Switch checked={plugin.enabled} disabled={busy || !plugin.on_disk} onChange={onToggle} />
      </div>

      <div className="mt-3 space-y-1.5 text-xs">
        {plugin.hooks.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-slate-500">Hooks:</span>
            {plugin.hooks.map((h) => (
              <Pill key={h} tone="neutral">
                {h}
              </Pill>
            ))}
          </div>
        )}
        {plugin.capabilities.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-slate-500">Capabilities:</span>
            {plugin.capabilities.map((c) => (
              <Pill key={c} tone={plugin.granted_capabilities.includes(c) ? 'green' : 'amber'}>
                {c}
              </Pill>
            ))}
          </div>
        )}
        {(plugin.net_allow?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-slate-500">Network:</span>
            {(plugin.net_allow ?? []).map((h) => (
              <Pill key={h} tone={plugin.net_grants?.includes(h) ? 'green' : 'neutral'}>
                {h}
                {plugin.net_grants?.includes(h) ? ' ✓' : ''}
              </Pill>
            ))}
          </div>
        )}
        {plugin.last_error && <div className="text-rose-300/80">last error: {plugin.last_error}</div>}
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <Button variant="subtle" onClick={() => void run(() => kasas.reloadPlugin(plugin.id))} disabled={busy || !plugin.on_disk}>
          <RiRefreshLine className="size-4" />
          Reload
        </Button>
        <Button variant="subtle" onClick={() => setEgressOpen(true)}>
          Egress
        </Button>
        <Button variant="danger" onClick={() => void uninstall()} disabled={busy}>
          <RiDeleteBinLine className="size-4" />
          Uninstall
        </Button>
        {error && <span className="ml-1 text-xs text-rose-300/90">{error}</span>}
      </div>

      {grantOpen && (
        <NetGrantModal
          plugin={plugin}
          open={grantOpen}
          onClose={() => setGrantOpen(false)}
          onConfirm={(grants) => {
            setGrantOpen(false);
            void run(() => kasas.enablePlugin(plugin.id, grants));
          }}
        />
      )}
      {egressOpen && <EgressModal plugin={plugin} open={egressOpen} onClose={() => setEgressOpen(false)} />}
    </div>
  );
}

export function Plugins() {
  const keys = useFamilyKeys(['plugin']);
  const [enabled, setEnabled] = useState(true);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const res = await kasas.plugins();
      setEnabled(res.enabled);
      setPlugins(res.plugins ?? []);
    } catch (e) {
      setError(
        e instanceof KasasError && e.status === 403
          ? 'A dashboard token is required to manage plugins.'
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, ...keys]);

  const actions = (
    <Button variant="subtle" onClick={() => void load()}>
      <RiRefreshLine className="size-4" />
      Refresh
    </Button>
  );

  return (
    <PageShell title="Plugins" subtitle={`${plugins.length} installed`} actions={actions}>
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      ) : !enabled ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          The plugin system is disabled. Turn on <code>plugins.enabled</code> and{' '}
          <code>events.enabled</code> in Settings → Kasas, then restart kasas.
        </div>
      ) : (
        <div className="space-y-3">
          {error && <div className="text-sm text-rose-300/90">{error}</div>}
          {plugins.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No plugins installed. Browse the{' '}
              <Link to="/marketplace" className="text-blue-400 hover:underline">
                Plugin Marketplace
              </Link>{' '}
              to add one.
            </div>
          ) : (
            plugins.map((p) => <PluginCard key={p.id} plugin={p} onChanged={load} />)
          )}
        </div>
      )}
    </PageShell>
  );
}
