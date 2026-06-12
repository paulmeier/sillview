# Quick Start

Get Sillview running, connected to a backend it manages for you, and showing
your data.

!!! note "macOS-first"
    Sillview is developed and packaged for **macOS** (Apple Silicon). The makers
    produce macOS artifacts; other platforms are not built today.

## Option A — install a release

The simplest path is a prebuilt app.

1. Download the latest `.dmg` (or `.zip`) from the
   [**Releases**](https://github.com/paulmeier/sillview/releases) page.
2. Open the `.dmg` and drag **Sillview** to **Applications**.
3. Builds are **unsigned** today, so on first launch macOS Gatekeeper will warn.
   **Right-click the app → Open**, then confirm. You only need to do this once.

On first launch Sillview unpacks the bundled kasas binary, generates its config,
starts it on a private loopback port, and connects automatically — there's
nothing else to install or run.

## Option B — run from source

You'll need **Node.js 22+** and, to build the bundled backend, **Go 1.25+** with
a checkout of [`../kasas`](https://github.com/paulmeier/kasas) beside this repo.

```bash
git clone git@github.com:paulmeier/sillview.git
cd sillview
npm install
npm run sync:kasas   # build the kasas binary and bundle it (needs ../kasas + Go)
npm start            # build + launch the app (dev)
```

Prefer the `make` shortcuts (run `make help` for the full list):

```bash
make install         # npm dependencies
make kasas           # download the prebuilt kasas binary instead of building it
make dev             # launch against the real, managed backend
```

`make kasas` downloads the matching prebuilt binary from the public kasas GitHub
Release (checksum-verified) — handy if you don't have Go or the kasas source.

!!! tip "No backend, no data? Use mock mode"
    To work on the UI without kasas or any of your own data, run
    `make mock` (or `npm run start:mock`). See [Offline Mock Mode](mock-mode.md).

## What happens on first launch

Sillview **bundles and manages kasas** rather than asking you to run a server:

1. It copies the bundled binary to a stable, writable path under the app's data
   directory.
2. It generates a `config.toml` with a random dashboard token and a SQLite
   database, all under that data directory.
3. It starts kasas on `http://127.0.0.1:8080`, waits for `/readyz`, and connects
   automatically using the generated token.

See [Managed kasas Backend](../architecture/managed-backend.md) for the full
lifecycle, file layout, and how Sillview self-heals an orphaned backend.

## Connect your accounts

Sillview manages the backend, but **data sources** (banks via SimpleFIN, exchange
addresses, CSV import, etc.) are configured in kasas itself for now. Open kasas's
own web UI at [http://127.0.0.1:8080](http://127.0.0.1:8080) and add a source
there; Sillview will show the data once it syncs. In-app source setup is a
planned follow-up.

## Build your first dashboard

1. Click the **marketplace** button to browse widgets by category.
2. Add a widget — it drops onto the grid at its default size.
3. **Drag** widgets by their header and **resize** from the corner to arrange
   them.
4. Your layout is saved locally and restored next launch.

Next: tour the [Settings & Backend](settings.md) dialog, or read how
[Dashboards & Widgets](../features/dashboards.md) work.
