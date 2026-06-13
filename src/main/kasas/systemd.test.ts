import { describe, expect, it } from 'vitest';
import { renderUnit } from './systemd';

describe('renderUnit', () => {
  const unit = renderUnit('/home/me/.local/kasas/bin/kasas', '/home/me/.local/kasas/config.toml');

  it('emits the three required systemd sections', () => {
    expect(unit).toContain('[Unit]');
    expect(unit).toContain('[Service]');
    expect(unit).toContain('[Install]');
  });

  it('runs the binary with the managed config in serve mode', () => {
    expect(unit).toContain(
      'ExecStart="/home/me/.local/kasas/bin/kasas" -config "/home/me/.local/kasas/config.toml" serve',
    );
  });

  it('uses the config directory as the working directory', () => {
    expect(unit).toContain('WorkingDirectory="/home/me/.local/kasas"');
  });

  it('restarts on crash and starts at login', () => {
    expect(unit).toContain('Restart=always');
    expect(unit).toContain('WantedBy=default.target');
  });

  it('quotes paths containing spaces so systemd keeps them as one argument', () => {
    const u = renderUnit('/opt/My Apps/kasas', '/home/a b/config.toml');
    expect(u).toContain('ExecStart="/opt/My Apps/kasas" -config "/home/a b/config.toml" serve');
    expect(u).toContain('WorkingDirectory="/home/a b"');
  });

  it('escapes embedded quotes and backslashes in paths', () => {
    const u = renderUnit('/weird/ka"s\\as', '/weird/cfg.toml');
    // " -> \"  and  \ -> \\  per systemd C-style unquoting.
    expect(u).toContain('ExecStart="/weird/ka\\"s\\\\as" -config "/weird/cfg.toml" serve');
  });
});
