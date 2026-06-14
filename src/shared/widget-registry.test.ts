import { describe, expect, it } from 'vitest';
import {
  installedFromRegistry,
  parseInstalledFile,
  RECOMMENDED_CORE,
  seedInstalled,
  serializeInstalledFile,
  type RegistryWidget,
} from './widget-registry';

const sample: RegistryWidget = {
  name: 'net-worth',
  version: '1.2.0',
  description: 'Total balance across all accounts.',
  author: 'sillview',
  license: 'MIT',
  homepage: 'https://example.com',
  kind: 'builtin',
  widget_type: 'net-worth',
  category: 'Overview',
  icon: 'wallet',
  tags: ['balance'],
  tier: 'verified',
  default_size: { w: 4, h: 3 },
  config: [],
  path: 'widgets/net-worth',
  files: [],
  content_hash: 'sha256:abc',
  size_bytes: 0,
};

describe('installed widgets file', () => {
  it('seeds the recommended core', () => {
    const seeded = seedInstalled('2026-01-01T00:00:00.000Z');
    expect(seeded.map((w) => w.slug)).toEqual([...RECOMMENDED_CORE]);
    expect(seeded.every((w) => w.widget_type === w.slug)).toBe(true);
  });

  it('maps a registry entry to an install record', () => {
    const rec = installedFromRegistry(sample, '2026-06-14T00:00:00.000Z');
    expect(rec).toEqual({
      slug: 'net-worth',
      widget_type: 'net-worth',
      version: '1.2.0',
      installedAt: '2026-06-14T00:00:00.000Z',
    });
  });

  it('round-trips through serialize/parse, sorted', () => {
    const list = [
      installedFromRegistry({ ...sample, name: 'transactions', widget_type: 'transactions' }, 'b'),
      installedFromRegistry(sample, 'a'),
    ];
    const parsed = parseInstalledFile(serializeInstalledFile(list));
    expect(parsed.map((w) => w.slug)).toEqual(['net-worth', 'transactions']); // sorted
  });

  it('tolerates a bare array, a missing file, and garbage', () => {
    expect(parseInstalledFile(null)).toEqual([]);
    expect(parseInstalledFile('not json')).toEqual([]);
    const bare = JSON.stringify([{ slug: 'a', widget_type: 'a', version: '1.0.0', installedAt: '' }]);
    expect(parseInstalledFile(bare).map((w) => w.slug)).toEqual(['a']);
  });

  it('drops malformed and duplicate entries', () => {
    const raw = JSON.stringify({
      version: 1,
      installed: [
        { slug: 'a', widget_type: 'a', version: '1.0.0', installedAt: '' },
        { slug: 'a', widget_type: 'a', version: '2.0.0', installedAt: '' }, // dup slug
        { widget_type: 'b' }, // missing slug
        'nope',
      ],
    });
    const parsed = parseInstalledFile(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].version).toBe('1.0.0'); // first wins
  });
});
