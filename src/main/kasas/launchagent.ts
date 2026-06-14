/**
 * macOS LaunchAgent management for running kasas as a persistent background
 * daemon (runs at login, restarts on crash via KeepAlive, survives the app
 * closing). The plist runs the managed kasas binary directly — not the Electron
 * app — so it stays lightweight.
 */

import { execFile } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { kasasLogDir } from './paths';

const execFileP = promisify(execFile);

export const LABEL = 'sh.kasas.sillview';

/**
 * The background daemon is implemented with macOS LaunchAgents, so it's only
 * available on darwin. Off macOS, kasas runs as a normal managed child process
 * and the "Background" feature is hidden (Windows Scheduled Task / Linux systemd
 * user unit equivalents are a follow-up).
 */
export const supported = process.platform === 'darwin';

function plistPath(): string {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
}

function uid(): number {
  return process.getuid ? process.getuid() : 0;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderPlist(binary: string, configPath: string): string {
  const out = path.join(kasasLogDir(), 'daemon.out.log');
  const err = path.join(kasasLogDir(), 'daemon.err.log');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(binary)}</string>
    <string>-config</string>
    <string>${xmlEscape(configPath)}</string>
    <string>serve</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${xmlEscape(out)}</string>
  <key>StandardErrorPath</key><string>${xmlEscape(err)}</string>
</dict>
</plist>
`;
}

async function bootout(): Promise<void> {
  await execFileP('launchctl', ['bootout', `gui/${uid()}/${LABEL}`]);
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Poll until the agent is fully booted out. `launchctl bootout` is asynchronous
 * — launchd tears the job down in the background — so a bootstrap fired right
 * after it can race the dying instance (which still holds the port) and fail,
 * leaving nothing loaded. Wait for the old job to disappear first.
 */
async function waitUntilInactive(timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isActive())) return;
    await delay(200);
  }
}

/** Write the plist and load it into launchd (replacing any stale instance). */
export async function install(binary: string, configPath: string): Promise<void> {
  const p = plistPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, renderPlist(binary, configPath), 'utf8');
  await bootout().catch(() => undefined); // ignore "not loaded"
  await waitUntilInactive(); // don't let bootstrap race the dying old instance
  await execFileP('launchctl', ['bootstrap', `gui/${uid()}`, p]);
}

/** Unload from launchd and remove the plist. */
export async function uninstall(): Promise<void> {
  await bootout().catch(() => undefined);
  const p = plistPath();
  if (existsSync(p)) await fs.rm(p, { force: true });
}

/** Reload an already-installed agent (after the config file changes). */
export async function reload(): Promise<void> {
  const p = plistPath();
  if (!existsSync(p)) return;
  // The plist itself is unchanged here — only config.toml did — so restart the
  // running job in place. `kickstart -k` atomically kills and re-execs it
  // (re-reading config.toml). Unlike bootout+bootstrap there's no window where
  // the daemon is unloaded and no race where bootstrap fires before the old
  // instance frees the port — which used to leave the daemon dead on save.
  if (await isActive()) {
    await execFileP('launchctl', ['kickstart', '-k', `gui/${uid()}/${LABEL}`]);
    return;
  }
  // Not loaded (e.g. it was booted out from under us) — load it fresh.
  await execFileP('launchctl', ['bootstrap', `gui/${uid()}`, p]);
}

export function isInstalled(): boolean {
  return existsSync(plistPath());
}

export async function isActive(): Promise<boolean> {
  try {
    await execFileP('launchctl', ['print', `gui/${uid()}/${LABEL}`]);
    return true;
  } catch {
    return false;
  }
}
