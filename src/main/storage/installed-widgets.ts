/**
 * Installed-widgets persistence: one JSON file in userData recording which
 * marketplace widgets the user has installed. Only an installed widget can be added
 * to a dashboard (the "Add widget" panel offers installed widgets; the marketplace
 * page installs/uninstalls them).
 *
 * Mirrors `storage/dashboards.ts`: atomic temp+rename writes so a reader never sees
 * a half-written file, a `lastSeen` guard so our own saves don't echo, and a
 * directory watcher so an external writer (the MCP server's install_widget tool)
 * triggers a live reload in the renderer. On first run — no file yet — we seed the
 * recommended core set so the Add panel isn't empty (per the marketplace plan).
 */

import { app } from 'electron';
import { promises as fs, watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import {
  parseInstalledFile,
  serializeInstalledFile,
  seedInstalled,
  type InstalledWidget,
} from '../../shared/widget-registry';

const FILE_NAME = 'installed-widgets.json';

function dir(): string {
  return app.getPath('userData');
}
function file(): string {
  return path.join(dir(), FILE_NAME);
}

/** The contents we last read or wrote, so the watcher can skip our own saves. */
let lastSeen: string | null = null;

/**
 * Load the installed widgets, returning the recommended core on first run.
 *
 * Seeding does NOT write here: the file is created on the first install/uninstall.
 * That keeps a read off the write path (no two-process race, no watcher re-trigger)
 * and — critically — means a *transient* read error can never clobber a real
 * install list with the seed. Only a genuinely missing file (ENOENT) seeds; any
 * other error propagates so the caller surfaces it instead of silently resetting.
 */
export async function loadInstalled(): Promise<InstalledWidget[]> {
  try {
    const contents = await fs.readFile(file(), 'utf8');
    lastSeen = contents;
    return parseInstalledFile(contents);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return seedInstalled(new Date().toISOString());
    }
    throw err;
  }
}

/** Persist the installed widgets (atomic temp+rename). */
export async function saveInstalled(list: InstalledWidget[]): Promise<void> {
  const contents = serializeInstalledFile(list);
  lastSeen = contents;
  const tmp = path.join(dir(), `.${FILE_NAME}.${process.pid}.tmp`);
  await fs.writeFile(tmp, contents, 'utf8');
  await fs.rename(tmp, file());
}

/**
 * Watch installed-widgets.json for writes made OUTSIDE the app (e.g. the MCP
 * server) and invoke `onChange` when the on-disk contents differ from what we last
 * read/wrote. Watches the directory (survives temp+rename), debounced, best-effort.
 */
export function watchInstalled(onChange: () => void): FSWatcher | null {
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
