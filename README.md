<p align="center">
  <img src="docs/assets/logo.svg" alt="Sillview" width="120">
</p>

<h1 align="center">Sillview</h1>

<p align="center">
  <strong>A desktop dashboard for your financial ledger.</strong>
</p>

<p align="center">
  <a href="https://github.com/paulmeier/sillview/actions/workflows/ci.yml"><img src="https://github.com/paulmeier/sillview/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/paulmeier/sillview/actions/workflows/release-please.yml"><img src="https://github.com/paulmeier/sillview/actions/workflows/release-please.yml/badge.svg" alt="Release"></a>
  <a href="https://github.com/paulmeier/sillview/releases/latest"><img src="https://img.shields.io/github/v/release/paulmeier/sillview?label=download&color=000000" alt="Download"></a>
  <a href="https://paulmeier.github.io/sillview/"><img src="https://img.shields.io/badge/docs-mkdocs--material-1b3a5e?logo=readthedocs&logoColor=white" alt="Docs"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
</p>

---

Sillview is a **cross-platform desktop app** (macOS, Linux, and Windows) that turns
the [**kasas**](https://github.com/paulmeier/kasas) financial ledger into a dashboard
you can actually look at. Build your own dashboards from a **marketplace of
widgets**, arrange them on a **draggable, resizable grid**, and save them locally.

The defining trait: Sillview **bundles and manages the kasas backend for you** —
there's no separate server to install or run. On first launch it starts kasas on a
private loopback port, connects automatically, updates it in place, and — on macOS —
can keep it running in the background.

Built with **Electron Forge + Vite + React 19 + TypeScript**, styled with
**Tailwind CSS v4**, and visualized with **Tremor**-style charts (Recharts).

## Install

Download the latest installer for your platform from the
[**Releases**](https://github.com/paulmeier/sillview/releases/latest) page:

| Platform | Download |
| --- | --- |
| **macOS** (Apple Silicon) | `.dmg` |
| **Linux** (x64) | `.deb` or `.rpm` |
| **Windows** (x64) | `Setup.exe` (Squirrel installer) |

> **Heads-up: builds are not yet code-signed**, so your OS may warn on first launch.
>
> - **macOS** says *"Sillview is damaged and can't be opened"* — this is Gatekeeper,
>   not a corrupt download. Strip the quarantine flag, then open normally:
>   ```bash
>   xattr -dr com.apple.quarantine /Applications/Sillview.app
>   ```
> - **Windows** shows a SmartScreen prompt — click **More info → Run anyway**.
>
> Signing + notarization are planned; until then these one-time steps are expected.

### Auto-update

Once installed, Sillview keeps itself up to date — no need to revisit the
Releases page or drag a new build into `/Applications`. On macOS and Windows the
app checks for new releases in the background (on launch, then hourly) via
Electron's built-in updater and the free [update.electronjs.org] service, which
serves our published GitHub Releases. When a newer version finishes downloading,
you'll get a native **Restart to update** prompt; click it and the app relaunches
on the new version.

- **Linux** (`.deb`/`.rpm`) updates through your system package manager, not the
  in-app updater.
- **macOS** auto-update requires a **code-signed** app. Because release builds are
  currently unsigned (see the heads-up above), the macOS updater checks but can't
  apply updates yet — it starts working automatically once signing is enabled.
  Windows auto-update works today.

[update.electronjs.org]: https://github.com/electron/update.electronjs.org

## Features

- **Custom dashboards** — start from a clean slate, then arrange widgets on a
  draggable, resizable grid and save as many dashboards as you like; they persist
  locally on your machine.
- **Widget marketplace** — browse a catalog by category (net worth, accounts, cash
  flow, spending, live activity) and drop widgets onto a dashboard.
- **Managed backend** — Sillview ships the kasas binary, generates its config,
  starts it on loopback, and connects automatically. No separate server to run.
- **Background mode (macOS & Linux)** — opt in to an OS service (a macOS
  LaunchAgent, or a Linux systemd user unit) that keeps kasas syncing even when
  Sillview is closed, so your data stays fresh. On Windows kasas runs while
  Sillview is open (a Scheduled Task is a follow-up).
- **In-app backend updates** — drive kasas's own verified self-update (HTTPS +
  SHA-256 + atomic replace) and restart it in one click.
- **Offline mock mode** — run the entire UI on in-memory fixtures: no backend, no
  network, no real data.

## Quick start

```bash
npm install
npm run sync:kasas   # build the kasas binary and bundle it (needs ../kasas + Go 1.25)
npm start            # build + launch the app (dev)
```

On first launch Sillview copies the bundled binary into its data dir, generates a
`config.toml` (with a random dashboard token), starts kasas on
`http://127.0.0.1:8080`, and connects automatically.

Open **Settings** (gear at the bottom of the sidebar) to switch between the
**Bundled** backend and an **External** kasas URL, set the **poll interval**,
toggle **Background mode** (macOS & Linux), and watch process **status** and live logs.

Configure data sources (SimpleFIN, exchange addresses, etc.) for now via kasas's
own web UI at `http://127.0.0.1:8080`; in-app source setup is a planned follow-up.

### Offline / mock mode

To work on the UI without kasas, a connection, or any of your own data:

```bash
npm run start:mock   # KASAS_MOCK=1 — serve fixtures, no backend
```

The main process answers every REST call from in-memory fixtures
(`src/main/kasas/mock.ts`), skips the kasas binary, and feeds the live stream
synthetic events. The dataset (accounts, ~6 months of transactions, labels, a sync
run) is generated relative to "now" so every widget has data.

### Other scripts

```bash
npm run package    # build an unpackaged app bundle
npm run make       # build distributables for the host OS
npm run typecheck  # tsc --noEmit
npm run build:mcp  # bundle the MCP server (see below) → dist-mcp/server.mjs
```

`make` runs only the makers for the host platform: **macOS** → `.dmg` + `.zip`,
**Linux** → `.deb` + `.rpm`, **Windows** → Squirrel `.exe`. CI builds all three on a
per-OS runner matrix and attaches them to each GitHub Release
(`.github/workflows/build.yml`).

Builds are **unsigned by default** (see [Install](#install) for the first-launch
workarounds). macOS code signing / notarization is wired but disabled; enable it in
`forge.config.ts` using `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` env vars
(never inline credentials). Windows Authenticode signing is a planned follow-up.

## MCP server — let an LLM build dashboards

Sillview ships a small [Model Context Protocol](https://modelcontextprotocol.io)
server so an assistant (Claude Desktop, Claude Code, etc.) can create dashboards and
place widgets for you. It is a standalone stdio process that reads and writes the
same `dashboards.json` the app uses — the running app **watches that file and
live-reloads**, so changes appear without a restart (or on the next launch if the app
is closed).

Build it once (re-run after changing `src/mcp/` or `src/shared/`):

```bash
npm run build:mcp     # → dist-mcp/server.mjs
```

Then register it with your MCP client, pointing at the built file. For Claude
Desktop, add to `claude_desktop_config.json`:

```jsonc
{
  "mcpServers": {
    "sillview": {
      "command": "node",
      "args": ["/absolute/path/to/sillview/dist-mcp/server.mjs"]
    }
  }
}
```

For Claude Code: `claude mcp add sillview -- node /absolute/path/to/sillview/dist-mcp/server.mjs`.

**Tools:** `list_widget_types`, `list_dashboards`, `get_dashboard`,
`create_dashboard`, `add_widget`, `update_widget_config`, `remove_widget`,
`rename_dashboard`, `delete_dashboard`, `set_active_dashboard`, plus read-only
`list_accounts` / `list_market_series` (so market & benchmark widgets get real ids;
these need kasas running).

**Data location.** The server defaults to a packaged build's userData
(`~/Library/Application Support/Sillview` on macOS). Two overrides via `env` in the
config:

- `SILLVIEW_APP_NAME=Electron` — target a `npm start` **dev** build (the bare Electron
  runtime uses the `Electron` userData dir, not `Sillview`).
- `SILLVIEW_DATA_DIR=/abs/path` — point at an explicit userData directory.

The bundle keeps its npm dependencies external, so run it from this checkout (it
resolves `@modelcontextprotocol/sdk` + `zod` from `node_modules`). Shipping it to
non-developer end users would mean bundling those deps — a follow-up.

## Architecture

Three process boundaries (`src/main.ts`, `src/preload.ts`, `src/renderer/`):

```
src/
├── main.ts                  # Electron entry: window, CSP, lifecycle
├── main/
│   ├── ipc.ts               # registers IPC handlers; owns the connection + stream
│   ├── kasas/http.ts        # kasas REST broker (Node fetch — no CORS)
│   ├── kasas/sse.ts         # /api/v1/events/stream consumer → forwards to renderer
│   └── storage/             # connection.json + dashboards.json in userData
├── preload.ts               # contextBridge → window.api (the only renderer↔main link)
├── mcp/                     # standalone stdio MCP server (build:mcp → dist-mcp/server.mjs)
├── shared/                  # IPC contract, kasas DTO types, React-free widget/dashboard model
└── renderer/
    ├── api/                 # typed kasas client (over window.api) + React hooks
    ├── store/               # zustand: connection + saved dashboards (persisted)
    ├── components/tremor/   # Tremor-style Card + Recharts charts
    ├── widgets/             # widget components + registry.ts (the marketplace catalog)
    ├── marketplace/         # MarketplacePanel — browse & add widgets
    ├── dashboard/           # DashboardGrid (react-grid-layout) + WidgetHost + ErrorBoundary
    └── App.tsx              # app shell (sidebar, top bar, dialogs)
```

**Two load-bearing decisions:**

1. **All kasas traffic goes through the main process.** kasas sends no CORS
   headers, so a renderer on a `localhost`/`file://` origin can't call it directly.
   Main performs every REST call and the SSE stream with Node `fetch` and exposes a
   narrow, validated `window.api` over `contextBridge`. `contextIsolation`,
   `sandbox`, and `nodeIntegration:false` stay on; the renderer never sees
   `ipcRenderer`.
2. **Dashboards are saved locally.** kasas has no dashboard storage, so the
   renderer's dashboard store (zustand `persist`) writes through IPC to
   `dashboards.json` in the app's userData directory. The [MCP server](#mcp-server--let-an-llm-build-dashboards)
   writes the same file directly; main `fs.watch`es it and pushes a reload to the
   renderer (writes are atomic temp+rename, and the app's own saves are filtered out).

**Adding a widget** is one entry of pure metadata in `src/shared/widgets.ts` (title,
category, default size, config contract) plus an icon + component wired up in
`src/renderer/widgets/registry.ts`. The metadata is React-free so the MCP server can
validate widgets without importing the renderer; the data model + on-disk format
live alongside it in `src/shared/dashboards.ts`.

**kasas data notes:** money (`amount`, `balance`) is a **decimal string in major
units** with variable scale (2 for USD, up to 18 for ETH) — never round it or store
it as a number; formatting lives in `src/renderer/lib/money.ts`. Timestamps are
ISO-8601 strings; `labels` is a flat `{key: value}` map.

## Toolchain notes

- **Tailwind v4** (CSS-first, `@tailwindcss/vite`) — no `tailwind.config.js`.
- **Tremor** is used in its copy-paste/Recharts form rather than the frozen
  `@tremor/react` npm package (which requires Tailwind v3). Components in
  `components/tremor/` follow Tremor's API and can be swapped for official Tremor
  Raw files.
- `vite.renderer.config.mts` is `.mts` on purpose: Forge loads Vite configs in
  CommonJS, but `@tailwindcss/vite` and `@vitejs/plugin-react` are ESM-only.

## Contributing

Run `make` (or `make help`) for one-word commands to install, run, test, and build.
Commits follow [Conventional Commits](https://www.conventionalcommits.org/), and
versioning + releases are automated by
[release-please](https://github.com/googleapis/release-please). See
[CONTRIBUTING.md](CONTRIBUTING.md) for the full local workflow.

Contributors sign a one-time [Contributor License Agreement](CLA.md) — the CLA
Assistant bot prompts you automatically on your first pull request.

## License

Sillview is free and open source under the [MIT License](LICENSE) for personal,
non-commercial, and open-source use.

A [**commercial license**](LICENSE_COMMERCIAL.md) is available for hosted/SaaS or
proprietary commercial use. The MIT license plus a Contributor License Agreement
keep the door open to a formal dual commercial/open-source model later.
