# Building a Widget

Adding a widget is deliberately small: **one metadata entry, one component file,
and two lines wiring them together**. The pure metadata lives in
`src/shared/widgets.ts` (React-free, so the
[MCP server](../../README.md#mcp-server--let-an-llm-build-dashboards) can read and
validate it); the renderer's `src/renderer/widgets/registry.ts` attaches the icon
and component. Together they're the single source both the
[marketplace](../features/widgets.md) and the dashboard engine read.

## 1. Write the component

Add a component under `src/renderer/widgets/`. Fetch data with the renderer's
typed kasas client and hooks (`src/renderer/api/`) — **never** call the network
directly; that goes through the
[main-process broker](../architecture/kasas-integration.md#the-cors-broker). Use
the Tremor-style chart components in `src/renderer/components/tremor/` for
visuals.

```tsx
// src/renderer/widgets/MyWidget.tsx
import { Card } from '../components/tremor/Card';
import { useAccounts } from '../api/hooks';

export function MyWidget() {
  const { data, error } = useAccounts();
  if (error) return <Card>Couldn't load accounts.</Card>;
  return <Card>{/* render data */}</Card>;
}
```

Keep two rules in mind:

- **Money is a decimal string** in major units with variable scale. Format it via
  `src/renderer/lib/money.ts`; the parse helper is for **sort/sum only**, never
  for display.
- Your widget renders inside an **error boundary**, so a thrown render error is
  contained — but prefer to handle the error and empty states explicitly.

## 2. Register it

First add one `WidgetMeta` entry to `WIDGET_META` in `src/shared/widgets.ts`:

```ts
{
  type: 'my-widget',                 // stable id — persisted in saved layouts
  title: 'My Widget',
  description: 'One line shown in the marketplace.',
  category: 'Overview',              // groups it in the marketplace
  defaultSize: { w: 4, h: 3, minW: 3, minH: 2 },  // grid units
  // configSpec: [ ... ]             // only if the widget reads config (see below)
}
```

Then attach the icon + component by adding your `type` to the `ICONS` and
`COMPONENTS` maps in `src/renderer/widgets/registry.ts`:

```ts
const ICONS = { /* ... */ 'my-widget': RiStarLine };       // @remixicon/react
const COMPONENTS = { /* ... */ 'my-widget': MyWidget };
```

(Forget one and the registry logs an error and drops the widget rather than
crashing — so check the console if a new widget doesn't appear.)

| Field | Notes |
| --- | --- |
| `type` | Stable, unique id. It's written into saved dashboards — don't rename it later. |
| `category` | An existing category (Overview, Accounts, Activity, Spending, Market) or a new one. |
| `defaultSize` | Drop size in grid units; `minW`/`minH` stop it collapsing too small. |
| `configFields` | Optional — knobs rendered in the in-app Configure dialog. |
| `configSpec` | Optional but **required to be configurable from the MCP server** — the authoritative list of config keys + accepted types your component reads. Without it, the MCP server treats the widget as taking no config. |

That's it — the marketplace lists it, the grid can place it, and (with a
`configSpec`) an assistant can author it.

## 3. Publish it to the marketplace

Widgets are now **install-gated**: the "Add widget" panel offers only widgets the
user has installed from the [Widget Marketplace](../features/widgets.md), backed by
the community registry repo
[`sillview-widgets`](https://github.com/paulmeier/sillview-widgets) (see
[ADR-0005](../architecture/decisions/0005-widget-marketplace-and-install-gating.md)).
A widget's React code still ships with the app (above); the marketplace entry is the
metadata that makes it **installable**.

To list a new widget, add a `widgets/<slug>/widget.toml` to the `sillview-widgets`
repo (a `kind = "builtin"` manifest whose `widget_type` is the `type` you registered
here), run its gate (`npm run validate && npm run index`), and open a PR. CI verifies
the manifest and that the committed `registry/index.json` is current. Offline (mock)
development uses a fixture catalog **derived from `WIDGET_META`**, so a new widget is
installable in `make mock` immediately, without touching the registry repo.

## 4. See it

```bash
make mock     # fixtures, no backend — fastest loop for widget work
```

Mock mode gives every widget realistic, relative-to-now data, so you can verify
layout, empty states, and formatting without a backend. See
[Offline Mock Mode](../getting-started/mock-mode.md).

## 5. Ship it

Run the gate and open a PR:

```bash
make test     # ESLint + typecheck — what CI runs
```

Use a [Conventional Commit](releases.md) PR title (e.g.
`feat: add my-widget`) — it drives the changelog and the next version.
