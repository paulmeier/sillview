# Development Workflow

Everything is driven by a self-documenting `Makefile` — run `make` (or
`make help`) to list every target. The full local guide is in
[CONTRIBUTING.md](https://github.com/paulmeier/sillview/blob/main/CONTRIBUTING.md).

## Prerequisites

- **macOS** — Sillview is macOS-first and the makers produce macOS artifacts.
- **Node.js 22+** — CI runs on Node 22. The lockfile (`package-lock.json`) is
  committed.
- **[GitHub CLI](https://cli.github.com) (`gh`)** — used by `make kasas` to
  download the backend binary.
- **Optional: Go 1.25 + a checkout of `../kasas`** — only if you want to build the
  backend from source (`make sync-kasas`) instead of downloading a prebuilt
  binary.

## Common targets

| Command | What it does |
| --- | --- |
| `make install` | Install npm dependencies |
| `make dev` | Run against a real (bundled/managed) kasas backend |
| `make mock` | Run on offline fixtures — no backend, no real data |
| `make kasas` | Download the prebuilt kasas binary into `resources/bin` |
| `make sync-kasas` | Build the kasas binary from `../kasas` source |
| `make lint` / `make lint-fix` | Run ESLint (optionally with `--fix`) |
| `make typecheck` | Type-check with `tsc --noEmit` |
| `make test` | Lint + typecheck — the same gate CI enforces |
| `make review` | Run `test`, then summarize the diff vs `origin/main` |
| `make package` | Build the unpackaged `.app` into `out/` |
| `make dist` / `make build` | Build the `.dmg` + `.zip` into `out/make/` |
| `make clean` / `make clean-all` | Remove build output (and deps/binary) |

`make` auto-installs dependencies when they're missing or stale, and fetches the
kasas binary only if `resources/bin/kasas` is absent — so you can jump straight to
`make mock` or `make dist` on a fresh checkout.

## The quality gate

`make test` runs **ESLint + `tsc --noEmit`** — exactly what CI enforces on every
push and PR. Run it before you push.

```bash
make test
```

For a quick pre-PR pass, `make review` runs `test` and prints a diffstat against
`origin/main`.

## Two ways to run

- **`make mock`** — `KASAS_MOCK=1`, the whole UI on in-memory fixtures. Best for
  widget and layout work. See [Offline Mock Mode](../getting-started/mock-mode.md).
- **`make dev`** — the real, [managed backend](../architecture/managed-backend.md):
  Sillview spawns and supervises kasas, generates its config, and connects. Needs
  `resources/bin/kasas` (via `make kasas` or `make sync-kasas`).

## Toolchain notes

A few non-obvious choices worth knowing before you touch the build:

- **Tailwind v4** (CSS-first, `@tailwindcss/vite`) — there is no
  `tailwind.config.js`.
- **Tremor** is used in its copy-paste/Recharts form, **not** the frozen
  `@tremor/react` package (which needs Tailwind v3 and renders nothing under v4).
  Components in `components/tremor/` follow Tremor's API.
- **`vite.renderer.config.mts` must be `.mts`.** Forge loads Vite configs as
  CommonJS, but `@tailwindcss/vite` and `@vitejs/plugin-react` are ESM-only.

## Conventions

- The **renderer never touches the network** directly — all kasas traffic goes
  through the main-process broker. See
  [kasas Integration](../architecture/kasas-integration.md).
- **Money is always a decimal string**, never a number.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/), and
  releases are automated — see [Releases & CI](releases.md).
