# Contributing to Sillview

Thanks for hacking on Sillview. This guide covers the local workflow — running,
testing, reviewing, building, and releasing. Most of it is one-word `make`
commands; run `make` (or `make help`) any time to see the full list.

## Prerequisites

- **macOS** — Sillview is macOS-first and the makers produce macOS artifacts.
- **Node.js 22+** — CI runs on Node 22 (developed on 24). npm ships with it; the
  lockfile (`package-lock.json`) is committed.
- **[GitHub CLI](https://cli.github.com) (`gh`)** — used by `make kasas` to
  download the backend binary.
- **Optional: Go 1.25 + a checkout of [`../kasas`](../kasas)** — only if you want
  to build the kasas backend from source (`make sync-kasas`) instead of
  downloading a prebuilt binary.

## Getting started

The fastest path needs no backend and none of your own data:

```bash
make install   # install npm dependencies
make mock      # run the UI on in-memory fixtures (KASAS_MOCK=1)
```

To run against a **real** (bundled & managed) kasas backend instead:

```bash
make kasas     # download the prebuilt kasas binary (or: make sync-kasas)
make dev       # launches the app; it spawns + manages kasas and auto-connects
```

## Make targets

| Command | What it does |
| --- | --- |
| `make install` | Install npm dependencies |
| `make dev` | Run the app against a real (bundled/managed) kasas backend |
| `make mock` | Run the app on offline fixtures — no backend, no real data |
| `make kasas` | Download the prebuilt kasas binary into `resources/bin` |
| `make sync-kasas` | Build the kasas binary from `../kasas` source |
| `make lint` / `make lint-fix` | Run ESLint (optionally with `--fix`) |
| `make typecheck` | Type-check with `tsc --noEmit` |
| `make test` | Lint + typecheck — the same gate CI enforces |
| `make review` | Run `test`, then summarize the diff vs `origin/main` |
| `make package` | Build the unpackaged `.app` into `out/` |
| `make dist` / `make build` | Build the `.dmg` + `.zip` into `out/make/` |
| `make clean` / `make clean-all` | Remove build output (and deps/binary) |

`make` auto-installs dependencies when they're missing or stale, so you can jump
straight to `make mock` / `make dist` on a fresh checkout.

## Development

### Offline mock mode (recommended for UI work)

`make mock` sets `KASAS_MOCK=1`. The main process then answers every REST call
from in-memory fixtures ([`src/main/kasas/mock.ts`](src/main/kasas/mock.ts)),
skips spawning the kasas binary, and feeds the live stream synthetic events. The
fixtures (accounts, ~6 months of transactions, labels, a sync run) are generated
relative to "now", so every widget has data. This is the easiest way to iterate
on widgets and layout. The flag is off by default — `make dev` is unaffected.

### Real backend

`make dev` runs the app the way users do: it **bundles and manages** kasas,
copying the binary into its data dir, generating a `config.toml`, and starting
kasas on `http://127.0.0.1:8080`. It needs `resources/bin/kasas` to exist first —
`make kasas` downloads the matching release binary, or `make sync-kasas` builds
it from the `../kasas` source. Configure data sources via kasas's own web UI for
now. See the [README](README.md) for backend/Settings details.

## Before you push

Run the local gate — it must pass, and it's exactly what CI runs:

```bash
make test       # ESLint + tsc
```

For a quick pre-PR pass, `make review` runs `test` and prints a diffstat against
`origin/main`. For a deeper look, run `/code-review` and `/security-review` in
Claude Code (or the cloud `ultrareview`).

## Pull requests

- Branch off `main`, push, and open a PR against `main`.
- **Write the PR title as a [Conventional Commit](#commit-messages--releases)**
  (e.g. `feat: add net-worth widget`). PRs are squash-merged, so the title
  becomes the commit subject that drives the changelog and the next version.
- CI runs **Lint & typecheck** and a **CodeQL** scan on every PR — both must be
  green before merge.
- Keep changes focused; match the surrounding code's style and the conventions
  documented in the [README](README.md) (e.g. the renderer never touches the
  network directly, and money is always a decimal **string**, never a number).

## Commit messages & releases

This repo uses **[Conventional Commits](https://www.conventionalcommits.org/)**.
Versioning (`package.json`) and `CHANGELOG.md` are automated by
[release-please](https://github.com/googleapis/release-please): it keeps a
"release" PR open that bumps the version and changelog from your commit history;
merging that PR tags the release, and CI builds the `.dmg`/`.zip` and attaches
them to the GitHub Release.

Use these prefixes (the PR **title** is what counts when squash-merging):

| Prefix | Effect | Example |
| --- | --- | --- |
| `feat:` | minor bump, "Features" | `feat: add net-worth widget` |
| `fix:` | patch bump, "Bug Fixes" | `fix: stop drag handle eating clicks` |
| `perf:` / `refactor:` / `docs:` | changelog entry | `docs: document mock mode` |
| `test:` / `ci:` / `chore:` | no release | `chore: bump deps` |
| `feat!:` / `fix!:` (or `BREAKING CHANGE:` footer) | breaking change | `feat!: drop intel build` |

Pre-1.0, breaking changes bump the **minor** version. To cut the first 1.0.0
release (or any specific version), add a `Release-As: 1.0.0` footer to a commit.

## Building & releasing

- **Local build:** `make build` produces `out/make/*.dmg` and `*.zip`. Builds are
  **arm64-only and unsigned** — on first launch, right-click the app → **Open**.
  `make package` produces a quick unpackaged `.app` for spot-checking.
- **Release:** releases are automated — see
  [Commit messages & releases](#commit-messages--releases). Land Conventional
  Commits on `main`, then merge the release PR release-please opens; it tags the
  release (plain `vMAJOR.MINOR.PATCH`) and CI attaches the `.dmg`/`.zip`. There
  is no manual tag step.

## Continuous integration

Four workflows live in [`.github/workflows/`](.github/workflows):

- **`ci.yml`** — ESLint + typecheck on every push/PR.
- **`codeql.yml`** — CodeQL security scan on push/PR and weekly.
- **`release-please.yml`** — on push to `main`, maintains the release PR and (on
  merge) creates the tag + GitHub Release, then invokes `build.yml`.
- **`build.yml`** — reusable workflow: builds the macOS `.dmg`/`.zip` and
  attaches them to the Release. Also runnable manually (artifact-only) via
  workflow dispatch.
