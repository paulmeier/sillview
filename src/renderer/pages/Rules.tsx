/**
 * Rules page — auto-labeling rules (a kasas search query + labels to apply).
 * Create/edit/delete, toggle enabled, run one or run all. Query validation is
 * delegated to the server (a 400 is surfaced inline; there is no JS query parser).
 */

import { useCallback, useEffect, useState } from 'react';
import { RiAddLine, RiDeleteBinLine, RiPencilLine, RiPlayLine } from '@remixicon/react';
import { kasas, KasasError } from '../api/kasas';
import { useFamilyKeys } from '../api/hooks';
import { PageShell } from '../shell/Page';
import { LabelEditor } from '../components/LabelEditor';
import { Modal } from '../components/ui/Modal';
import { Button, IconButton, Pill, Spinner, Switch } from '../components/ui';
import type { Label, Rule, RuleInput } from '../../shared/kasas-types';

const inputClass =
  'w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/60 focus:outline-none';

function RuleEditor({
  open,
  onClose,
  existing,
  vocabulary,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  existing?: Rule;
  vocabulary: Label[];
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [query, setQuery] = useState(existing?.query ?? '');
  const [labels, setLabels] = useState<Record<string, string>>(existing?.labels ?? {});
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    setSaving(true);
    setError(undefined);
    const input: RuleInput = { name, query, labels, enabled };
    try {
      if (existing) await kasas.updateRule(existing.id, input);
      else await kasas.createRule(input);
      onSaved();
      onClose();
    } catch (e) {
      setError(
        e instanceof KasasError && e.status === 400
          ? `Invalid rule: ${e.message}`
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={existing ? 'Edit rule' : 'New rule'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void submit()}
            disabled={saving || !name.trim() || Object.keys(labels).length === 0}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Query</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. coffee  or  amount:<0 payee:Starbucks"
            className={inputClass}
            spellCheck={false}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Matching transactions get the labels below. An empty query matches all.
          </span>
        </label>
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-400">Apply labels</span>
          <LabelEditor value={labels} vocabulary={vocabulary} onSave={setLabels} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-200">Enabled</span>
          <Switch checked={enabled} onChange={setEnabled} />
        </div>
        {error && <div className="text-sm text-rose-300/90">{error}</div>}
      </div>
    </Modal>
  );
}

export function Rules() {
  const keys = useFamilyKeys(['rule', 'label']);
  const [rules, setRules] = useState<Rule[]>([]);
  const [vocabulary, setVocabulary] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<{ open: boolean; rule?: Rule }>({ open: false });
  const [msg, setMsg] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const [r, l] = await Promise.all([kasas.rules(), kasas.labels()]);
      setRules(r);
      setVocabulary(l);
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

  const runOne = async (rule: Rule) => {
    setMsg(undefined);
    try {
      const res = await kasas.runRule(rule.id);
      setMsg(`"${rule.name}": ${res.matched} matched, ${res.updated} updated`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const runAll = async () => {
    setMsg(undefined);
    try {
      const res = await kasas.runAllRules();
      setMsg(`All rules: ${res.matched} matched, ${res.updated} updated`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (rule: Rule) => {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    try {
      await kasas.deleteRule(rule.id);
      setRules((list) => list.filter((r) => r.id !== rule.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const toggle = async (rule: Rule) => {
    try {
      await kasas.updateRule(rule.id, {
        name: rule.name,
        query: rule.query,
        labels: rule.labels,
        enabled: !rule.enabled,
      });
      setRules((list) => list.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const actions = (
    <>
      {msg && <span className="text-xs text-slate-400">{msg}</span>}
      <Button variant="subtle" onClick={() => void runAll()}>
        <RiPlayLine className="size-4" />
        Run all
      </Button>
      <Button variant="primary" onClick={() => setEditing({ open: true })}>
        <RiAddLine className="size-4" />
        New rule
      </Button>
    </>
  );

  return (
    <PageShell title="Rules" subtitle={`${rules.length} rules`} actions={actions}>
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-3">
          {error && <div className="text-sm text-rose-300/90">{error}</div>}
          {rules.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-500">
              No rules yet. Create one to auto-label transactions.
            </div>
          )}
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100">{rule.name}</span>
                    {!rule.enabled && <Pill tone="neutral">disabled</Pill>}
                  </div>
                  <code className="mt-1 block truncate text-xs text-blue-300/90">{rule.query || '(matches all)'}</code>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(rule.labels).map(([k, v]) => (
                      <Pill key={k} tone="blue">
                        {k}: {v}
                      </Pill>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Switch checked={rule.enabled} onChange={() => void toggle(rule)} />
                  <IconButton aria-label="Run" title="Run now" onClick={() => void runOne(rule)}>
                    <RiPlayLine className="size-4" />
                  </IconButton>
                  <IconButton aria-label="Edit" onClick={() => setEditing({ open: true, rule })}>
                    <RiPencilLine className="size-4" />
                  </IconButton>
                  <IconButton aria-label="Delete" onClick={() => void remove(rule)}>
                    <RiDeleteBinLine className="size-4" />
                  </IconButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing.open && (
        <RuleEditor
          open={editing.open}
          existing={editing.rule}
          vocabulary={vocabulary}
          onClose={() => setEditing({ open: false })}
          onSaved={load}
        />
      )}
    </PageShell>
  );
}
