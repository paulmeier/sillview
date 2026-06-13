/**
 * Saved-dashboard persistence: one JSON file in userData holding the renderer's
 * serialized dashboard store. This is the durable home for "dashboards users can
 * save" — the renderer's Zustand `persist` store reads/writes it through IPC.
 */

import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { MOCK, mockDashboardsFile } from '../kasas/mock';

function file(): string {
  return path.join(app.getPath('userData'), 'dashboards.json');
}

export async function loadDashboards(): Promise<string | null> {
  try {
    return await fs.readFile(file(), 'utf8');
  } catch {
    // First run — no saved file. Under mock mode, seed a demo board so the
    // Market Data widgets have something to render offline; otherwise the
    // renderer falls back to its built-in starter dashboard.
    return MOCK ? mockDashboardsFile() : null;
  }
}

export async function saveDashboards(contents: string): Promise<void> {
  await fs.writeFile(file(), contents, 'utf8');
}
