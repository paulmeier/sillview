# Settings & Backend

Open **Settings** from the gear at the bottom of the sidebar. It's a tabbed
dialog backed by the managed-backend store, and changes are applied immediately —
saving settings re-renders kasas's `config.toml` and restarts (or reloads) the
backend as needed.

The four tabs map to the `window.api.backend` surface the renderer talks to.

## Backend

Choose how Sillview reaches kasas:

- **Bundled** *(default)* — Sillview runs and manages the kasas binary itself on a
  private loopback port. The connection (base URL + a generated random dashboard
  token) is **auto-derived** from the managed instance, so there's nothing to
  paste.
- **External** — point Sillview at your own kasas URL instead. Use this if you
  already run kasas elsewhere (another machine, a container, etc.).

You can also set the **loopback port** the managed instance listens on (default
`8080`) and the backend **log level** (`debug` / `info` / `warn` / `error`).

## Sync

Controls written into kasas's `[sync]` config:

| Setting | Meaning |
| --- | --- |
| **Enabled** | Whether kasas polls its sources on a schedule. |
| **Interval** | Poll cadence as a Go duration string — e.g. `30m`, `1h`, `6h`. |
| **Run on start** | Trigger a sync when the backend boots. |
| **Lookback days** | How far back each sync re-fetches. |

The poll cadence Sillview observes for live data is kasas's own `sync.interval`.

## Background

Toggle **Background mode** — an OS service (a macOS LaunchAgent
`sh.kasas.sillview`, or a Linux systemd user unit `kasas-sillview.service`) that
keeps kasas running and syncing even when Sillview is closed. Only one of
{app-managed child, background daemon} runs at a time; they're mutually exclusive
on the port. See [Background Mode](../features/background-mode.md) for details.

## Status

A live view of the managed process:

- **State** — one of `stopped`, `starting`, `running`, `crashed`, `external`, or
  `daemon`.
- **PID**, **ready** (`/readyz` passed), **base URL**, and whether the bundled
  **binary is present**.
- A **live log tail** streamed from the process (stdout/stderr).
- **Reveal data directory** opens kasas's data folder in Finder.
- **Backend updates** — check for and apply a newer kasas binary in place. See
  [Backend Updates](../features/updates.md).

## Where settings live

App-side settings persist in the app's `userData` directory (managed-backend
settings, the saved connection, and your dashboards each in their own JSON file).
The generated kasas `config.toml`, its SQLite database, secrets, and logs live
under a `kasas/` subdirectory of the same `userData` folder — see
[Managed kasas Backend](../architecture/managed-backend.md#file-layout).

!!! warning "config.toml is generated"
    Sillview regenerates `config.toml` from these settings whenever they change.
    Hand-edits to that file are overwritten — change behavior here, not in the
    file.
