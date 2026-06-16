# README media

Assets embedded by the root [`README.md`](../../README.md).

## `demo.gif`

A guided tour of the Sillview desktop app, embedded near the top of the README — it
autoplays and loops on GitHub. The whole tour runs on the offline **mock dataset**
(`KASAS_MOCK=1`), so there is no backend, no network, and no real financial data in
any frame.

The tour walks: the seeded **Investments** dashboard (a growth-of-$10k market
comparison next to a benchmark overlay), **edit mode** with the configSpec-driven
**Configure** dialog, the **Widget Marketplace** (browse the verified catalog, filter
by category, install a widget), building a **new dashboard from scratch** (add the
just-installed widget plus net worth and accounts), then the kasas-parity surfaces —
the **Transactions** table, the **Search** query language, **Accounts**, **Labels**,
the live **Event stream**, **Sources**, **Rules**, **Webhooks**, **Plugins**, and a
sandboxed plugin's **Budget Coach** page — ending back on the dashboard so the loop
is seamless.

`1080×702`, ~29s, ~1.0 MB. Generated the same way as the
[kasas demo](https://github.com/paulmeier/kasas/blob/main/.github/assets/README.md):
drive the live app headlessly over a deterministic dataset, capture one PNG per UI
state, then assemble the frames with an ffmpeg two-pass palette (best color/size for
flat UI).

Because Sillview is an Electron app, the "headless drive" launches the **un-fused dev
`electron` binary** against the production `.vite` build (`npm run package` first) so
[Playwright](https://playwright.dev)'s Electron support can drive it, with
`KASAS_MOCK=1` and a throwaway `--user-data-dir` so the mock board is what loads. The
capture script is a throwaway (not committed); the frame → GIF step is:

```sh
# frames/*.png -> optimized, looping gif (~0.9s per frame)
ffmpeg -y -framerate 1.1 -pattern_type glob -i 'frames/*.png' \
  -vf "scale=1080:-1:flags=lanczos,palettegen=stats_mode=full" palette.png
ffmpeg -y -framerate 1.1 -pattern_type glob -i 'frames/*.png' -i palette.png \
  -lavfi "scale=1080:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a" \
  -loop 0 demo.gif
```
