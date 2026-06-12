/**
 * Accounts management page: every account with its balance, plus create/edit/
 * delete for manual accounts (synced accounts are owned by their source and
 * read-only — kasas 409s). Balance is a raw decimal string.
 */

import { useCallback, useEffect, useState } from 'react';
import { RiAddLine, RiBankLine, RiDeleteBinLine, RiPencilLine } from '@remixicon/react';
import { kasas, KasasError } from '../api/kasas';
import { useFamilyKeys } from '../api/hooks';
import { PageShell } from '../shell/Page';
import { Modal } from '../components/ui/Modal';
import { Button, IconButton, Pill, Spinner } from '../components/ui';
import { formatMoney } from '../lib/money';
import { formatDate } from '../lib/time';
import { cx } from '../lib/utils';
import type { Account, AccountInput } from '../../shared/kasas-types';

const inputClass =
  'w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/60 focus:outline-none';

function AccountEditor({
  open,
  onClose,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  existing?: Account;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<AccountInput>(() => ({
    name: existing?.name ?? '',
    currency: existing?.currency ?? 'USD',
    balance: existing?.balance ?? '',
    balance_date: (existing?.balance_date ?? new Date().toISOString()).slice(0, 10),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const patch = (p: Partial<AccountInput>) => setForm((f) => ({ ...f, ...p }));

  const submit = async () => {
    setSaving(true);
    setError(undefined);
    try {
      if (existing) await kasas.updateAccount(existing.id, form);
      else await kasas.createAccount(form);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={existing ? 'Edit account' : 'New account'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={saving || !form.name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Name</span>
          <input value={form.name} onChange={(e) => patch({ name: e.target.value })} className={inputClass} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Currency</span>
            <input
              value={form.currency}
              onChange={(e) => patch({ currency: e.target.value })}
              placeholder="USD"
              className={inputClass}
              spellCheck={false}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Balance</span>
            <input
              value={form.balance}
              onChange={(e) => patch({ balance: e.target.value })}
              placeholder="0.00"
              className={cx(inputClass, 'tabular-nums')}
              spellCheck={false}
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Balance date</span>
          <input
            type="date"
            value={form.balance_date}
            onChange={(e) => patch({ balance_date: e.target.value })}
            className={inputClass}
          />
        </label>
        {error && <div className="text-sm text-rose-300/90">{error}</div>}
      </div>
    </Modal>
  );
}

export function Accounts() {
  const keys = useFamilyKeys(['account', 'sync']);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<{ open: boolean; account?: Account }>({ open: false });

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setAccounts(await kasas.accounts());
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

  const remove = async (a: Account) => {
    if (!confirm(`Delete "${a.name}" and all its transactions?`)) return;
    try {
      await kasas.deleteAccount(a.id);
      setAccounts((list) => list.filter((x) => x.id !== a.id));
    } catch (e) {
      setError(
        e instanceof KasasError && e.status === 409
          ? 'Only manual accounts can be deleted.'
          : e instanceof Error
            ? e.message
            : String(e),
      );
    }
  };

  const actions = (
    <Button variant="primary" onClick={() => setEditing({ open: true })}>
      <RiAddLine className="size-4" />
      New account
    </Button>
  );

  return (
    <PageShell title="Accounts" subtitle={`${accounts.length} accounts`} actions={actions}>
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      ) : error && accounts.length === 0 ? (
        <div className="text-sm text-rose-300/90">{error}</div>
      ) : (
        <div className="space-y-3">
          {error && <div className="text-sm text-rose-300/90">{error}</div>}
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-white/[0.03] text-left text-xs text-slate-400">
                <tr className="border-b border-line">
                  <th className="px-3 py-2 font-medium">Account</th>
                  <th className="px-3 py-2 font-medium">Currency</th>
                  <th className="px-3 py-2 text-right font-medium">Balance</th>
                  <th className="px-3 py-2 font-medium">As of</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const manual = a.source === 'manual';
                  return (
                    <tr key={a.id} className="border-b border-line/60 last:border-0 hover:bg-white/[0.02]">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <RiBankLine className="size-4 text-slate-500" />
                          <span className="font-medium text-slate-200">{a.name}</span>
                          {manual ? <Pill tone="blue">manual</Pill> : <Pill tone="neutral">{a.source}</Pill>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-400">{a.currency}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-200">
                        {formatMoney(a.balance, a.currency)}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{formatDate(a.balance_date)}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          <IconButton
                            aria-label="Edit"
                            disabled={!manual}
                            title={manual ? 'Edit' : 'Synced accounts are read-only'}
                            onClick={() => setEditing({ open: true, account: a })}
                          >
                            <RiPencilLine className="size-4" />
                          </IconButton>
                          <IconButton aria-label="Delete" disabled={!manual} onClick={() => void remove(a)}>
                            <RiDeleteBinLine className="size-4" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing.open && (
        <AccountEditor
          open={editing.open}
          existing={editing.account}
          onClose={() => setEditing({ open: false })}
          onSaved={load}
        />
      )}
    </PageShell>
  );
}
