import { describe, expect, it } from 'vitest';
import { KNOWN_WIDGET_TYPES, WIDGET_META } from '../../shared/widgets';
import { ICON_BY_TYPE, TAGS_BY_TYPE, mockRegistryIndex } from './mock-registry';

// The marketplace's curated icon set (mirrors sillview-widgets/schema + renderer icons.ts).
const CURATED_ICONS = new Set([
  'wallet',
  'bank',
  'bar-chart',
  'line-chart',
  'pie-chart',
  'list',
  'activity',
  'refresh',
  'scales',
  'exchange',
  'gauge',
  'coin',
  'star',
  'puzzle',
]);

describe('mock registry parity with the compiled widget catalog', () => {
  const index = mockRegistryIndex();

  it('lists exactly the compiled widget types', () => {
    const slugs = index.widgets.map((w) => w.name).sort();
    expect(slugs).toEqual([...KNOWN_WIDGET_TYPES].sort());
  });

  it('every compiled widget has a curated icon + tags, and metadata matches', () => {
    for (const m of WIDGET_META) {
      const entry = index.widgets.find((w) => w.widget_type === m.type);
      expect(entry, `missing registry entry for ${m.type}`).toBeDefined();
      if (!entry) continue;
      expect(CURATED_ICONS.has(entry.icon)).toBe(true);
      expect(entry.category).toBe(m.category);
      expect(entry.default_size).toEqual(m.defaultSize);
      expect(entry.config).toEqual(m.configSpec ?? []);
      expect(ICON_BY_TYPE[m.type]).toBeTruthy();
      expect(Array.isArray(TAGS_BY_TYPE[m.type])).toBe(true);
    }
  });

  it('is schema-versioned and sorted by name', () => {
    expect(index.schema_version).toBe(1);
    const names = index.widgets.map((w) => w.name);
    expect(names).toEqual([...names].sort());
  });
});
