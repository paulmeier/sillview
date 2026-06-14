/**
 * Fetches the community widget registry (the `sillview-widgets` repo's
 * registry/index.json). This runs in the MAIN process — the renderer's production
 * CSP forbids fetching `raw.githubusercontent.com` directly, exactly as kasas REST
 * is brokered in `kasas/http.ts`. Like that broker, it NEVER throws: a failure
 * (offline, 404, bad JSON, unsupported schema) comes back as `{ ok: false, error }`.
 *
 * Electron-free on purpose (only Node `fetch` + shared types), so the standalone
 * MCP server can reuse `fetchRegistry` too.
 */

import {
  DEFAULT_REGISTRY_URL,
  WIDGET_REGISTRY_SCHEMA_VERSION,
  type RegistryIndex,
  type WidgetRegistryResult,
} from '../../shared/widget-registry';
import { mockRegistryIndex } from './mock-registry';

const MAX_BYTES = 5 * 1024 * 1024; // generous for a metadata catalog; tight enough to bound abuse
const TIMEOUT_MS = 10_000;
const MOCK = process.env.KASAS_MOCK === '1';

/** The configured registry URL (env override for dev/testing; default is canonical). */
export function registryUrl(): string {
  return process.env.SILLVIEW_WIDGET_REGISTRY_URL || DEFAULT_REGISTRY_URL;
}

/**
 * Read a response body to a string, aborting once it exceeds `max` bytes so a
 * response WITHOUT a content-length (chunked) can't buffer unbounded. Falls back to
 * `res.text()` when the body isn't a stream (e.g. a mocked Response in tests).
 */
async function readCapped(res: Response, max: number): Promise<string | null> {
  const reader = res.body?.getReader?.();
  if (!reader) {
    const text = await res.text();
    return text.length > max ? null : text;
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      received += value.byteLength;
      if (received > max) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks).toString('utf8');
}

let cached: RegistryIndex | null = null;

/** The last successfully fetched index, if any (no network). */
export function getCachedRegistry(): RegistryIndex | null {
  return cached;
}

/**
 * Fetch (and cache) the registry. Returns the cached copy on subsequent calls
 * unless `force` is true. Under KASAS_MOCK it returns the offline fixture.
 */
export async function fetchRegistry(force = false): Promise<WidgetRegistryResult> {
  if (MOCK) {
    cached = mockRegistryIndex();
    return { ok: true, index: cached };
  }
  if (cached && !force) return { ok: true, index: cached };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(registryUrl(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { ok: false, error: `registry returned HTTP ${res.status}` };

    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared && declared > MAX_BYTES) return { ok: false, error: 'registry is too large' };
    const text = await readCapped(res, MAX_BYTES);
    if (text === null) return { ok: false, error: 'registry is too large' };

    let data: RegistryIndex;
    try {
      data = JSON.parse(text) as RegistryIndex;
    } catch {
      return { ok: false, error: 'registry is not valid JSON' };
    }
    if (data.schema_version !== WIDGET_REGISTRY_SCHEMA_VERSION) {
      return {
        ok: false,
        error: `unsupported registry schema_version ${data.schema_version} (this app supports ${WIDGET_REGISTRY_SCHEMA_VERSION}; update sillview)`,
      };
    }
    if (!Array.isArray(data.widgets)) {
      return { ok: false, error: 'malformed registry (missing widgets array)' };
    }
    cached = data;
    return { ok: true, index: data };
  } catch (err) {
    // Abort, DNS failure, connection refused, offline, etc.
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}
