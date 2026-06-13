import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { RiCloseLine, RiDownloadLine, RiFolderOpenLine } from '@remixicon/react';
import { useConnection } from '../store/connection';
import { useBackend } from '../store/backend';
import { Button, IconButton, Pill, Spinner, StatusDot, Switch } from './ui';
import { cx } from '../lib/utils';
import { fromNow } from '../lib/time';
import { KasasSettingsEditor } from './settings/KasasSettingsEditor';
import { BootstrapConfig } from './settings/BootstrapConfig';
import { Security } from './settings/Security';
import { ExternalUpdateStatus } from './settings/ExternalUpdateStatus';
import type { KasasProcessState, KasasSettings } from '../../shared/ipc';

type Tab = 'backend' | 'kasas' | 'background' | 'status';
type KasasSubTab = 'settings' | 'security' | 'bootstrap';

const TABS: { id: Tab; label: string }[] = [
  { id: 'backend', label: 'Backend' },
  { id: 'kasas', label: 'Kasas' },
  { id: 'background', label: 'Background' },
  { id: 'status', label: 'Status' },
];

const KASAS_SUBTABS: { id: KasasSubTab; label: string }[] = [
  { id: 'settings', label: 'Settings' },
  { id: 'security', label: 'Security' },
  { id: 'bootstrap', label: 'Bootstrap' },
];

const inputClass =
  'w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/60 focus:outline-none';

const stateTone: Record<KasasProcessState, 'green' | 'amber' | 'red' | 'neutral' | 'blue'> = {
  running: 'green',
  daemon: 'green',
  starting: 'amber',
  stopped: 'neutral',
  crashed: 'red',
  external: 'blue',
};

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-sm text-slate-200">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const settings = useBackend((s) => s.settings);
  const status = useBackend((s) => s.status);
  const logs = useBackend((s) => s.logs);
  const saveSettings = useBackend((s) => s.saveSettings);
  const startBackend = useBackend((s) => s.start);
  const stopBackend = useBackend((s) => s.stop);
  const restartBackend = useBackend((s) => s.restart);
  const setBackground = useBackend((s) => s.setBackground);
  const revealData = useBackend((s) => s.revealData);
  const updateInfo = useBackend((s) => s.updateInfo);
  const checking = useBackend((s) => s.checking);
  const updating = useBackend((s) => s.updating);
  const checkUpdate = useBackend((s) => s.checkUpdate);
  const applyUpdate = useBackend((s) => s.applyUpdate);

  const connConfig = useConnection((s) => s.config);

  const [tab, setTab] = useState<Tab>('backend');
  const [kasasTab, setKasasTab] = useState<KasasSubTab>('settings');

  // The background daemon is macOS-only; hide its tab on other platforms.
  const daemonSupported = status?.daemonSupported ?? true;
  const visibleTabs = daemonSupported
    ? TABS
    : TABS.filter((t) => t.id !== 'background');
  const [draft, setDraft] = useState<KasasSettings | null>(settings);
  const [extUrl, setExtUrl] = useState(connConfig.baseUrl);
  const [extToken, setExtToken] = useState(connConfig.token);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [applyMsg, setApplyMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(settings);
      setExtUrl(connConfig.baseUrl);
      setExtToken(connConfig.token);
      setTestResult(null);
    }
  }, [open, settings, connConfig]);

  useEffect(() => {
    if (tab === 'status') logEndRef.current?.scrollIntoView();
  }, [logs, tab]);

  const patch = (p: Partial<KasasSettings>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const onSave = async () => {
    if (!draft) return;
    setSaving(true);
    if (draft.mode === 'external') {
      await useConnection.getState().save({ baseUrl: extUrl.trim(), token: extToken.trim() });
    }
    // background is toggled separately (it has install/remove side effects)
    await saveSettings({ ...draft, background: status?.background ?? draft.background });
    setSaving(false);
    onOpenChange(false);
  };

  const onTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await window.api.connection.test({
      baseUrl: extUrl.trim(),
      token: extToken.trim(),
    });
    setTestResult(res.ok ? { ok: true, msg: 'Reachable' } : { ok: false, msg: res.error ?? 'Failed' });
    setTesting(false);
  };

  const onUpdateNow = async () => {
    setApplyMsg(null);
    const res = await applyUpdate();
    setApplyMsg({ ok: res.ok, msg: res.message });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 flex h-[min(640px,90vh)] w-[min(660px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line bg-surface shadow-2xl focus:outline-none"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div className="flex items-center gap-3">
              <Dialog.Title className="text-base font-semibold text-slate-100">Settings</Dialog.Title>
              {status && (
                <Pill tone={stateTone[status.state]}>
                  <StatusDot tone={stateTone[status.state]} pulse={status.state === 'starting'} />
                  {status.state}
                </Pill>
              )}
            </div>
            <Dialog.Close asChild>
              <IconButton aria-label="Close">
                <RiCloseLine className="size-5" />
              </IconButton>
            </Dialog.Close>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 border-b border-line px-4 pt-2">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cx(
                  'rounded-t-md px-3 py-2 text-sm font-medium transition-colors',
                  tab === t.id
                    ? 'border-b-2 border-blue-500 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="scroll-area flex-1 px-5 py-4">
            {!draft ? (
              <div className="flex h-full items-center justify-center">
                <Spinner />
              </div>
            ) : tab === 'backend' ? (
              <div className="divide-y divide-line/60">
                <Row label="Backend" hint="Run the bundled kasas, or connect to your own.">
                  <div className="flex overflow-hidden rounded-lg border border-line">
                    {(['bundled', 'external'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => patch({ mode: m })}
                        className={cx(
                          'px-3 py-1.5 text-sm',
                          draft.mode === m
                            ? 'bg-blue-600 text-white'
                            : 'bg-surface-raised text-slate-300 hover:bg-white/5',
                        )}
                      >
                        {m === 'bundled' ? 'Bundled' : 'External'}
                      </button>
                    ))}
                  </div>
                </Row>

                {draft.mode === 'bundled' ? (
                  <>
                    {status && !status.binaryPresent && (
                      <div className="py-2 text-xs text-rose-300/90">
                        kasas binary not bundled — run <code>npm run sync:kasas</code> and restart.
                      </div>
                    )}
                    <Row label="Port" hint="Loopback port for the managed instance.">
                      <input
                        type="number"
                        value={draft.port}
                        onChange={(e) => patch({ port: Number(e.target.value) || draft.port })}
                        className={cx(inputClass, 'w-28')}
                      />
                    </Row>
                    <Row label="Data directory" hint={status?.dataDir}>
                      <Button variant="subtle" onClick={() => void revealData()}>
                        <RiFolderOpenLine className="size-4" />
                        Reveal
                      </Button>
                    </Row>
                    <div className="py-2.5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm text-slate-200">Updates</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {updateInfo ? updateInfo.message : 'Checking for updates…'}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {updateInfo?.available && (
                            <Button
                              variant="primary"
                              onClick={() => void onUpdateNow()}
                              disabled={updating}
                            >
                              <RiDownloadLine className="size-4" />
                              {updating ? 'Updating…' : `Update to ${updateInfo.latest}`}
                            </Button>
                          )}
                          <Button
                            variant="subtle"
                            onClick={() => void checkUpdate()}
                            disabled={checking || updating}
                          >
                            {checking ? 'Checking…' : 'Check now'}
                          </Button>
                        </div>
                      </div>
                      {applyMsg && (
                        <div className="mt-2">
                          <Pill tone={applyMsg.ok ? 'green' : 'red'}>{applyMsg.msg}</Pill>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="py-2">
                      <span className="mb-1 block text-xs font-medium text-slate-400">Base URL</span>
                      <input
                        value={extUrl}
                        onChange={(e) => setExtUrl(e.target.value)}
                        placeholder="http://127.0.0.1:8080"
                        className={inputClass}
                        spellCheck={false}
                      />
                    </div>
                    <div className="py-2">
                      <span className="mb-1 block text-xs font-medium text-slate-400">
                        API token <span className="text-slate-600">(optional)</span>
                      </span>
                      <input
                        value={extToken}
                        onChange={(e) => setExtToken(e.target.value)}
                        type="password"
                        placeholder="kasas_…"
                        className={inputClass}
                        spellCheck={false}
                      />
                    </div>
                    <div className="flex items-center gap-2 py-2">
                      <Button variant="ghost" onClick={onTest} disabled={testing}>
                        {testing ? 'Testing…' : 'Test'}
                      </Button>
                      {testResult && (
                        <Pill tone={testResult.ok ? 'green' : 'red'}>{testResult.msg}</Pill>
                      )}
                    </div>
                    <ExternalUpdateStatus />
                  </>
                )}
              </div>
            ) : tab === 'kasas' ? (
              <div>
                <div className="mb-3 flex gap-1.5">
                  {KASAS_SUBTABS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setKasasTab(t.id)}
                      className={cx(
                        'rounded-md px-2.5 py-1 text-xs font-medium',
                        kasasTab === t.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/5 text-slate-300 hover:bg-white/10',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {kasasTab === 'settings' ? (
                  <KasasSettingsEditor />
                ) : kasasTab === 'security' ? (
                  <Security />
                ) : (
                  <BootstrapConfig />
                )}
              </div>
            ) : tab === 'background' ? (
              <div>
                <Row
                  label="Keep kasas running in the background"
                  hint="Installs a macOS LaunchAgent so kasas runs at login, restarts on crash, and keeps polling even when sillview is closed."
                >
                  <Switch
                    checked={!!status?.background}
                    disabled={draft.mode !== 'bundled'}
                    onChange={(v) => void setBackground(v)}
                  />
                </Row>
                {draft.mode !== 'bundled' && (
                  <div className="mt-2 text-xs text-slate-500">
                    Available only in Bundled mode.
                  </div>
                )}
                {status?.background && (
                  <div className="mt-3 rounded-lg border border-line bg-surface-raised p-3 text-xs text-slate-400">
                    kasas is managed by launchd as{' '}
                    <code className="text-slate-300">sh.kasas.sillview</code>. Turning this off
                    stops the daemon and returns to app-managed mode.
                  </div>
                )}
              </div>
            ) : (
              // status tab
              <div className="flex h-full flex-col">
                {status && (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="text-slate-500">State</div>
                    <div className="text-slate-200">{status.state}</div>
                    <div className="text-slate-500">Ready</div>
                    <div className="text-slate-200">{status.ready ? 'yes' : 'no'}</div>
                    <div className="text-slate-500">PID</div>
                    <div className="text-slate-200">{status.pid ?? '—'}</div>
                    <div className="text-slate-500">URL</div>
                    <div className="truncate text-slate-200">{status.baseUrl}</div>
                  </div>
                )}
                {status?.error && (
                  <div className="mt-2 text-xs text-rose-300/90">{status.error}</div>
                )}
                <div className="mt-3 flex gap-2">
                  <Button variant="subtle" onClick={() => void startBackend()}>Start</Button>
                  <Button variant="subtle" onClick={() => void stopBackend()}>Stop</Button>
                  <Button variant="subtle" onClick={() => void restartBackend()}>Restart</Button>
                </div>
                <div className="mt-3 min-h-0 flex-1">
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Logs
                  </div>
                  <div className="scroll-area h-full rounded-lg border border-line bg-black/30 p-2 font-mono text-[11px] leading-relaxed">
                    {logs.length === 0 ? (
                      <div className="text-slate-600">No output yet.</div>
                    ) : (
                      logs.map((l, i) => (
                        <div
                          key={i}
                          className={cx(
                            'whitespace-pre-wrap break-all',
                            l.stream === 'stderr' ? 'text-rose-300/80' : 'text-slate-400',
                          )}
                        >
                          <span className="text-slate-600">{fromNow(new Date(l.at))} </span>
                          {l.line}
                        </div>
                      ))
                    )}
                    <div ref={logEndRef} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button variant="primary" onClick={onSave} disabled={saving || !draft}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
