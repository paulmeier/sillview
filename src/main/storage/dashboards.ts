/**
 * Saved-dashboard persistence: one JSON file in userData holding the renderer's
 * serialized dashboard store. This is the durable home for "dashboards users can
 * save" — the renderer's Zustand `persist` store reads/writes it through IPC, and
 * the standalone MCP server (src/mcp) writes the same file directly.
 *
 * Because an external writer (the MCP server) can change the file behind the
 * running app, we (a) write atomically (temp + rename) so a reader never sees a
 * half-written file, and (b) expose `watchDashboards` so main can tell the
 * renderer to reload. Our own saves are ignored via a last-written-content guard.
 */

import { app } from 'electron';
import { promises as fs, watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { MOCK, mockDashboardsFile } from '../kasas/mock';

const FILE_NAME = 'dashboards.json';

function dir(): string {
  return app.getPath('userData');
}
function file(): string {
  return path.join(dir(), FILE_NAME);
}

/** The contents we last read or wrote, so the watcher can skip our own saves. */
let lastSeen: string | null = null;

export async function loadDashboards(): Promise<string | null> {
  try {
    const contents = await fs.readFile(file(), 'utf8');
    lastSeen = contents;
    return contents;
  } catch {
    // First run — no saved file. Under mock mode, seed a demo board so the
    // Market Data widgets have something to render offline; otherwise the
    // renderer falls back to its built-in starter dashboard.
    return MOCK ? mockDashboardsFile() : null;
  }
}

export async function saveDashboards(contents: string): Promise<void> {
  lastSeen = contents;
  // Atomic write: write a temp file, then rename over the target. rename(2) is
  // atomic on the same filesystem, so a concurrent reader (or the MCP server)
  // never observes a truncated file.
  const tmp = path.join(dir(), `.${FILE_NAME}.${process.pid}.tmp`);
  await fs.writeFile(tmp, contents, 'utf8');
  await fs.rename(tmp, file());
}

/**
 * Watch dashboards.json for writes made OUTSIDE the app and invoke `onChange`
 * when the on-disk contents differ from what we last read/wrote. Watches the
 * directory (not the file) so it survives the temp+rename an atomic writer uses.
 * Debounced; the app's own saves are filtered out by content comparison. Best
 * effort — returns null (and the app still works) if the platform can't watch.
 */
export function watchDashboards(onChange: () => void): FSWatcher | null {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const watcher = watch(dir(), (_event, name) => {
      if (name && name !== FILE_NAME) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void (async () => {
          let contents: string | null = null;
          try {
            contents = await fs.readFile(file(), 'utf8');
          } catch {
            return; // file vanished mid-rename; ignore
          }
          if (contents === lastSeen) return; // our own save echoing back
          lastSeen = contents;
          onChange();
        })();
      }, 150);
    });
    return watcher;
  } catch {
    return null;
  }
}
