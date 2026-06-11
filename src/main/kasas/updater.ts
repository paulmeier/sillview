/**
 * kasas binary update orchestration. We don't download or verify binaries
 * ourselves — we drive kasas's own tested `self-update` CLI (HTTPS-only download
 * + published SHA-256 verification + atomic replace) and parse its output.
 *
 * Observed kasas output (cmd/kasas/main.go):
 *   `update available: <cur> -> <latest>\n<url>`
 *   `kasas <cur> is up to date (latest release: <latest>)`
 *   `current build "<cur>" is not a released version; latest release is <latest>\n<url>`
 *   apply: `updated to <latest>; restart kasas to run the new version`
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { KasasUpdateInfo, KasasUpdateResult } from '../../shared/ipc';

const execFileP = promisify(execFile);

const CHECK_OPTS = { timeout: 30_000, maxBuffer: 1 << 20 };
const APPLY_OPTS = { timeout: 120_000, maxBuffer: 1 << 20 };

function firstLine(s: string | undefined): string {
  return (s ?? '').trim().split('\n')[0] ?? '';
}

/** Read the on-disk binary version, e.g. "v2.27.1". */
export async function currentVersion(binary: string): Promise<string> {
  try {
    const { stdout } = await execFileP(binary, ['version'], CHECK_OPTS);
    // "kasas v2.27.1-dirty"
    return stdout.trim().replace(/^kasas\s+/i, '').trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function checkForUpdate(binary: string): Promise<KasasUpdateInfo> {
  const current = await currentVersion(binary);
  const base: KasasUpdateInfo = {
    current,
    available: false,
    kind: 'uptodate',
    message: '',
    checkedAt: Date.now(),
  };

  try {
    const { stdout } = await execFileP(binary, ['self-update', '-check'], CHECK_OPTS);
    const out = stdout.trim();
    const url = out.match(/https?:\/\/\S+/)?.[0];

    let m = out.match(/update available:\s*(\S+)\s*->\s*(\S+)/);
    if (m) {
      return {
        ...base,
        current: m[1],
        latest: m[2],
        available: true,
        kind: 'available',
        message: `Update available: ${m[1]} → ${m[2]}`,
        url,
      };
    }
    m = out.match(/is up to date \(latest release:\s*([^)]+)\)/);
    if (m) {
      return { ...base, latest: m[1].trim(), message: `Up to date (${current})` };
    }
    m = out.match(/is not a released version; latest release is\s*(\S+)/);
    if (m) {
      return {
        ...base,
        latest: m[1],
        kind: 'devbuild',
        message: `Dev build (${current}) — can't auto-update; latest is ${m[1]}`,
        url,
      };
    }
    return { ...base, message: out || `Up to date (${current})` };
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    return {
      ...base,
      kind: 'error',
      message: firstLine(e.stderr) || firstLine(e.message) || 'Update check failed',
    };
  }
}

export async function applyUpdate(binary: string): Promise<KasasUpdateResult> {
  try {
    const { stdout } = await execFileP(binary, ['self-update'], APPLY_OPTS);
    const out = stdout.trim();
    const m = out.match(/updated to\s+(\S+?);/);
    if (m) return { ok: true, version: m[1], message: `Updated to ${m[1]}` };
    if (/up to date/i.test(out)) return { ok: true, message: out };
    return { ok: true, message: out || 'Update applied' };
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    return {
      ok: false,
      message: firstLine(e.stderr) || firstLine(e.message) || 'Update failed',
    };
  }
}
