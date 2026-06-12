/**
 * Renders a server-validated plugin pageDoc — the declarative UI a plugin returns
 * from its OnPageRender hook. This is what makes "kasas dashboard off" lossless:
 * kasas no longer renders plugin pages, so sillview does, with a thin switch over
 * the block types (heading/text/stat/keyvalue/table/actions/form/divider).
 *
 * The server normalizes and bounds every block (XSS-safe), so this stays simple.
 * Mirrors kasas internal/plugins/pagedoc.go.
 */

import { useState } from 'react';
import { Button, Switch } from '../ui';
import { cx } from '../../lib/utils';
import type { PageBlock, PageField, PluginPageDoc } from '../../../shared/kasas-types';

const inputClass =
  'w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-slate-100 focus:border-blue-500/60 focus:outline-none';

type Dispatch = (id: string, params: Record<string, string>) => void;

function actionVariant(style?: string): 'primary' | 'danger' | 'subtle' {
  if (style === 'primary') return 'primary';
  if (style === 'danger') return 'danger';
  return 'subtle';
}

function FormBlock({ block, onAction, busy }: { block: PageBlock; onAction: Dispatch; busy: boolean }) {
  const fields = block.fields ?? [];
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) init[f.name] = f.value ?? (f.kind === 'toggle' ? 'false' : '');
    return init;
  });
  const set = (name: string, v: string) => setValues((s) => ({ ...s, [name]: v }));

  const field = (f: PageField) => {
    if (f.kind === 'toggle') {
      return (
        <Switch checked={values[f.name] === 'true'} onChange={(v) => set(f.name, String(v))} />
      );
    }
    if (f.kind === 'select') {
      return (
        <select value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} className={inputClass}>
          {(f.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        type={f.kind === 'number' ? 'number' : 'text'}
        value={values[f.name] ?? ''}
        placeholder={f.placeholder}
        onChange={(e) => set(f.name, e.target.value)}
        className={inputClass}
      />
    );
  };

  return (
    <form
      className="space-y-3 rounded-lg border border-line bg-surface-raised p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (block.id) onAction(block.id, values);
      }}
    >
      {fields.map((f) => (
        <label key={f.name} className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">{f.label}</span>
          {field(f)}
          {f.help && <span className="mt-1 block text-xs text-slate-500">{f.help}</span>}
        </label>
      ))}
      <Button variant="primary" type="submit" disabled={busy}>
        {block.submit_label || 'Submit'}
      </Button>
    </form>
  );
}

function Block({ block, onAction, busy }: { block: PageBlock; onAction: Dispatch; busy: boolean }) {
  switch (block.type) {
    case 'heading':
      return <h2 className="text-base font-semibold text-slate-100">{block.text}</h2>;
    case 'text':
      return <p className="text-sm leading-relaxed text-slate-300">{block.text}</p>;
    case 'divider':
      return <hr className="border-line" />;
    case 'stat':
      return (
        <div className="rounded-lg border border-line bg-surface-raised p-4">
          {block.label && <div className="text-xs uppercase tracking-wide text-slate-500">{block.label}</div>}
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-100">{block.value}</div>
          {block.hint && <div className="mt-0.5 text-xs text-slate-500">{block.hint}</div>}
        </div>
      );
    case 'keyvalue':
      return (
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 rounded-lg border border-line bg-surface-raised p-4 text-sm">
          {(block.items ?? []).map((kv, i) => (
            <div key={i} className="contents">
              <div className="text-slate-500">{kv.key}</div>
              <div className="text-slate-300">{kv.value}</div>
            </div>
          ))}
        </div>
      );
    case 'table':
      return (
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full border-collapse text-sm">
            {(block.columns?.length ?? 0) > 0 && (
              <thead className="bg-white/[0.03] text-left text-xs text-slate-400">
                <tr className="border-b border-line">
                  {(block.columns ?? []).map((c, i) => (
                    <th key={i} className="px-3 py-2 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {(block.rows ?? []).map((row, ri) => (
                <tr key={ri} className="border-b border-line/60 last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-slate-300">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'actions':
      return (
        <div className="flex flex-wrap gap-2">
          {(block.actions ?? []).map((a) => (
            <Button
              key={a.id}
              variant={actionVariant(a.style)}
              disabled={busy}
              onClick={() => onAction(a.id, a.params ?? {})}
            >
              {a.label}
            </Button>
          ))}
        </div>
      );
    case 'form':
      return <FormBlock block={block} onAction={onAction} busy={busy} />;
    default:
      return null; // unknown block types are dropped (server also strips them)
  }
}

export function PageRenderer({
  doc,
  onAction,
  busy = false,
}: {
  doc: PluginPageDoc;
  onAction: Dispatch;
  busy?: boolean;
}) {
  return (
    <div className={cx('space-y-4', busy && 'opacity-70')}>
      {doc.blocks.map((block, i) => (
        <Block key={i} block={block} onAction={onAction} busy={busy} />
      ))}
    </div>
  );
}
