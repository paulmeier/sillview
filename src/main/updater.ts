/**
 * Sillview app self-update.
 *
 * This is the updater for the *desktop app itself* — not the bundled kasas
 * backend (that lives in ./kasas/updater.ts and drives the kasas CLI's own
 * self-update). Here we lean on Electron's built-in `autoUpdater` via
 * `update-electron-app`, which talks to the free hosted update service at
 * https://update.electronjs.org. That service reads our published GitHub
 * Releases (paulmeier/sillview) and feeds the right artifact to Squirrel:
 *   - macOS  → Squirrel.Mac consumes the release `.zip`
 *   - Windows → Squirrel.Windows consumes `RELEASES` + the `.nupkg`
 * Both are already produced by our makers (forge.config.ts) and attached to
 * each release by the build workflow, so no publishing changes are needed.
 *
 * The update is downloaded in the background; when it's ready the user gets a
 * native "Restart to update" prompt. No more downloading a DMG and dragging it
 * into /Applications by hand.
 *
 * Caveats (intentionally non-fatal — the updater just no-ops):
 *   - Dev runs (`npm start`) are skipped: `update-electron-app` aborts unless
 *     the app is packaged.
 *   - Linux is skipped: Electron's autoUpdater supports only macOS + Windows;
 *     Linux users update via their package manager (.deb/.rpm).
 *   - macOS auto-update requires a CODE-SIGNED app. Our release builds are
 *     currently unsigned (forge.config.ts leaves osxSign off), so Squirrel.Mac
 *     will refuse to apply the update with "Could not get code signature for
 *     running application". The check still runs and logs the error harmlessly;
 *     auto-update on macOS starts working the moment signing is enabled.
 */

import { app } from 'electron';
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';

/** owner/repo whose GitHub Releases the update service watches. */
const REPO = 'paulmeier/sillview';

/**
 * Wire up background auto-updates. Safe to call unconditionally on startup —
 * `update-electron-app` self-guards dev builds and unsupported platforms, so
 * this is a no-op outside packaged macOS/Windows builds.
 */
export function initAppUpdater(): void {
  updateElectronApp({
    updateSource: {
      type: UpdateSourceType.ElectronPublicUpdateService,
      repo: REPO,
    },
    // Check on launch and then hourly. The default (10 min) is needlessly
    // chatty for a desktop dashboard that stays open for long stretches.
    updateInterval: '1 hour',
    // Route the updater's chatter through our existing `[sillview]` log prefix.
    logger: {
      log: (m: string) => console.log(`[sillview:update] ${m}`),
      info: (m: string) => console.log(`[sillview:update] ${m}`),
      warn: (m: string) => console.warn(`[sillview:update] ${m}`),
      error: (m: string) => console.error(`[sillview:update] ${m}`),
    },
    // Show the native "A new version is ready — Restart / Later" prompt once the
    // update has finished downloading in the background.
    notifyUser: true,
  });

  if (!app.isPackaged) {
    console.log('[sillview:update] dev build — auto-update disabled');
  }
}
