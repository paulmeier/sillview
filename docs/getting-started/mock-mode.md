# Offline Mock Mode

Mock mode runs the **entire Sillview UI on in-memory fixtures** — no kasas, no
network, no real data. It's the fastest way to iterate on widgets and layout, and
it's how much of the UI is tested.

```bash
make mock            # or: npm run start:mock
```

Both set the `KASAS_MOCK=1` environment variable. The flag is **off by default**,
so a normal `npm start` / `make dev` is completely unaffected.

## What it does

With `KASAS_MOCK=1` the main process:

- answers **every REST call** from in-memory fixtures instead of hitting kasas,
- **does not spawn** the kasas binary, and
- feeds the live event stream **synthetic events** (one every ~12 seconds) so the
  live-activity widgets animate.

The seam is small because all REST traffic funnels through one broker and the
live feed through one stream consumer — mock mode just swaps the implementations
behind those two seams (`src/main/kasas/mock.ts`).

## The dataset

The fixtures are generated from a **seeded PRNG, relative to "now"**, so the data
always looks current and every widget has something to show:

- ~5 accounts across a few currencies,
- ~6 months of transactions,
- labels derived from the transactions,
- a recent sync run.

Money stays a **decimal string** (including 8-decimal BTC), and a guard prevents
future-dated rows, so cash-flow and "recent" windows never age out or break.

The mock router honors the same query parameters the real endpoints do —
`limit` / `offset`, the `since` / `until` time window, `account_id`, and
`label_*` filters — so widgets behave the way they will against real kasas.

## When to use it

| Use mock mode when… | Use the real backend when… |
| --- | --- |
| Building or restyling a widget | Verifying real sync / data shapes |
| Working on layout, the marketplace, dialogs | Testing the managed-backend lifecycle |
| You have no kasas binary or data | Testing background mode or updates |

For the real path, see [Quick Start](quick-start.md) and
[Settings & Backend](settings.md).
