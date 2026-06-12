# Widget Catalog

Widgets are the building blocks of a dashboard. The **marketplace** lets you
browse them by category and drop them onto the grid. Every widget is declared in
one catalog (`src/renderer/widgets/registry.ts`) that both the marketplace UI and
the dashboard engine read.

## The marketplace

The marketplace panel lists each available widget with its title, description,
category, and icon. Adding one places it on the current dashboard at its default
size. Categories group related widgets so the catalog stays browsable as it grows.

## Built-in widgets

The widgets that ship today, by category:

### Overview

| Widget | What it shows |
| --- | --- |
| **Net Worth** | Total balance across all accounts, grouped by currency. |
| **Sync Status** | Backend connectivity and the most recent sync run. |

### Accounts

| Widget | What it shows |
| --- | --- |
| **Accounts** | Every account with its current balance. |
| **Account Balances** | A bar chart comparing balances across accounts. |

### Activity

| Widget | What it shows |
| --- | --- |
| **Transactions** | The most recent transactions across all accounts. |
| **Live Activity** | A live feed of change events streamed from kasas. |

### Spending

| Widget | What it shows |
| --- | --- |
| **Spending Breakdown** | Outflow grouped by your most-used label (or payee). |
| **Cash Flow** | Money in vs. out per month over the last six months. |

!!! tip "See them with no setup"
    Run [mock mode](../getting-started/mock-mode.md) (`make mock`) to populate
    every widget with realistic, relative-to-now fixture data — no backend or real
    data required.

## Charts (Tremor-style)

Chart widgets use **Tremor**-style components built on **Recharts**, living in
`src/renderer/components/tremor/` (Card, AreaChart, BarChart, DonutChart, and a
shared tooltip). Sillview uses Tremor in its copy-paste/Recharts form rather than
the frozen `@tremor/react` package, because that package requires Tailwind v3 and
Sillview is on Tailwind v4 — see [Toolchain notes](../development/workflow.md).

## Anatomy of a widget

Each catalog entry is a `WidgetDefinition`:

```ts
{
  type: 'net-worth',                 // stable id, used in saved layouts
  title: 'Net Worth',
  description: 'Total balance across all accounts, grouped by currency.',
  category: 'Overview',
  icon: RiWallet3Line,               // a Remix icon
  defaultSize: { w: 4, h: 3, minW: 3, minH: 2 },
  component: NetWorthWidget,         // the React component
}
```

Adding your own widget is one entry here plus a component file — see
[Building a Widget](../development/building-a-widget.md).
