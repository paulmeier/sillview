/**
 * Connection config persistence: a small JSON file in the app's userData dir.
 * Env vars (KASAS_BASE_URL / KASAS_TOKEN) override the built-in default, which is
 * handy in dev. A saved file always wins over the env default.
 */

import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ConnectionConfig } from '../../shared/ipc';

function defaults(): ConnectionConfig {
  return {
    baseUrl: process.env.KASAS_BASE_URL ?? 'http://127.0.0.1:8080',
    token: process.env.KASAS_TOKEN ?? '',
  };
}

function file(): string {
  return path.join(app.getPath('userData'), 'connection.json');
}

export async function loadConnection(): Promise<ConnectionConfig> {
  try {
    const raw = await fs.readFile(file(), 'utf8');
    return { ...defaults(), ...(JSON.parse(raw) as Partial<ConnectionConfig>) };
  } catch {
    return defaults();
  }
}

export async function saveConnection(conn: ConnectionConfig): Promise<void> {
  await fs.writeFile(file(), JSON.stringify(conn, null, 2), 'utf8');
}
