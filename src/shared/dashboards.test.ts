import { describe, expect, it } from 'vitest';
import {
  addWidgetToDashboard,
  parseDashboardsFile,
  placeWidgetBelow,
  serializeDashboardsFile,
  type Dashboard,
} from './dashboards';
import { validateWidgetConfig } from './widgets';

describe('serializeDashboardsFile / parseDashboardsFile', () => {
  it('writes the Zustand persist envelope and round-trips', () => {
    const d: Dashboard = { id: 'a', name: 'A', widgets: [], layout: [] };
    const json = serializeDashboardsFile([d], 'a');
    expect(JSON.parse(json)).toEqual({
      state: { dashboards: [d], activeId: 'a' },
      version: 0,
    });
    expect(parseDashboardsFile(json)).toEqual({ dashboards: [d], activeId: 'a' });
  });

  it('treats null / empty string as an empty state (not an error)', () => {
    expect(parseDashboardsFile(null)).toEqual({ dashboards: [], activeId: null });
    expect(parseDashboardsFile('')).toEqual({ dashboards: [], activeId: null });
  });
});

describe('placeWidgetBelow', () => {
  it('places the first widget at the top-left', () => {
    expect(placeWidgetBelow([], { w: 4, h: 3 }, 'w1')).toEqual({
      i: 'w1',
      x: 0,
      y: 0,
      w: 4,
      h: 3,
      minW: undefined,
      minH: undefined,
    });
  });

  it('stacks below the tallest existing item', () => {
    const layout = [
      { i: 'a', x: 0, y: 0, w: 6, h: 4 },
      { i: 'b', x: 6, y: 0, w: 6, h: 7 },
    ];
    const slot = placeWidgetBelow(layout, { w: 4, h: 3, minW: 2, minH: 2 }, 'c');
    expect(slot).toEqual({ i: 'c', x: 0, y: 7, w: 4, h: 3, minW: 2, minH: 2 });
  });
});

describe('addWidgetToDashboard', () => {
  it('appends a widget and a layout slot whose `i` matches the widget id', () => {
    const d: Dashboard = { id: 'd', name: 'D', widgets: [], layout: [] };
    const next = addWidgetToDashboard(d, { id: 'w1', type: 'net-worth' }, { w: 4, h: 3 });
    expect(next.widgets).toEqual([{ id: 'w1', type: 'net-worth' }]);
    expect(next.layout[0].i).toBe('w1');
    // Original is not mutated.
    expect(d.widgets).toHaveLength(0);
  });
});

describe('mock-fixture-shaped dashboard', () => {
  it('serializes, parses, and every widget config validates', () => {
    const dashboard: Dashboard = {
      id: 'dash_investments',
      name: 'Investments',
      widgets: [
        { id: 'mw_spy_series', type: 'market-series', config: { series: ['spy', 'agg'] } },
        {
          id: 'mw_spy_vs_brokerage',
          type: 'benchmark-comparison',
          config: { series: 'spy', account: 'acc_brokerage' },
        },
      ],
      layout: [
        { i: 'mw_spy_series', x: 0, y: 0, w: 7, h: 6, minW: 4, minH: 3 },
        { i: 'mw_spy_vs_brokerage', x: 7, y: 0, w: 5, h: 6, minW: 4, minH: 4 },
      ],
    };
    const parsed = parseDashboardsFile(serializeDashboardsFile([dashboard], dashboard.id));
    expect(parsed.dashboards[0]).toEqual(dashboard);
    for (const w of parsed.dashboards[0].widgets) {
      expect(validateWidgetConfig(w.type, w.config).ok).toBe(true);
    }
  });
});
