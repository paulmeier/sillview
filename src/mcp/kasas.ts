/**
 * Minimal, read-only kasas client for the MCP server's discovery tools
 * (list_accounts, list_market_series). It exists so an LLM can look up the real
 * account ids and market series ids that the configurable widgets need, instead
 * of guessing and producing widgets that render empty.
 *
 * Mirrors the main-process broker (src/main/kasas/http.ts): loopback only, Bearer
 * auth, errors-as-data. The connection (base URL + token) is resolved from, in
 * order: env vars, then sillview's backend.json (where the app persists the
 * generated dashboard token + port). kasas must be running for these to work; we
 * degrade gracefully when it isn't.
 */

import { promises as fs } from 'node:fs';
import { backendStatePath } from './paths';

export interface KasasConnection {
  baseUrl: string;
  token: string;
}

interface BackendStateFile {
  settings?: { port?: number };
  token?: string;
}

/**
 * Resolve where kasas is and how to authenticate. KASAS_BASE_URL / KASAS_TOKEN
 * win; otherwise read sillview's backend.json (port + token) and default to the
 * loopback port 8080. Returns null when no token/port can be determined.
 */
export async function resolveConnection(): Promise<KasasConnection | null> {
  const envBase = process.env.KASAS_BASE_URL;
  const envToken = process.env.KASAS_TOKEN;
  if (envBase) return { baseUrl: envBase, token: envToken ?? '' };

  let parsed: BackendStateFile = {};
  try {
    parsed = JSON.parse(await fs.readFile(backendStatePath(), 'utf8')) as BackendStateFile;
  } catch {
    // No backend.json yet (app never launched). Fall back to defaults; the
    // request will simply fail-soft if kasas isn't reachable.
  }
  // Sanitize the port read from backend.json before it reaches the request URL:
  // coerce to a bounded TCP port integer (default 8080 on anything invalid). The
  // host is fixed to loopback, so this fully constrains the file-derived part of
  // the destination — and tolerates a corrupt backend.json.
  const token = envToken ?? parsed.token ?? '';
  return { baseUrl: `http://127.0.0.1:${toPort(parsed.settings?.port)}`, token };
}

/** Coerce an untrusted value to a valid TCP port (1-65535), else the default. */
function toPort(value: unknown): number {
  const port = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : 8080;
}

export interface KasasFetch<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

/** GET a kasas JSON endpoint. Never throws — connection errors come back as data. */
export async function kasasGet<T>(conn: KasasConnection, path: string): Promise<KasasFetch<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (conn.token) headers.Authorization = `Bearer ${conn.token}`;
  try {
    const res = await fetch(new URL(path, conn.baseUrl).toString(), { headers });
    const text = await res.text();
    let data: unknown;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok) {
      const message =
        data && typeof data === 'object' && 'error' in data
          ? String((data as { error: unknown }).error)
          : res.statusText || `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: message };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}
