import { describe, expect, it } from 'vitest';
import {
  KNOWN_WIDGET_TYPES,
  isKnownWidgetType,
  validateWidgetConfig,
  WIDGET_META,
} from './widgets';

describe('widget catalog', () => {
  it('exposes every known type with a default size', () => {
    expect(KNOWN_WIDGET_TYPES).toContain('net-worth');
    expect(KNOWN_WIDGET_TYPES).toContain('market-series');
    expect(WIDGET_META.length).toBe(KNOWN_WIDGET_TYPES.length);
    for (const m of WIDGET_META) {
      expect(m.defaultSize.w).toBeGreaterThan(0);
      expect(m.defaultSize.h).toBeGreaterThan(0);
    }
  });

  it('recognizes known vs unknown types', () => {
    expect(isKnownWidgetType('cashflow')).toBe(true);
    expect(isKnownWidgetType('nope')).toBe(false);
  });
});

describe('validateWidgetConfig', () => {
  it('accepts a config-less widget with no config', () => {
    const r = validateWidgetConfig('net-worth', undefined);
    expect(r).toEqual({ ok: true, config: undefined });
  });

  it('rejects config on a widget that takes none', () => {
    const r = validateWidgetConfig('net-worth', { foo: 1 });
    expect(r.ok).toBe(false);
  });

  it('rejects an unknown widget type', () => {
    const r = validateWidgetConfig('bogus', undefined);
    expect(r.ok).toBe(false);
  });

  it('accepts transactions.limit as number or numeric string', () => {
    expect(validateWidgetConfig('transactions', { limit: 40 }).ok).toBe(true);
    expect(validateWidgetConfig('transactions', { limit: '40' }).ok).toBe(true);
  });

  it('rejects transactions.limit of the wrong type', () => {
    expect(validateWidgetConfig('transactions', { limit: true }).ok).toBe(false);
  });

  it('rejects an unknown config key', () => {
    expect(validateWidgetConfig('transactions', { bogus: 1 }).ok).toBe(false);
  });

  it('accepts market-series.series as string OR string[]', () => {
    expect(validateWidgetConfig('market-series', { series: 'spy' }).ok).toBe(true);
    expect(validateWidgetConfig('market-series', { series: ['spy', 'agg'] }).ok).toBe(true);
  });

  it('rejects market-series.series of the wrong type', () => {
    expect(validateWidgetConfig('market-series', { series: 123 }).ok).toBe(false);
  });

  it('accepts benchmark-comparison series + account', () => {
    const r = validateWidgetConfig('benchmark-comparison', {
      series: 'spy',
      account: 'acc_brokerage',
    });
    expect(r.ok).toBe(true);
  });

  it('rejects a non-object config', () => {
    expect(validateWidgetConfig('transactions', [1, 2]).ok).toBe(false);
    expect(validateWidgetConfig('transactions', 'x').ok).toBe(false);
  });
});
