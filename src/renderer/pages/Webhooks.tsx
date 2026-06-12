/**
 * Webhooks page — register endpoints that receive committed events. Create/edit/
 * delete, subscribe to specific event types (or *), send a test delivery, and
 * rotate the signing secret. The secret is shown only once (on create/rotate).
 */

import { useCallback, useEffect, useState } from 'react';
import { RiAddLine, RiDeleteBinLine, RiPencilLine, RiSendPlaneLine, RiRefreshLine } from '@remixicon/react';
import { kasas, KasasError } from '../api/kasas';
import { useFamilyKeys } from '../api/hooks';
import { PageShell } from '../shell/Page';
import { Modal } from '../components/ui/Modal';
import { Button, IconButton, Pill, Spinner, Switch } from '../components/ui';
import { fromNow } from '../lib/time';
import type { Webhook, WebhookInput } from '../../shared/kasas-types';

const inputClass =
  'w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/60 focus:outline-none';

function parseTypes(s: string): string[] {
  const parts = s.split(',').map((x) => x.trim()).filter(Boolean);
  return parts.length === 0 ? ['*'] : parts;
}

function WebhookEditor({
  open,
  onClose,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  existing?: Webhook;
  onSaved: (secret?: string, id?: number) => void;
}) {
  const [url, setUrl] = useState(existing?.url ?? '');
  const [types, setTypes] = useState((existing?.event_types ?? ['*']).join(', '));
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    setSaving(true);
    setError(undefined);
    const input: WebhookInput = { url: url.trim(), event_types: parseTypes(types), enabled };
    try {
      const wh = existing ? await kasas.updateWebhook(existing.id, input) : await kasas.createWebhook(input);
      onSaved(wh.secret, wh.id);
      onClose();
    } catch (e) {
      setError(e instanceof KasasError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={existing ? 'Edit webhook' : 'New webhook'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={saving || !url.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Endpoint URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/hooks/kasas"
            className={inputClass}
            spellCheck={false}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Event types</span>
          <input
            value={types}
            onChange={(e) => setTypes(e.target.value)}
            placeholder="* (all), or e.g. transaction.created, label.applied"
            className={inputClass}
            spellCheck={false}
          />
          <span className="mt-1 block text-xs text-slate-500">Comma-separated, or * for all events.</span>
        </label>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-200">Enabled</span>
          <Switch checked={enabled} onChange={setEnabled} />
        </div>
        {error && <div className="text-sm text-rose-300/90">{error}</div>}
      </div>
    </Modal>
  );
}

export function Webhooks() {
  const keys = useFamilyKeys(['webhook']);
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<{ open: boolean; hook?: Webhook }>({ open: false });
  const [secret, setSecret] = useState<string>();
  const [testMsg, setTestMsg] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setHooks(await kasas.webhooks());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, ...keys]);

  const test = async (h: Webhook) => {
    try {
      const res = await kasas.testWebhook(h.id);
      setTestMsg((m) => ({ ...m, [h.id]: res.delivered ? `Delivered (${res.status})` : `Failed: ${res.error ?? res.status}` }));
    } catch (e) {
      setTestMsg((m) => ({ ...m, [h.id]: e instanceof Error ? e.message : String(e) }));
    }
  };

  const rotate = async (h: Webhook) => {
    try {
      const wh = await kasas.rotateWebhookSecret(h.id);
      if (wh.secret) setSecret(wh.secret);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (h: Webhook) => {
    if (!confirm(`Delete webhook for ${h.url}?`)) return;
    try {
      await kasas.deleteWebhook(h.id);
      setHooks((list) => list.filter((x) => x.id !== h.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const actions = (
    <Button variant="primary" onClick={() => setEditing({ open: true })}>
      <RiAddLine className="size-4" />
      New webhook
    </Button>
  );

  return (
    <PageShell title="Webhooks" subtitle={`${hooks.length} webhooks`} actions={actions}>
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-3">
          {error && <div className="text-sm text-rose-300/90">{error}</div>}

          {secret && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              <div className="mb-1 font-medium text-emerald-200">Signing secret (shown once)</div>
              <code className="block break-all rounded bg-black/30 px-2 py-1 font-mono text-xs text-emerald-100">
                {secret}
              </code>
              <button className="mt-2 text-xs text-emerald-300/80 hover:text-emerald-100" onClick={() => setSecret(undefined)}>
                Dismiss
              </button>
            </div>
          )}

          {hooks.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-500">No webhooks registered.</div>
          )}

          {hooks.map((h) => (
            <div key={h.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-slate-200">{h.url}</span>
                    {!h.enabled && <Pill tone="neutral">disabled</Pill>}
                    {h.last_status > 0 && (
                      <Pill tone={h.last_status < 300 ? 'green' : 'red'}>last {h.last_status}</Pill>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {h.event_types.map((t) => (
                      <Pill key={t} tone="blue">
                        {t}
                      </Pill>
                    ))}
                  </div>
                  {h.last_attempt_at && (
                    <div className="mt-1 text-xs text-slate-500">
                      last attempt {fromNow(h.last_attempt_at)}
                      {h.last_error ? ` — ${h.last_error}` : ''}
                    </div>
                  )}
                  {testMsg[h.id] && <div className="mt-1 text-xs text-slate-400">{testMsg[h.id]}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton aria-label="Test" title="Send test delivery" onClick={() => void test(h)}>
                    <RiSendPlaneLine className="size-4" />
                  </IconButton>
                  <IconButton aria-label="Rotate secret" title="Rotate signing secret" onClick={() => void rotate(h)}>
                    <RiRefreshLine className="size-4" />
                  </IconButton>
                  <IconButton aria-label="Edit" onClick={() => setEditing({ open: true, hook: h })}>
                    <RiPencilLine className="size-4" />
                  </IconButton>
                  <IconButton aria-label="Delete" onClick={() => void remove(h)}>
                    <RiDeleteBinLine className="size-4" />
                  </IconButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing.open && (
        <WebhookEditor
          open={editing.open}
          existing={editing.hook}
          onClose={() => setEditing({ open: false })}
          onSaved={(s) => {
            if (s) setSecret(s);
            void load();
          }}
        />
      )}
    </PageShell>
  );
}
