import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serializeDashboardsFile, type Dashboard } from '../shared/dashboards';
import { findDashboard, mutate, readState } from './store';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sillview-mcp-'));
  process.env.SILLVIEW_DATA_DIR = dir;
});

afterEach(async () => {
  delete process.env.SILLVIEW_DATA_DIR;
  await fs.rm(dir, { recursive: true, force: true });
});

function makeDashboard(id: string, name: string): Dashboard {
  return { id, name, widgets: [], layout: [] };
}

describe('readState', () => {
  it('returns an empty state when the file is missing', async () => {
    expect(await readState()).toEqual({ dashboards: [], activeId: null });
  });
});

describe('mutate', () => {
  it('writes the exact persist envelope to dashboards.json', async () => {
    const d = makeDashboard('a', 'A');
    await mutate(() => ({ state: { dashboards: [d], activeId: 'a' }, result: null }));

    const onDisk = await fs.readFile(path.join(dir, 'dashboards.json'), 'utf8');
    expect(onDisk).toBe(serializeDashboardsFile([d], 'a'));
    expect(await readState()).toEqual({ dashboards: [d], activeId: 'a' });
  });

  it('serializes concurrent mutations without losing writes', async () => {
    // Fire two appends without awaiting between them — the in-process chain must
    // serialize them so neither read-modify-write clobbers the other.
    const p1 = mutate((s) => ({
      state: { dashboards: [...s.dashboards, makeDashboard('a', 'A')], activeId: s.activeId },
      result: null,
    }));
    const p2 = mutate((s) => ({
      state: { dashboards: [...s.dashboards, makeDashboard('b', 'B')], activeId: s.activeId },
      result: null,
    }));
    await Promise.all([p1, p2]);

    const state = await readState();
    expect(state.dashboards.map((d) => d.id).sort()).toEqual(['a', 'b']);
  });
});

describe('findDashboard', () => {
  it('matches by id, then falls back to exact name', () => {
    const state = { dashboards: [makeDashboard('id1', 'Money')], activeId: 'id1' };
    expect(findDashboard(state, 'id1')?.id).toBe('id1');
    expect(findDashboard(state, 'Money')?.id).toBe('id1');
    expect(findDashboard(state, 'missing')).toBeUndefined();
  });
});
