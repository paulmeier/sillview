/**
 * Bridges a widget's metadata to the in-app Configure dialog's form. Pure and
 * React-free so it can be unit-tested and reused: the dialog renders the inputs
 * this produces, and the same parse step turns the user's text back into a config
 * we validate with `validateWidgetConfig` before saving.
 *
 * A widget's UI knobs come from `configFields` when hand-authored (curated labels,
 * help, select options); otherwise we derive them from `configSpec` — the
 * authoritative contract every config-bearing widget already declares. That's what
 * gives `benchmark-comparison`, `market-series`, and any future config-bearing
 * widget a Configure form for free, instead of only the few with `configFields`.
 */

import type { WidgetConfigSpec, WidgetMeta } from './widgets';

/** How the Configure dialog should render and parse one config key. */
export interface WidgetConfigInput {
  key: string;
  label: string;
  /** 'list' is a comma-separated text box that parses to/from a string[]. */
  kind: 'text' | 'number' | 'select' | 'list';
  options?: { value: string; label: string }[];
  default?: string | number;
  help?: string;
  required: boolean;
}

/** Title-case a config key as a fallback field label ("accountId" → "Account Id"). */
function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced ? spaced[0].toUpperCase() + spaced.slice(1) : key;
}

/** The single input kind that fits a spec key's accepted runtime types. */
function specKind(spec: WidgetConfigSpec): WidgetConfigInput['kind'] {
  if (spec.types.includes('string[]')) return 'list';
  // Anything that accepts a string stays a plain text box; a number-only key gets
  // a number box. (Keys that accept both — e.g. transactions.limit — read fine as
  // text, and validateWidgetConfig allows the string form.)
  if (spec.types.includes('string')) return 'text';
  if (spec.types.includes('number')) return 'number';
  return 'text';
}

/**
 * The inputs the Configure dialog should show for a widget. Prefers the curated
 * `configFields`; falls back to deriving them from `configSpec`. A field's
 * `required` flag always comes from the matching `configSpec` entry (configFields
 * doesn't carry one). Returns [] for a widget that takes no config.
 */
export function deriveConfigInputs(meta: WidgetMeta): WidgetConfigInput[] {
  const requiredKeys = new Set(
    (meta.configSpec ?? []).filter((s) => s.required).map((s) => s.key),
  );

  if (meta.configFields?.length) {
    return meta.configFields.map((f) => ({
      key: f.key,
      label: f.label,
      kind: f.type === 'select' ? 'select' : f.type === 'number' ? 'number' : 'text',
      options: f.options,
      default: f.default,
      help: f.help,
      required: requiredKeys.has(f.key),
    }));
  }

  return (meta.configSpec ?? []).map((s) => ({
    key: s.key,
    label: humanizeKey(s.key),
    kind: specKind(s),
    help: s.description,
    required: !!s.required,
  }));
}

/**
 * Seed the dialog's text-only draft from an existing config. Arrays are shown
 * comma-joined; missing values fall back to the field default, then "".
 */
export function initConfigDraft(
  inputs: WidgetConfigInput[],
  config: Record<string, unknown> | undefined,
): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const input of inputs) {
    const value = config?.[input.key];
    if (Array.isArray(value)) {
      draft[input.key] = value.join(', ');
    } else {
      draft[input.key] = String(value ?? input.default ?? '');
    }
  }
  return draft;
}

/**
 * Turn the dialog's text draft back into a config object: `list` inputs split on
 * commas into a string[], everything else stays a trimmed string. Empty values
 * are dropped so we never persist `{ series: '' }` — and so a blank required field
 * surfaces as a "required" validation error rather than silently saving nothing.
 */
export function parseConfigDraft(
  inputs: WidgetConfigInput[],
  draft: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const input of inputs) {
    const raw = (draft[input.key] ?? '').trim();
    if (input.kind === 'list') {
      const arr = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (arr.length) out[input.key] = arr;
    } else if (raw !== '') {
      out[input.key] = raw;
    }
  }
  return out;
}
