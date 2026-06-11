# sillview

A macOS-first **Electron** desktop dashboard for the [kasas](../kasas) ledger
backend. Build dashboards from a marketplace of widgets, arrange them on a
draggable grid, and save them locally. Styled with **Tailwind CSS v4**,
visualized with **Tremor**-style charts (Recharts), built with **Electron Forge
+ Vite + React 19 + TypeScript**.

## Quick start

```bash
npm install
npm run sync:kasas   # build the kasas binary and bundle it (needs ../kasas + Go 1.25)
npm start            # build + launch the app (dev)
```

sillview **bundles and manages kasas** for you. On first launch it copies the
binary into its data dir, generates a `config.toml` (with a random dashboard
token), starts kasas on `http://127.0.0.1:8080`, and connects automatically —
there's no separate backend to run.

Open **Settings** (gear at the bottom of the sidebar) to:

- switch between the **Bundled** backend and an **External** kasas URL,
- set the **poll interval** and other sync options,
- toggle **Background mode** — a macOS LaunchAgent that keeps kasas running and
  polling even when sillview is closed,
- watch process **status** and live logs.

Configure data sources (SimpleFIN, exchange addresses, etc.) for now via kasas's
own web UI at `http://127.0.0.1:8080`; in-app source setup is a planned
follow-up.

### Other scripts

```bash
npm run package    # build an unpackaged .app
npm run make       # build a distributable (.dmg + .zip on macOS)
npx tsc --noEmit   # type-check
```

Code signing / notarization for release builds are wired but disabled; enable
them in `forge.config.ts` using `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID`
env vars (never inline credentials).

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
├── shared/                  # IPC contract + kasas DTO types (used by both sides)
└── renderer/
    ├── api/                 # typed kasas client (over window.api) + React hooks
    ├── store/               # zustand: connection + saved dashboards (persisted)
    ├── components/tremor/   # Tremor-style Card + Recharts charts
    ├── widgets/             # widget components + registry.ts (the marketplace catalog)
    ├── marketplace/         # MarketplacePanel — browse & add widgets
    ├── dashboard/           # DashboardGrid (react-grid-layout) + WidgetHost + ErrorBoundary
    └── App.tsx              # app shell (sidebar, top bar, dialogs)
```

### Two load-bearing decisions

1. **All kasas traffic goes through the main process.** kasas sends no CORS
   headers, so a renderer on a `localhost`/`file://` origin can't call it
   directly. Instead, main performs every REST call and the SSE stream with Node
   `fetch` (no CORS) and exposes a narrow, validated `window.api` over
   `contextBridge`. `contextIsolation`, `sandbox`, and `nodeIntegration:false`
   stay on; the renderer never sees `ipcRenderer`.

2. **Dashboards are saved locally.** kasas has no dashboard storage, so the
   renderer's dashboard store (zustand `persist`) writes through IPC to
   `dashboards.json` in the app's userData directory.

### Adding a widget

Add one entry to `src/renderer/widgets/registry.ts` (title, category, icon,
default size, component) and a component file. The registry is the single source
both the marketplace UI and the dashboard engine read.

### kasas data notes

- Money (`amount`, `balance`) is a **decimal string in major units** with
  variable scale (2 for USD, up to 18 for ETH) — never round it or store it as a
  number. Formatting lives in `src/renderer/lib/money.ts`.
- Timestamps are ISO-8601 strings; `labels` is a flat `{key: value}` map.

## Toolchain notes

- **Tailwind v4** (CSS-first, `@tailwindcss/vite`) — no `tailwind.config.js`.
- **Tremor** is used in its current copy-paste/Recharts form rather than the
  frozen `@tremor/react` npm package (which requires Tailwind v3). Components in
  `components/tremor/` follow Tremor's API and can be swapped for official
  Tremor Raw files.
- `vite.renderer.config.mts` is `.mts` on purpose: Forge loads Vite configs in
  CommonJS, but `@tailwindcss/vite` and `@vitejs/plugin-react` are ESM-only.
