# ADR-0005: Widget marketplace — an external registry with install-gating

- **Status:** Accepted
- **Date:** 2026-06-14
- **Deciders:** Paul Meier
- **Related:** [ADR-0001](0001-user-created-widgets-tiered-model.md) ·
  [ADR-0003](0003-third-party-code-widget-sandboxing.md) ·
  [Building a Widget](../../development/building-a-widget.md) ·
  [Widget Catalog](../../features/widgets.md) ·
  [kasas Integration → The CORS broker](../kasas-integration.md#the-cors-broker)

## Context and problem statement

Every widget was always available: the "Add widget" panel listed all compiled
widgets and placed any of them. We want a **marketplace**: a curated, community
registry of widgets that users **install** before adding, modeled on the
[`kasas-plugins`](https://github.com/paulmeier/kasas-plugins) registry (a per-entry
source dir + a CLI gate + a generated, hash-verified `index.json`).

The crux is that sillview's widgets are not portable data like a kasas plugin —
they are first-party React components compiled into the renderer, reached through
the [CORS broker](../kasas-integration.md#the-cors-broker), and the production CSP
(`connect-src 'self'`) forbids the renderer from fetching anything itself. So
"install a widget" cannot mean "download and run third-party code" without the
cross-origin sandbox ADR-0003 defers. The question: *what does a widget marketplace
look like that is real, safe, and shippable now?*

## Decision

Build the marketplace in two halves, choosing the **install-gated built-in** model
for v1:

1. **A separate registry repo** (`sillview-widgets`) modeled on `kasas-plugins`: each
   widget is a `widgets/<slug>/widget.toml` manifest, a Node/TypeScript CLI gates
   submissions (`validate`) and builds a deterministic, per-file-SHA-256 +
   `content_hash` catalog (`index --check`), CI publishes it to GitHub Pages, and the
   repo is MIT with a per-widget SPDX `license` field. (Same shape as kasas-plugins;
   the verification CLI is TypeScript, not Go, to reuse sillview's stack.)

2. **sillview consumes it**: the **main process** fetches the registry (never the
   renderer — CSP), an `installed-widgets.json` (atomic write + watch, like
   `dashboards.json`) records what the user installed, the "Add widget" panel offers
   only installed widgets (with search + category filters), and a Widget Marketplace
   page installs/uninstalls. On first run a recommended core set is pre-installed so
   the panel isn't empty. The MCP server enforces the same gate (`add_widget` refuses
   an uninstalled type; `install_widget` / `list_available_widgets` are new tools).

A widget's **payload model** is a manifest `kind`: only `builtin` is listable today
(its React code ships with the app, keyed by `widget_type`; installing only unlocks
it). `spec` (a declarative JSON widget) and `bundle` (a downloadable, sandboxed code
widget — see [ADR-0003](0003-third-party-code-widget-sandboxing.md)) are **reserved**
in the manifest and index so the format can grow into them without a break.

## Decision drivers

- **No new trust surface in v1.** Nothing downloads or executes third-party code, so
  the riskiest piece (ADR-0003) stays deferred while the registry, pipeline, license,
  and install/search UX all ship.
- **Reuse the proven shape.** The kasas-plugins registry + gate + `index --check` +
  Pages publish is known-good; mirroring it (and its hash chain-of-custody) honors
  the "very vanilla" preference.
- **The CORS broker is the security model.** Registry fetches run main-side and are
  exposed through a narrow `window.api.widgets` surface, exactly like kasas REST.

## Consequences

- Users must install a widget before adding it; uninstalling degrades existing tiles
  to the graceful "not installed" placeholder `WidgetHost` already renders.
- The compiled catalog and the published registry can drift; this is handled
  gracefully at runtime (an uninstalled/unknown `widget_type` simply isn't addable),
  and a parity test guards the offline fixture against the compiled catalog.
- When `spec` / `bundle` kinds land, `installed-widgets.json` install records and the
  index's `files[]` + `content_hash` (already present) carry the download + SHA-256
  verification with no format change.
