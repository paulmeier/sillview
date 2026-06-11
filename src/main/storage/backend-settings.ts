/**
 * Persistence for the managed-backend settings + the generated kasas dashboard
 * token. Stored as JSON in userData, following the same pattern as settings.ts.
 */

import { app } from 'electron';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { KasasSettings } from '../../shared/ipc';

export interface BackendState {
  settings: KasasSettings;
  /** Random bearer token shared between the managed kasas and our broker. */
  token: string;
}

export function defaultSettings(): KasasSettings {
  return {
    mode: 'bundled',
    port: 8080,
    logLevel: 'info',
    background: false,
    sync: { enabled: true, interval: '1h', runOnStart: true, lookbackDays: 90 },
  };
}

function newToken(): string {
  return randomUUID().replace(/-/g, '');
}

function file(): string {
  return path.join(app.getPath('userData'), 'backend.json');
}

export async function loadBackendState(): Promise<BackendState> {
  const defaults = defaultSettings();
  try {
    const parsed = JSON.parse(await fs.readFile(file(), 'utf8')) as Partial<BackendState>;
    return {
      settings: {
        ...defaults,
        ...parsed.settings,
        sync: { ...defaults.sync, ...parsed.settings?.sync },
      },
      token: parsed.token || newToken(),
    };
  } catch {
    return { settings: defaults, token: newToken() };
  }
}

export async function saveBackendState(state: BackendState): Promise<void> {
  await fs.writeFile(file(), JSON.stringify(state, null, 2), 'utf8');
}
