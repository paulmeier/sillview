/**
 * Installed-widgets access for the MCP server. Reads (and writes) the same
 * installed-widgets.json the Electron app uses, from the resolved userData dir
 * (see paths.ts). A widget must be installed before it can be added to a dashboard
 * — the gate the in-app "Add widget" panel enforces, mirrored here so an LLM can't
 * place a widget the user hasn't installed.
 *
 * The registry fetch is reused from the main process's electron-free
 * registry-client, so install_widget validates the slug against the real catalog.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { userDataDir } from './paths';
import {
  installedFromRegistry,
  parseInstalledFile,
  seedInstalled,
  serializeInstalledFile,
  type InstalledWidget,
  type RegistryWidget,
} from '../shared/widget-registry';
import { fetchRegistry } from '../main/widgets/registry-client';

function installedPath(): string {
  return path.join(userDataDir(), 'installed-widgets.json');
}

/** Read the installed widgets, seeding the recommended core if the file is absent. */
export async function readInstalled(): Promise<InstalledWidget[]> {
  try {
    const raw = await fs.readFile(installedPath(), 'utf8');
    return parseInstalledFile(raw);
  } catch {
    // Match the app's first-run behavior so the MCP sees the same seeded set.
    return seedInstalled(new Date().toISOString());
  }
}

/** The set of installed widget types (the unit the dashboard gates on). */
export async function installedTypes(): Promise<Set<string>> {
  return new Set((await readInstalled()).map((w) => w.widget_type));
}

async function writeInstalled(list: InstalledWidget[]): Promise<void> {
  const dir = userDataDir();
  await fs.mkdir(dir, { recursive: true });
  const contents = serializeInstalledFile(list);
  const tmp = path.join(dir, `.installed-widgets.mcp.${process.pid}.tmp`);
  await fs.writeFile(tmp, contents, 'utf8');
  await fs.rename(tmp, installedPath());
}

/** Fetch the registry catalog (throws with a clear message on failure). */
export async function listAvailable(): Promise<RegistryWidget[]> {
  const res = await fetchRegistry();
  if (!res.ok || !res.index) {
    throw new Error(res.error ? `Could not reach the widget registry: ${res.error}` : 'registry unavailable');
  }
  return res.index.widgets;
}

/** Install a widget by slug (idempotent): look it up in the registry, record it. */
export async function installWidget(slug: string): Promise<InstalledWidget[]> {
  const catalog = await listAvailable();
  const entry = catalog.find((w) => w.name === slug);
  if (!entry) throw new Error(`Widget "${slug}" is not in the registry.`);
  const current = await readInstalled();
  const next = [
    ...current.filter((w) => w.slug !== slug),
    installedFromRegistry(entry, new Date().toISOString()),
  ];
  await writeInstalled(next);
  return next;
}

/** Uninstall a widget by slug. */
export async function uninstallWidget(slug: string): Promise<InstalledWidget[]> {
  const current = await readInstalled();
  const next = current.filter((w) => w.slug !== slug);
  await writeInstalled(next);
  return next;
}
