import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRegistry } from './registry-client';

// A minimal stand-in for the parts of Response that registry-client reads.
function fakeResponse(opts: {
  ok?: boolean;
  status?: number;
  body?: string;
  contentLength?: number;
}) {
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers: { get: (h: string) => (h === 'content-length' && opts.contentLength ? String(opts.contentLength) : null) },
    text: async () => opts.body ?? '',
  };
}

const validIndex = JSON.stringify({
  schema_version: 1,
  generated_at: '2026-01-01T00:00:00.000Z',
  repository: 'https://example.com/repo',
  widgets: [{ name: 'net-worth' }],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchRegistry', () => {
  it('returns the parsed index on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse({ body: validIndex })));
    const res = await fetchRegistry(true);
    expect(res.ok).toBe(true);
    expect(res.index?.widgets).toHaveLength(1);
  });

  it('rejects an unsupported schema_version', async () => {
    const future = JSON.stringify({ schema_version: 2, generated_at: '', repository: '', widgets: [] });
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse({ body: future })));
    const res = await fetchRegistry(true);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/schema_version/);
  });

  it('rejects an over-large catalog by content-length', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse({ body: '{}', contentLength: 10 * 1024 * 1024 })));
    const res = await fetchRegistry(true);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/too large/);
  });

  it('reports malformed JSON as data, never throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse({ body: 'not json' })));
    const res = await fetchRegistry(true);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not valid JSON/);
  });

  it('reports an HTTP error as data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse({ ok: false, status: 404, body: '' })));
    const res = await fetchRegistry(true);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/404/);
  });

  it('reports a network failure as data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connection refused');
      }),
    );
    const res = await fetchRegistry(true);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/connection refused/);
  });
});
