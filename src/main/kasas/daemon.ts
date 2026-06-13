/**
 * Cross-platform "keep kasas running in the background" support. Picks the
 * service backend that fits the current OS — macOS LaunchAgent or Linux systemd
 * user unit — and exposes one uniform interface so the manager (and the rest of
 * the app) never has to branch on platform. Windows (a Scheduled Task) is a
 * follow-up; until then `supported` is false there and the feature is hidden.
 */

import * as launchAgent from './launchagent';
import * as systemd from './systemd';

export type DaemonKind = 'launchd' | 'systemd';

interface DaemonBackend {
  supported: boolean;
  LABEL: string;
  install(binary: string, configPath: string): Promise<void>;
  uninstall(): Promise<void>;
  reload(): Promise<void>;
  isInstalled(): boolean;
  isActive(): Promise<boolean>;
}

const active: DaemonBackend | null = launchAgent.supported
  ? launchAgent
  : systemd.supported
    ? systemd
    : null;

/** Whether a background daemon backend exists for this platform. */
export const supported = active !== null;

/** Which service mechanism is in play (used for platform-accurate UI copy). */
export const kind: DaemonKind | null = launchAgent.supported
  ? 'launchd'
  : systemd.supported
    ? 'systemd'
    : null;

/** The agent/unit identifier, or '' when unsupported. */
export const label = active?.LABEL ?? '';

export async function install(binary: string, configPath: string): Promise<void> {
  if (active) await active.install(binary, configPath);
}

export async function uninstall(): Promise<void> {
  if (active) await active.uninstall();
}

export async function reload(): Promise<void> {
  if (active) await active.reload();
}

export function isInstalled(): boolean {
  return active?.isInstalled() ?? false;
}

export async function isActive(): Promise<boolean> {
  return active ? active.isActive() : false;
}
