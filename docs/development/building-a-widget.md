# Building a Widget

Adding a widget is deliberately small: **one catalog entry plus a component
file**. The catalog (`src/renderer/widgets/registry.ts`) is the single source of
truth both the [marketplace](../features/widgets.md) and the dashboard engine
read.

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

Add one `WidgetDefinition` to `src/renderer/widgets/registry.ts`:

```ts
{
  type: 'my-widget',                 // stable id — persisted in saved layouts
  title: 'My Widget',
  description: 'One line shown in the marketplace.',
  category: 'Overview',              // groups it in the marketplace
  icon: RiStarLine,                  // a @remixicon/react icon
  defaultSize: { w: 4, h: 3, minW: 3, minH: 2 },  // grid units
  component: MyWidget,
}
```

| Field | Notes |
| --- | --- |
| `type` | Stable, unique id. It's written into saved dashboards — don't rename it later. |
| `category` | An existing category (Overview, Accounts, Activity, Spending) or a new one. |
| `icon` | A Remix icon component from `@remixicon/react`. |
| `defaultSize` | Drop size in grid units; `minW`/`minH` stop it collapsing too small. |

That's it — the marketplace lists it and the grid can place it.

## 3. See it

```bash
make mock     # fixtures, no backend — fastest loop for widget work
```

Mock mode gives every widget realistic, relative-to-now data, so you can verify
layout, empty states, and formatting without a backend. See
[Offline Mock Mode](../getting-started/mock-mode.md).

## 4. Ship it

Run the gate and open a PR:

```bash
make test     # ESLint + typecheck — what CI runs
```

Use a [Conventional Commit](releases.md) PR title (e.g.
`feat: add my-widget`) — it drives the changelog and the next version.
