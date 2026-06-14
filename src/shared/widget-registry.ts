/**
 * The widget marketplace contract — pure, serializable, React-free.
 *
 * sillview consumes an external community registry (the `sillview-widgets` repo) to
 * decide which widgets a user may add to a dashboard. This file defines:
 *   - `RegistryIndex` / `RegistryWidget`: the shape of that repo's registry/index.json.
 *   - `InstalledWidget`: what sillview records locally once a user installs a widget.
 *
 * It lives in `src/shared/` (no React, no Electron, no DOM) so the renderer, the
 * Electron main process, AND the standalone MCP server can all import it. The
 * actual network fetch happens in the MAIN process (the renderer's CSP forbids
 * direct fetches); see `src/main/widgets/registry-client.ts`.
 */

import type { WidgetSize, WidgetConfigSpec } from './widgets';

/** Bump only if `sillview-widgets` ships a breaking index format. Older apps refuse newer. */
export const WIDGET_REGISTRY_SCHEMA_VERSION = 1;

/** Canonical catalog endpoint (the committed file on the registry repo's main branch). */
export const DEFAULT_REGISTRY_URL =
  'https://raw.githubusercontent.com/paulmeier/sillview-widgets/main/registry/index.json';

/**
 * The widget payload model. Only `builtin` is supported today: the widget's React
 * implementation ships compiled into sillview, keyed by `widget_type`, and the
 * registry entry merely gates which built-ins a user may add. `spec` and `bundle`
 * are reserved so the format can grow without a break.
 */
export type WidgetKind = 'builtin' | 'spec' | 'bundle';

/** One file in a registry widget directory, with its integrity hash. */
export interface RegistryFile {
  path: string;
  sha256: string;
  size: number;
}

/** One widget as published in `registry/index.json`. */
export interface RegistryWidget {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepage: string;
  kind: WidgetKind;
  /** For `builtin`, the compiled-in sillview widget type to render. */
  widget_type: string;
  category: string;
  icon: string;
  tags: string[];
  tier: string;
  default_size: WidgetSize;
  config: WidgetConfigSpec[];
  path: string;
  files: RegistryFile[];
  content_hash: string;
  size_bytes: number;
}

/** The top-level registry document the app fetches. */
export interface RegistryIndex {
  schema_version: number;
  generated_at: string;
  repository: string;
  widgets: RegistryWidget[];
}

/** Result of a registry fetch. Never throws across IPC — errors are data. */
export interface WidgetRegistryResult {
  ok: boolean;
  index?: RegistryIndex;
  error?: string;
}

/**
 * A widget the user has installed. Kept deliberately small — for a `builtin` the
 * app already has the full metadata + component compiled in (keyed by
 * `widget_type`), so the install record only needs to mark the widget unlocked and
 * remember which version was installed (to surface "update available").
 */
export interface InstalledWidget {
  slug: string;
  widget_type: string;
  version: string;
  /** ISO-8601 timestamp. */
  installedAt: string;
}

/** The on-disk envelope for installed-widgets.json. */
export interface InstalledWidgetsFile {
  version: number;
  installed: InstalledWidget[];
}

/** Format version of installed-widgets.json. */
export const INSTALLED_FILE_VERSION = 1;

/**
 * Widgets pre-installed on first run so a new user's "Add widget" panel is not
 * empty. The rest are install-gated through the marketplace.
 */
export const RECOMMENDED_CORE: readonly string[] = [
  'net-worth',
  'accounts-list',
  'transactions',
  'sync-status',
];

/** Map a registry entry to an install record. */
export function installedFromRegistry(w: RegistryWidget, at: string): InstalledWidget {
  return { slug: w.name, widget_type: w.widget_type, version: w.version, installedAt: at };
}

/** The seed install set written on first run (no installed-widgets.json yet). */
export function seedInstalled(at: string): InstalledWidget[] {
  return RECOMMENDED_CORE.map((slug) => ({
    slug,
    widget_type: slug,
    version: '1.0.0',
    installedAt: at,
  }));
}

/** Parse installed-widgets.json, tolerating a bare array or a missing/garbage file. */
export function parseInstalledFile(raw: string | null): InstalledWidget[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as InstalledWidgetsFile).installed)
      ? (data as InstalledWidgetsFile).installed
      : [];
  const out: InstalledWidget[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const w = item as Partial<InstalledWidget>;
    if (typeof w.slug !== 'string' || typeof w.widget_type !== 'string') continue;
    if (seen.has(w.slug)) continue;
    seen.add(w.slug);
    out.push({
      slug: w.slug,
      widget_type: w.widget_type,
      version: typeof w.version === 'string' ? w.version : '0.0.0',
      installedAt: typeof w.installedAt === 'string' ? w.installedAt : '',
    });
  }
  return out;
}

/** Serialize installed widgets to the stable on-disk envelope. */
export function serializeInstalledFile(installed: InstalledWidget[]): string {
  const sorted = [...installed].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const file: InstalledWidgetsFile = { version: INSTALLED_FILE_VERSION, installed: sorted };
  return JSON.stringify(file, null, 2) + '\n';
}
