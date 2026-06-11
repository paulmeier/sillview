/**
 * The kasas REST broker (main process). Uses Node's global `fetch` (Electron 42
 * ships a modern Node), so there is no CORS preflight — that is the whole reason
 * this lives in main rather than the renderer.
 */

import type { ConnectionConfig, KasasRequest, KasasResult } from '../../shared/ipc';

function buildUrl(conn: ConnectionConfig, req: KasasRequest): string {
  // `path` is absolute ('/api/v1/...'); resolve it against the configured base.
  const url = new URL(req.path, conn.baseUrl);
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function kasasRequest<T = unknown>(
  conn: ConnectionConfig,
  req: KasasRequest,
): Promise<KasasResult<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (conn.token) headers.Authorization = `Bearer ${conn.token}`;

  let body: string | undefined;
  if (req.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(req.body);
  }

  try {
    const res = await fetch(buildUrl(conn, req), { method: req.method, headers, body });
    const text = await res.text();

    let data: unknown;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text; // non-JSON body (e.g. plain-text health checks)
      }
    }

    if (!res.ok) {
      // kasas reports errors as {"error":"..."}; fall back to the status text.
      const message =
        data && typeof data === 'object' && 'error' in data
          ? String((data as { error: unknown }).error)
          : res.statusText || `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: message, data: data as T };
    }

    return { ok: true, status: res.status, data: data as T };
  } catch (err) {
    // Connection refused, DNS failure, abort, etc. — kasas not running, usually.
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
