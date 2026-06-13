/**
 * Linux systemd user-unit management for running kasas as a persistent
 * background daemon (runs at login, restarts on crash via Restart=always,
 * survives the app closing). The unit runs the managed kasas binary directly —
 * not the Electron app — so it stays lightweight. This is the Linux equivalent
 * of the macOS LaunchAgent (see launchagent.ts) and exposes the same interface.
 */

import { execFile } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

/** The systemd user unit name (kept stable so we can find/replace it). */
export const LABEL = 'kasas-sillview.service';

/**
 * Only available on Linux with a booted systemd (the standard marker is
 * /run/systemd/system). Off systemd — or on other platforms — kasas runs as a
 * normal managed child process and the "Background" feature is hidden.
 */
export const supported = process.platform === 'linux' && existsSync('/run/systemd/system');

function unitDir(): string {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'systemd', 'user');
}

function unitPath(): string {
  return path.join(unitDir(), LABEL);
}

/** `systemctl --user <args>` — most calls are best-effort (see callers). */
function systemctl(...args: string[]): Promise<unknown> {
  return execFileP('systemctl', ['--user', ...args]);
}

/**
 * Quote a path for a systemd ExecStart= line. systemd splits the command on
 * whitespace, so any path containing spaces must be double-quoted; embedded
 * quotes/backslashes are escaped per systemd's C-style unquoting rules.
 */
function sdQuote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function renderUnit(binary: string, configPath: string): string {
  const workingDir = path.dirname(configPath);
  return `[Unit]
Description=kasas (managed by sillview)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${sdQuote(binary)} -config ${sdQuote(configPath)} serve
WorkingDirectory=${sdQuote(workingDir)}
Restart=always
RestartSec=2

[Install]
WantedBy=default.target
`;
}

/** Write the unit and enable+start it (replacing any stale instance). */
export async function install(binary: string, configPath: string): Promise<void> {
  const p = unitPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, renderUnit(binary, configPath), 'utf8');
  await systemctl('daemon-reload');
  // Best-effort: keep the unit running across logout / start it at boot. This
  // is permitted for one's own user on most systemd setups; if policy denies
  // it, the session-scoped unit still works while logged in.
  await execFileP('loginctl', ['enable-linger']).catch(() => undefined);
  await systemctl('enable', '--now', LABEL);
}

/** Stop, disable, and remove the unit. */
export async function uninstall(): Promise<void> {
  await systemctl('disable', '--now', LABEL).catch(() => undefined);
  const p = unitPath();
  if (existsSync(p)) await fs.rm(p, { force: true });
  await systemctl('daemon-reload').catch(() => undefined);
  await execFileP('loginctl', ['disable-linger']).catch(() => undefined);
}

/** Restart an already-installed unit (after the config file changes). */
export async function reload(): Promise<void> {
  if (!existsSync(unitPath())) return;
  await systemctl('daemon-reload').catch(() => undefined);
  await systemctl('restart', LABEL).catch(() => undefined);
}

export function isInstalled(): boolean {
  return existsSync(unitPath());
}

export async function isActive(): Promise<boolean> {
  try {
    await systemctl('is-active', '--quiet', LABEL);
    return true;
  } catch {
    return false;
  }
}
