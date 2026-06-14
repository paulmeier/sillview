import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Record every `launchctl ...` invocation and let each test decide whether the
// `print` probe (isActive) succeeds, so we can assert which subcommand reload()
// chooses without touching the real launchd.
const calls: string[][] = [];
let active = true;

vi.mock('node:child_process', () => ({
  execFile: (
    _file: string,
    args: string[],
    cb: (err: Error | null, out: { stdout: string; stderr: string }) => void,
  ) => {
    calls.push(args);
    // `launchctl print ...` is the liveness probe behind isActive().
    if (args[0] === 'print' && !active) {
      cb(new Error('Could not find service'), { stdout: '', stderr: '' });
      return;
    }
    cb(null, { stdout: '', stderr: '' });
  },
}));

vi.mock('node:fs', () => ({
  existsSync: () => true,
  promises: { mkdir: vi.fn(), writeFile: vi.fn(), rm: vi.fn() },
}));

// paths.ts reaches for Electron's `app`, which isn't available under vitest.
vi.mock('./paths', () => ({ kasasLogDir: () => '/tmp/kasas-logs' }));

// Imported after the mocks above are registered.
const { install, reload } = await import('./launchagent');

const launchctl = (sub: string) => calls.filter((c) => c[0] === sub);

beforeEach(() => {
  calls.length = 0;
  active = true;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('reload', () => {
  it('restarts the loaded job in place with kickstart -k (no bootout/bootstrap race)', async () => {
    active = true;
    await reload();
    expect(launchctl('kickstart')).toHaveLength(1);
    expect(launchctl('kickstart')[0]).toContain('-k');
    // Crucially it never unloads the daemon, so a failure can't leave it dead.
    expect(launchctl('bootout')).toHaveLength(0);
    expect(launchctl('bootstrap')).toHaveLength(0);
  });

  it('bootstraps a fresh copy when the job is not loaded (self-heal)', async () => {
    active = false;
    await reload();
    expect(launchctl('bootstrap')).toHaveLength(1);
    expect(launchctl('kickstart')).toHaveLength(0);
  });
});

describe('install', () => {
  it('waits for the old instance to exit before bootstrapping the rewritten plist', async () => {
    // print starts succeeding (old job still up), so install must bootout first
    // and only bootstrap once isActive() reports it gone.
    active = false; // already inactive: bootout, confirm gone, bootstrap
    await install('/bin/kasas', '/cfg/config.toml');
    const order = calls.map((c) => c[0]);
    expect(order).toContain('bootout');
    expect(order).toContain('bootstrap');
    expect(order.indexOf('bootout')).toBeLessThan(order.indexOf('bootstrap'));
  });
});
