/**
 * Filesystem layout for the managed kasas backend, plus first-run copying of the
 * bundled binary to a stable, writable location.
 *
 * The binary ships inside the app (dev: resources/bin, packaged:
 * process.resourcesPath/bin) but we run it from userData/kasas/bin so the path is
 * writable and stable across app moves — and so the LaunchAgent can reference it.
 */

import { app } from 'electron';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';

export function kasasDataDir(): string {
  return path.join(app.getPath('userData'), 'kasas');
}
export function kasasConfigPath(): string {
  return path.join(kasasDataDir(), 'config.toml');
}
export function kasasDbPath(): string {
  return path.join(kasasDataDir(), 'kasas.db');
}
export function kasasSecretsPath(): string {
  return path.join(kasasDataDir(), 'secrets.json');
}
export function kasasLogDir(): string {
  return path.join(kasasDataDir(), 'logs');
}
export function managedBinaryPath(): string {
  return path.join(kasasDataDir(), 'bin', 'kasas');
}

/** Where the bundled kasas binary ships (dev vs packaged). */
export function bundledBinaryPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'bin', 'kasas')
    : path.join(app.getAppPath(), 'resources', 'bin', 'kasas');
}

export function bundledBinaryExists(): boolean {
  return existsSync(bundledBinaryPath()) || existsSync(managedBinaryPath());
}

/**
 * Ensure the data/log dirs exist and a runnable kasas binary is present at the
 * stable managed path. Copies the bundled binary on first run or app-version
 * change. Returns the runnable path, or null if no bundled binary is available
 * (i.e. `npm run sync:kasas` was never run).
 */
export async function ensureBinary(): Promise<string | null> {
  await fs.mkdir(path.join(kasasDataDir(), 'bin'), { recursive: true });
  await fs.mkdir(kasasLogDir(), { recursive: true });

  const bundled = bundledBinaryPath();
  const dest = managedBinaryPath();

  if (!existsSync(bundled)) {
    return existsSync(dest) ? dest : null;
  }

  const marker = path.join(kasasDataDir(), 'bin', '.version');
  const version = app.getVersion();
  let needCopy = !existsSync(dest);
  if (!needCopy) {
    try {
      needCopy = (await fs.readFile(marker, 'utf8')) !== version;
    } catch {
      needCopy = true;
    }
  }
  if (needCopy) {
    await fs.copyFile(bundled, dest);
    await fs.chmod(dest, 0o755);
    await fs.writeFile(marker, version, 'utf8');
  }
  return dest;
}
