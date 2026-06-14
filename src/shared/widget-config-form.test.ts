import { describe, expect, it } from 'vitest';
import {
  deriveConfigInputs,
  initConfigDraft,
  parseConfigDraft,
} from './widget-config-form';
import { validateWidgetConfig, widgetMetaByType } from './widgets';

const meta = (type: string) => {
  const m = widgetMetaByType[type];
  if (!m) throw new Error(`no meta for ${type}`);
  return m;
};

describe('deriveConfigInputs', () => {
  it('prefers hand-authored configFields when present', () => {
    const inputs = deriveConfigInputs(meta('transactions'));
    expect(inputs).toEqual([
      expect.objectContaining({ key: 'limit', label: 'Rows shown', kind: 'number' }),
    ]);
    // configSpec also declares accountId, but configFields wins — so the curated
    // single-knob form is shown, not every readable key.
    expect(inputs.map((i) => i.key)).not.toContain('accountId');
  });

  it('falls back to configSpec, humanizing keys into labels', () => {
    const inputs = deriveConfigInputs(meta('benchmark-comparison'));
    expect(inputs.map((i) => [i.key, i.label, i.kind])).toEqual([
      ['series', 'Series', 'text'],
      ['account', 'Account', 'text'],
    ]);
    // The description rides along as help text.
    expect(inputs[0].help).toMatch(/market series id/i);
  });

  it('renders a string[] spec key as a comma-separated list input', () => {
    const inputs = deriveConfigInputs(meta('market-series'));
    expect(inputs).toEqual([
      expect.objectContaining({ key: 'series', kind: 'list' }),
    ]);
  });

  it('returns no inputs for a widget that takes no config', () => {
    expect(deriveConfigInputs(meta('net-worth'))).toEqual([]);
  });
});

describe('initConfigDraft', () => {
  it('seeds from existing config, joining arrays with commas', () => {
    const inputs = deriveConfigInputs(meta('market-series'));
    expect(initConfigDraft(inputs, { series: ['spy', 'agg'] })).toEqual({
      series: 'spy, agg',
    });
  });

  it('falls back to a field default, then empty string', () => {
    const inputs = deriveConfigInputs(meta('transactions'));
    expect(initConfigDraft(inputs, undefined)).toEqual({ limit: '40' });
    expect(initConfigDraft(deriveConfigInputs(meta('benchmark-comparison')), undefined)).toEqual({
      series: '',
      account: '',
    });
  });
});

describe('parseConfigDraft', () => {
  it('splits a list input into a trimmed string[]', () => {
    const inputs = deriveConfigInputs(meta('market-series'));
    expect(parseConfigDraft(inputs, { series: ' spy , agg ,' })).toEqual({
      series: ['spy', 'agg'],
    });
  });

  it('drops empty values so nothing meaningless is persisted', () => {
    const inputs = deriveConfigInputs(meta('benchmark-comparison'));
    expect(parseConfigDraft(inputs, { series: 'spy', account: '  ' })).toEqual({
      series: 'spy',
    });
    expect(parseConfigDraft(deriveConfigInputs(meta('market-series')), { series: '' })).toEqual({});
  });

  it('round-trips through validateWidgetConfig for the config-driven widgets', () => {
    const ms = deriveConfigInputs(meta('market-series'));
    const msConfig = parseConfigDraft(ms, { series: 'spy, agg' });
    expect(validateWidgetConfig('market-series', msConfig).ok).toBe(true);

    const bc = deriveConfigInputs(meta('benchmark-comparison'));
    const bcConfig = parseConfigDraft(bc, { series: 'spy', account: 'acc_brokerage' });
    expect(validateWidgetConfig('benchmark-comparison', bcConfig).ok).toBe(true);
  });
});
