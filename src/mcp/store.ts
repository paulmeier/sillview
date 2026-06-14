/**
 * Read/modify/write access to sillview's dashboards.json for the MCP server.
 *
 * Writes go through the shared serializer so the file stays byte-compatible with
 * what the renderer's Zustand store hydrates, and are atomic (temp + rename) so
 * the app never reads a half-written file. Mutations are serialized through an
 * in-process chain so two concurrent tool calls can't lose each other's writes.
 * (Cross-process races with the app's own saves are still possible but rare; the
 * app's atomic writes + the watcher's reload make last-write-wins safe enough.)
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  parseDashboardsFile,
  serializeDashboardsFile,
  type Dashboard,
  type DashboardsState,
} from '../shared/dashboards';
import { dashboardsPath, userDataDir } from './paths';

/** Read the current dashboards state (empty state if the file is missing). */
export async function readState(): Promise<DashboardsState> {
  let raw: string | null = null;
  try {
    raw = await fs.readFile(dashboardsPath(), 'utf8');
  } catch {
    raw = null;
  }
  return parseDashboardsFile(raw);
}

async function writeState(state: DashboardsState): Promise<void> {
  const dir = userDataDir();
  await fs.mkdir(dir, { recursive: true });
  const contents = serializeDashboardsFile(state.dashboards, state.activeId);
  const tmp = path.join(dir, `.dashboards.mcp.${process.pid}.tmp`);
  await fs.writeFile(tmp, contents, 'utf8');
  await fs.rename(tmp, dashboardsPath());
}

let chain: Promise<unknown> = Promise.resolve();

/**
 * Run a read-modify-write atomically with respect to other mutations in this
 * process. `fn` receives the current state and returns the next state plus a
 * result to hand back to the caller.
 */
export function mutate<T>(
  fn: (state: DashboardsState) => { state: DashboardsState; result: T },
): Promise<T> {
  const run = async (): Promise<T> => {
    const state = await readState();
    const { state: next, result } = fn(state);
    await writeState(next);
    return result;
  };
  const p = chain.then(run, run);
  // Keep the chain alive regardless of this op's outcome.
  chain = p.then(
    () => undefined,
    () => undefined,
  );
  return p;
}

/** Find a dashboard by id, falling back to an exact name match. */
export function findDashboard(state: DashboardsState, ref: string): Dashboard | undefined {
  return (
    state.dashboards.find((d) => d.id === ref) ?? state.dashboards.find((d) => d.name === ref)
  );
}
