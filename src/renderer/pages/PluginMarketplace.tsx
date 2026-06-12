/**
 * Plugin Marketplace — browse the kasas community registry and install/update
 * plugins (requirement #5). Distinct from sillview's widget marketplace: these
 * are backend plugins. Entries are grouped by trust tier; installing registers a
 * plugin DISABLED (enable it on the Plugins page). Requires plugins.registry.enabled.
 */

import { useCallback, useEffect, useState } from 'react';
import { RiDownloadLine, RiRefreshLine, RiStore2Line } from '@remixicon/react';
import { Link } from 'react-router-dom';
import { kasas, KasasError } from '../api/kasas';
import { useFamilyKeys } from '../api/hooks';
import { PageShell } from '../shell/Page';
import { Modal } from '../components/ui/Modal';
import { Button, Pill, Spinner } from '../components/ui';
import type { RegistryPlugin } from '../../shared/kasas-types';

function tierTone(tier: string): 'green' | 'blue' | 'neutral' {
  const t = tier.toLowerCase();
  if (t === 'verified') return 'green';
  if (t === 'connected') return 'blue';
  return 'neutral';
}

function InstallModal({
  plugin,
  open,
  onClose,
  onConfirm,
  busy,
}: {
  plugin: RegistryPlugin;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Install ${plugin.name}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={busy}>
            {busy ? 'Installing…' : plugin.installed ? 'Update' : 'Install'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-slate-400">
          {plugin.description} Runs untrusted code in a sandbox. It will be installed{' '}
          <strong className="text-slate-200">disabled</strong> — review and enable it on the Plugins page.
        </p>
        {plugin.capabilities.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">Requests capabilities</div>
            <div className="flex flex-wrap gap-1">
              {plugin.capabilities.map((c) => (
                <Pill key={c} tone="amber">
                  {c}
                </Pill>
              ))}
            </div>
          </div>
        )}
        {plugin.net?.allow && plugin.net.allow.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">Network access</div>
            <div className="flex flex-wrap gap-1">
              {plugin.net.allow.map((h) => (
                <Pill key={h} tone="neutral">
                  {h}
                </Pill>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function RegistryCard({ plugin, onInstall }: { plugin: RegistryPlugin; onInstall: (p: RegistryPlugin) => void }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-100">{plugin.ui?.title || plugin.name}</span>
            <Pill tone={tierTone(plugin.tier)}>{plugin.tier}</Pill>
            <Pill tone="neutral">{plugin.runtime}</Pill>
            <span className="text-xs text-slate-500">{plugin.version}</span>
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {plugin.description}
            {plugin.author && <span className="text-slate-600"> · by {plugin.author}</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {plugin.capabilities.map((c) => (
              <Pill key={c} tone="neutral">
                {c}
              </Pill>
            ))}
          </div>
        </div>
        <div className="shrink-0">
          {plugin.installed && !plugin.update_available ? (
            <Pill tone="green">installed {plugin.installed_version}</Pill>
          ) : (
            <Button variant={plugin.update_available ? 'primary' : 'subtle'} onClick={() => onInstall(plugin)}>
              <RiDownloadLine className="size-4" />
              {plugin.update_available ? 'Update' : 'Install'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function PluginMarketplace() {
  const keys = useFamilyKeys(['plugin']);
  const [available, setAvailable] = useState(true);
  const [plugins, setPlugins] = useState<RegistryPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [installing, setInstalling] = useState<RegistryPlugin | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const res = await kasas.pluginRegistry();
      setAvailable(res.available);
      setPlugins(res.plugins ?? []);
    } catch (e) {
      setError(
        e instanceof KasasError && e.status === 403
          ? 'A dashboard token is required to use the marketplace.'
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

  const doInstall = async () => {
    if (!installing) return;
    setBusy(true);
    setError(undefined);
    try {
      await kasas.installPlugin(installing.name);
      setMsg(`Installed ${installing.name} (disabled). Enable it on the Plugins page.`);
      setInstalling(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const tiers: string[] = [];
  for (const p of plugins) if (!tiers.includes(p.tier)) tiers.push(p.tier);

  const actions = (
    <Button variant="subtle" onClick={() => void load()}>
      <RiRefreshLine className="size-4" />
      Refresh
    </Button>
  );

  return (
    <PageShell title="Plugin Marketplace" subtitle="Install community kasas plugins" actions={actions}>
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      ) : !available ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          The plugin registry is disabled or unreachable. Enable{' '}
          <code>plugins.registry.enabled</code> in Settings → Kasas.
        </div>
      ) : (
        <div className="space-y-5">
          {error && <div className="text-sm text-rose-300/90">{error}</div>}
          {msg && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {msg} <Link to="/plugins" className="underline">Go to Plugins</Link>
            </div>
          )}
          {plugins.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-slate-500">
              <RiStore2Line className="size-8" />
              <span className="text-sm">No plugins in the registry.</span>
            </div>
          )}
          {tiers.map((tier) => (
            <div key={tier}>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {tier}
              </div>
              <div className="space-y-3">
                {plugins
                  .filter((p) => p.tier === tier)
                  .map((p) => (
                    <RegistryCard key={p.name} plugin={p} onInstall={setInstalling} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {installing && (
        <InstallModal
          plugin={installing}
          open={!!installing}
          busy={busy}
          onClose={() => setInstalling(null)}
          onConfirm={() => void doInstall()}
        />
      )}
    </PageShell>
  );
}
