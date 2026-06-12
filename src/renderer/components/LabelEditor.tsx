/**
 * Inline label editor: chips with remove + a compact key:value add control with
 * typeahead from the label vocabulary. The parent owns the optimistic update and
 * revert (it persists via kasas.setLabels), so this stays a controlled cell.
 */

import { useState } from 'react';
import { RiAddLine, RiCloseLine } from '@remixicon/react';
import type { Label } from '../../shared/kasas-types';
import { Pill } from './ui';
import { cx } from '../lib/utils';

const miniInput =
  'rounded-md border border-line bg-surface-raised px-2 py-0.5 text-xs text-slate-100 focus:border-blue-500/60 focus:outline-none';

export function LabelEditor({
  value,
  vocabulary,
  onSave,
  disabled,
}: {
  value: Record<string, string>;
  vocabulary: Label[];
  onSave: (next: Record<string, string>) => void;
  disabled?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [k, setK] = useState('');
  const [v, setV] = useState('');

  const entries = Object.entries(value ?? {});
  const keyOptions = Array.from(new Set(vocabulary.map((l) => l.key)));
  const valueOptions = Array.from(
    new Set(vocabulary.filter((l) => !k || l.key === k.trim().toLowerCase()).map((l) => l.value)),
  );

  const remove = (key: string) => {
    const next = { ...value };
    delete next[key];
    onSave(next);
  };

  const add = () => {
    const key = k.trim().toLowerCase();
    const val = v.trim();
    if (!key || !val) return;
    onSave({ ...value, [key]: val });
    setK('');
    setV('');
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {entries.map(([key, val]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-300 ring-1 ring-inset ring-white/10"
        >
          {key}: {val}
          {!disabled && (
            <button onClick={() => remove(key)} className="text-slate-500 hover:text-rose-300">
              <RiCloseLine className="size-3" />
            </button>
          )}
        </span>
      ))}

      {!disabled && !adding && (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-white/5 hover:text-slate-300"
        >
          <RiAddLine className="size-3" />
          label
        </button>
      )}

      {!disabled && adding && (
        <span className="inline-flex items-center gap-1">
          <input
            autoFocus
            list="label-keys"
            value={k}
            onChange={(e) => setK(e.target.value)}
            placeholder="key"
            className={cx(miniInput, 'w-20')}
          />
          <input
            list="label-values"
            value={v}
            onChange={(e) => setV(e.target.value)}
            placeholder="value"
            onKeyDown={(e) => {
              if (e.key === 'Enter') add();
              if (e.key === 'Escape') setAdding(false);
            }}
            className={cx(miniInput, 'w-24')}
          />
          <button onClick={add} className="text-emerald-400 hover:text-emerald-300">
            <RiAddLine className="size-3.5" />
          </button>
          <datalist id="label-keys">
            {keyOptions.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
          <datalist id="label-values">
            {valueOptions.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </span>
      )}

      {disabled && entries.length === 0 && <Pill tone="neutral">—</Pill>}
    </div>
  );
}
