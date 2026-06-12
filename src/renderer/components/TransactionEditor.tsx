/**
 * Create/edit a manual transaction. Amount is bound to a raw decimal STRING
 * (never coerced through Number) so crypto precision survives. Editing a synced
 * (non-manual) row returns 409 from kasas, surfaced inline.
 */

import { useState } from 'react';
import { kasas, KasasError } from '../api/kasas';
import { Modal } from './ui/Modal';
import { Button, Switch } from './ui';
import { cx } from '../lib/utils';
import type { Account, Transaction, TransactionInput } from '../../shared/kasas-types';

const inputClass =
  'w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/60 focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export function TransactionEditor({
  open,
  onClose,
  accounts,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  existing?: Transaction;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<TransactionInput>(() => ({
    account_id: existing?.account_id ?? accounts[0]?.id ?? '',
    amount: existing?.amount ?? '',
    date: (existing?.date ?? new Date().toISOString()).slice(0, 10),
    description: existing?.description ?? '',
    payee: existing?.payee ?? '',
    memo: existing?.memo ?? '',
    pending: existing?.pending ?? false,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const patch = (p: Partial<TransactionInput>) => setForm((f) => ({ ...f, ...p }));

  const submit = async () => {
    setSaving(true);
    setError(undefined);
    try {
      if (existing) await kasas.updateTransaction(existing.id, form);
      else await kasas.createTransaction(form);
      onSaved();
      onClose();
    } catch (e) {
      setError(
        e instanceof KasasError && e.status === 409
          ? 'This transaction is owned by its source and cannot be edited.'
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
      title={existing ? 'Edit transaction' : 'New transaction'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={saving || !form.account_id}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Account">
          <select
            value={form.account_id}
            onChange={(e) => patch({ account_id: e.target.value })}
            className={inputClass}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">
            <input
              value={form.amount}
              onChange={(e) => patch({ amount: e.target.value })}
              placeholder="-12.34"
              spellCheck={false}
              className={cx(inputClass, 'tabular-nums')}
            />
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={form.date}
              onChange={(e) => patch({ date: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Payee">
          <input
            value={form.payee}
            onChange={(e) => patch({ payee: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Description">
          <input
            value={form.description}
            onChange={(e) => patch({ description: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Memo">
          <input
            value={form.memo}
            onChange={(e) => patch({ memo: e.target.value })}
            className={inputClass}
          />
        </Field>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-200">Pending</span>
          <Switch checked={!!form.pending} onChange={(v) => patch({ pending: v })} />
        </div>
        {error && <div className="text-sm text-rose-300/90">{error}</div>}
      </div>
    </Modal>
  );
}
