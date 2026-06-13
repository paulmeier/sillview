/**
 * Supervises the managed kasas backend: spawns it as a child process, streams
 * its logs, polls /readyz, auto-restarts on crash, and coordinates with the
 * background daemon (only one of {child, daemon} runs at a time). The daemon is
 * a platform service — macOS LaunchAgent or Linux systemd user unit — behind a
 * uniform interface (see daemon.ts).
 */

import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  KasasLogLine,
  KasasProcessState,
  KasasSettings,
  KasasStatus,
  KasasUpdateInfo,
  KasasUpdateResult,
} from '../../shared/ipc';
import {
  loadBackendState,
  saveBackendState,
  defaultSettings,
  type BackendState,
} from '../storage/backend-settings';
import {
  bundledBinaryExists,
  ensureBinary,
  kasasConfigPath,
  kasasDataDir,
} from './paths';
import { renderConfigToml } from './config-toml';
import { applyUpdate as runApply, checkForUpdate as runCheck } from './updater';
import * as daemon from './daemon';

interface Emitters {
  status: (status: KasasStatus) => void;
  log: (line: KasasLogLine) => void;
}

const execFileP = promisify(execFile);

const MAX_LOG_LINES = 500;
const READY_TIMEOUT_MS = 20000;
const STOP_TIMEOUT_MS = 20000;
const MAX_RESTARTS = 3;

export class KasasManager {
  private state: BackendState = { settings: defaultSettings(), token: '' };
  private proc: ChildProcess | null = null;
  private processState: KasasProcessState = 'stopped';
  private ready = false;
  private lastError: string | undefined;
  private logs: KasasLogLine[] = [];
  private stopping = false;
  private restartAttempts = 0;
  private lastUpdate: KasasUpdateInfo | null = null;

  constructor(private readonly emit: Emitters) {}

  async init(): Promise<void> {
    this.state = await loadBackendState();
    // Persist immediately so the generated dashboard token is stable across
    // launches (otherwise a fresh token is minted every start).
    await saveBackendState(this.state);
    this.processState = this.state.settings.mode === 'external' ? 'external' : 'stopped';
  }

  get settings(): KasasSettings {
    return this.state.settings;
  }
  get token(): string {
    return this.state.token;
  }
  baseUrl(): string {
    return `http://127.0.0.1:${this.state.settings.port}`;
  }

  status(): KasasStatus {
    return {
      state: this.processState,
      mode: this.state.settings.mode,
      background: this.state.settings.background,
      pid: this.proc?.pid ?? null,
      ready: this.ready,
      baseUrl: this.baseUrl(),
      dataDir: kasasDataDir(),
      binaryPresent: bundledBinaryExists(),
      daemonSupported: daemon.supported,
      daemonKind: daemon.kind,
      daemonLabel: daemon.label,
      error: this.lastError,
    };
  }

  recentLogs(): KasasLogLine[] {
    return [...this.logs];
  }

  private setState(state: KasasProcessState, error?: string): void {
    this.processState = state;
    this.lastError = error;
    this.emit.status(this.status());
  }

  private pushLog(stream: 'stdout' | 'stderr', chunk: string): void {
    for (const raw of chunk.split('\n')) {
      const line = raw.trimEnd();
      if (!line) continue;
      const entry: KasasLogLine = { at: Date.now(), stream, line };
      this.logs.push(entry);
      if (this.logs.length > MAX_LOG_LINES) this.logs.shift();
      this.emit.log(entry);
    }
  }

  private async writeConfig(): Promise<string> {
    const cfgPath = kasasConfigPath();
    await fs.writeFile(cfgPath, renderConfigToml(this.state.settings, this.state.token), 'utf8');
    return cfgPath;
  }

  /** Start the backend according to current settings. */
  async start(): Promise<KasasStatus> {
    if (this.state.settings.mode === 'external') {
      this.setState('external');
      return this.status();
    }
    // The background daemon owns the port — don't also spawn a child.
    if (this.state.settings.background && daemon.supported) {
      this.setState('daemon');
      void this.waitForReady();
      return this.status();
    }
    if (this.proc) return this.status();

    const binary = await ensureBinary();
    if (!binary) {
      this.setState('crashed', 'kasas binary not bundled — run `npm run sync:kasas`');
      return this.status();
    }
    const cfgPath = await this.writeConfig();

    this.stopping = false;
    this.ready = false;
    this.setState('starting');

    // Self-heal: clear any kasas orphaned by a previous crash/force-quit so the
    // port is free and we never talk to a stale instance with an old token.
    await this.killStaleManaged(binary);

    const proc = spawn(binary, ['-config', cfgPath, 'serve'], {
      cwd: kasasDataDir(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.proc = proc;
    proc.stdout?.on('data', (b: Buffer) => this.pushLog('stdout', b.toString()));
    proc.stderr?.on('data', (b: Buffer) => this.pushLog('stderr', b.toString()));
    proc.on('error', (err) => this.setState('crashed', err.message));
    proc.on('exit', (code, signal) => this.onExit(code, signal));

    void this.waitForReady();
    return this.status();
  }

  private onExit(code: number | null, signal: NodeJS.Signals | null): void {
    this.proc = null;
    this.ready = false;
    if (this.stopping) {
      this.setState('stopped');
      return;
    }
    const msg = `kasas exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`;
    this.pushLog('stderr', msg);
    if (this.restartAttempts < MAX_RESTARTS) {
      this.restartAttempts += 1;
      this.setState('crashed', `${msg} — restarting (${this.restartAttempts}/${MAX_RESTARTS})`);
      setTimeout(() => {
        if (!this.proc && !this.stopping) void this.start();
      }, 1500 * this.restartAttempts);
    } else {
      this.setState('crashed', `${msg} — gave up after ${MAX_RESTARTS} restarts`);
    }
  }

  private async waitForReady(): Promise<void> {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    const url = `${this.baseUrl()}/readyz`;
    const runningState: KasasProcessState = this.state.settings.background ? 'daemon' : 'running';
    while (Date.now() < deadline) {
      if (this.stopping) return;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
        if (res.ok) {
          this.ready = true;
          this.restartAttempts = 0;
          this.setState(runningState);
          return;
        }
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!this.ready) {
      this.setState(
        runningState,
        this.state.settings.background
          ? 'daemon not reachable — check the Background setting'
          : 'started but /readyz did not respond in time',
      );
    }
  }

  /** Kill any lingering managed-kasas process orphaned by a crash/force-quit. */
  private async killStaleManaged(binary: string): Promise<void> {
    try {
      if (process.platform === 'win32') {
        // taskkill matches by image name only, not full path; the managed
        // binary is the only kasas.exe we run, so this is precise enough.
        await execFileP('taskkill', ['/F', '/IM', path.basename(binary)]);
      } else {
        await execFileP('pkill', ['-f', binary]); // throws (exit 1) if nothing matched
      }
      await new Promise((r) => setTimeout(r, 1000)); // let the port free
    } catch {
      /* nothing was running */
    }
  }

  async stop(): Promise<KasasStatus> {
    const proc = this.proc;
    if (!proc) {
      if (this.processState !== 'external' && this.processState !== 'daemon') {
        this.setState('stopped');
      }
      return this.status();
    }
    this.stopping = true;
    proc.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch {
          /* already gone */
        }
        resolve();
      }, STOP_TIMEOUT_MS);
      proc.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    this.proc = null;
    this.ready = false;
    this.setState('stopped');
    return this.status();
  }

  async restart(): Promise<KasasStatus> {
    await this.stop();
    this.restartAttempts = 0;
    return this.start();
  }

  /** Persist new settings, re-render config.toml, and apply them. */
  async applySettings(next: KasasSettings): Promise<KasasStatus> {
    const prev = this.state.settings;
    this.state = { ...this.state, settings: next };
    await saveBackendState(this.state);

    if (next.mode === 'external') {
      await this.stop();
      if (prev.background) await daemon.uninstall();
      this.setState('external');
      return this.status();
    }

    await this.writeConfig();

    if (next.background !== prev.background) {
      return this.setBackground(next.background);
    }
    if (next.background) {
      await daemon.reload();
      void this.waitForReady();
      return this.status();
    }
    return this.restart();
  }

  /** Install/remove the persistent daemon and adjust the child accordingly. */
  async setBackground(enabled: boolean): Promise<KasasStatus> {
    // The daemon needs a supported platform backend (LaunchAgent/systemd). Where
    // there's none, never persist a background=true we can't honor — keep
    // running as a managed child.
    if (!daemon.supported) {
      this.state.settings.background = false;
      await saveBackendState(this.state);
      return this.status();
    }
    this.state.settings.background = enabled;
    await saveBackendState(this.state);

    if (this.state.settings.mode === 'external') {
      // External backend can't be daemonized by us.
      if (enabled) await daemon.uninstall().catch(() => undefined);
      this.setState('external');
      return this.status();
    }

    const binary = await ensureBinary();
    if (!binary) {
      this.setState('crashed', 'kasas binary not bundled — run `npm run sync:kasas`');
      return this.status();
    }
    const cfgPath = await this.writeConfig();

    if (enabled) {
      await this.stop(); // free the port from the managed child
      await daemon.install(binary, cfgPath);
      this.setState('daemon');
      void this.waitForReady();
    } else {
      await daemon.uninstall();
      this.setState('stopped');
      return this.start();
    }
    return this.status();
  }

  /** True when the managed instance owns the connection (bundled mode). */
  managesConnection(): boolean {
    return this.state.settings.mode === 'bundled';
  }

  // --- binary updates ---------------------------------------------------

  lastUpdateInfo(): KasasUpdateInfo | null {
    return this.lastUpdate;
  }

  async checkUpdate(): Promise<KasasUpdateInfo> {
    const binary = await ensureBinary();
    if (!binary) {
      this.lastUpdate = {
        current: 'unknown',
        available: false,
        kind: 'error',
        message: 'kasas binary not bundled — run `npm run sync:kasas`',
        checkedAt: Date.now(),
      };
      return this.lastUpdate;
    }
    this.lastUpdate = await runCheck(binary);
    return this.lastUpdate;
  }

  /** Download + apply the latest binary, then restart so it execs. */
  async applyUpdate(): Promise<KasasUpdateResult> {
    const binary = await ensureBinary();
    if (!binary) return { ok: false, message: 'kasas binary not bundled' };

    const result = await runApply(binary);
    if (result.ok) {
      if (this.state.settings.background) {
        await daemon.reload();
        void this.waitForReady();
      } else if (this.state.settings.mode === 'bundled') {
        await this.restart();
      }
      this.lastUpdate = await runCheck(binary);
    }
    return result;
  }
}
