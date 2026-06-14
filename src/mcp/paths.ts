/**
 * Resolve sillview's userData directory from PLAIN NODE — the MCP server runs as
 * its own process and cannot use Electron's `app.getPath('userData')`.
 *
 * Defaults match a packaged build (productName "Sillview"). Two escape hatches:
 *   - SILLVIEW_DATA_DIR — absolute path to the userData dir (overrides everything).
 *   - SILLVIEW_APP_NAME — the app-name segment (default "Sillview"). Set this to
 *     "Electron" when pointing at a dev build (`npm start`), which runs the bare
 *     Electron runtime and therefore uses the "Electron" userData dir.
 */

import os from 'node:os';
import path from 'node:path';

const APP_NAME = process.env.SILLVIEW_APP_NAME || 'Sillview';

/** Electron's per-user app-data root, per platform. */
function appDataDir(): string {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support');
  }
  if (process.platform === 'win32') {
    return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  }
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
}

/** The sillview userData directory (where dashboards.json + backend.json live). */
export function userDataDir(): string {
  const override = process.env.SILLVIEW_DATA_DIR;
  if (override) return override;
  return path.join(appDataDir(), APP_NAME);
}

export function dashboardsPath(): string {
  return path.join(userDataDir(), 'dashboards.json');
}

export function backendStatePath(): string {
  return path.join(userDataDir(), 'backend.json');
}
