# Changelog

## [0.9.3](https://github.com/paulmeier/sillview/compare/v0.9.2...v0.9.3) (2026-06-14)


### Bug Fixes

* don't bounce kasas on save when nothing changed; make restart work in daemon mode ([#49](https://github.com/paulmeier/sillview/issues/49)) ([4a06282](https://github.com/paulmeier/sillview/commit/4a0628278594906a6e5d09a769c9b6c8ba327c94))

## [0.9.2](https://github.com/paulmeier/sillview/compare/v0.9.1...v0.9.2) (2026-06-14)


### Bug Fixes

* restart launchd daemon in place on settings save (kickstart -k) ([#47](https://github.com/paulmeier/sillview/issues/47)) ([ad587de](https://github.com/paulmeier/sillview/commit/ad587dec18fc8a71b86105b8dc048a675049dc36))

## [0.9.1](https://github.com/paulmeier/sillview/compare/v0.9.0...v0.9.1) (2026-06-13)


### Bug Fixes

* re-sign the kasas binary ad-hoc so it runs on Apple Silicon ([#45](https://github.com/paulmeier/sillview/issues/45)) ([9bd6eea](https://github.com/paulmeier/sillview/commit/9bd6eea77a708e691d461f5ff16f14726f11568c))

## [0.9.0](https://github.com/paulmeier/sillview/compare/v0.8.1...v0.9.0) (2026-06-13)


### Features

* support background mode on Linux via systemd user unit ([#43](https://github.com/paulmeier/sillview/issues/43)) ([fcc402f](https://github.com/paulmeier/sillview/commit/fcc402fbdfefda59ce1ab55b47a817703b39700a))

## [0.8.1](https://github.com/paulmeier/sillview/compare/v0.8.0...v0.8.1) (2026-06-13)


### Bug Fixes

* name the executable lowercase so Linux deb/rpm makers find it ([#41](https://github.com/paulmeier/sillview/issues/41)) ([42bab26](https://github.com/paulmeier/sillview/commit/42bab2612a14d6ae2be058a69260f7379a6b7858))

## [0.8.0](https://github.com/paulmeier/sillview/compare/v0.7.0...v0.8.0) (2026-06-13)


### Features

* build and run on Windows and Linux, not just macOS ([#38](https://github.com/paulmeier/sillview/issues/38)) ([a88f1b6](https://github.com/paulmeier/sillview/commit/a88f1b69515e0dfacf77adc577f6dd1f7f5d2231))


### Bug Fixes

* start new users with a clean, empty dashboard ([#39](https://github.com/paulmeier/sillview/issues/39)) ([e76d36d](https://github.com/paulmeier/sillview/commit/e76d36dd6736aeb1bf012d2040a2963f0f6371d2))

## [0.7.0](https://github.com/paulmeier/sillview/compare/v0.6.0...v0.7.0) (2026-06-13)


### Features

* use the README logo as the app icon and sidebar mark ([#36](https://github.com/paulmeier/sillview/issues/36)) ([306f62c](https://github.com/paulmeier/sillview/commit/306f62c3d201fd4945e4d912fed15f806e2e8333))

## [0.6.0](https://github.com/paulmeier/sillview/compare/v0.5.0...v0.6.0) (2026-06-13)


### Features

* overlay multiple market series as growth-of-$10k with per-series toggles ([#34](https://github.com/paulmeier/sillview/issues/34)) ([6aab9dd](https://github.com/paulmeier/sillview/commit/6aab9dd0f92b2d5acc109ee03b40a769fde8e07c))

## [0.5.0](https://github.com/paulmeier/sillview/compare/v0.4.0...v0.5.0) (2026-06-13)


### Features

* enter relationship target by id with live validation ([#32](https://github.com/paulmeier/sillview/issues/32)) ([c4057b6](https://github.com/paulmeier/sillview/commit/c4057b6e7fb3b9df1182b3da3d719a116018d7b6))

## [0.4.0](https://github.com/paulmeier/sillview/compare/v0.3.1...v0.4.0) (2026-06-13)


### Features

* scope market widget requests to the visible window ([#31](https://github.com/paulmeier/sillview/issues/31)) ([84316d8](https://github.com/paulmeier/sillview/commit/84316d867fb8c64e797411ae15597d045512ef76))
* sources as an icon list with per-source detail pages ([#29](https://github.com/paulmeier/sillview/issues/29)) ([616f61b](https://github.com/paulmeier/sillview/commit/616f61b5ff131b975a8a6c616eea1e5c3ebc8f08))

## [0.3.1](https://github.com/paulmeier/sillview/compare/v0.3.0...v0.3.1) (2026-06-12)


### Bug Fixes

* restore page scrolling by adding min-h-0 to PageShell ([#27](https://github.com/paulmeier/sillview/issues/27)) ([98b67ee](https://github.com/paulmeier/sillview/commit/98b67ee610e9f40d485590ebd3e151c3a3da8cdf))

## [0.3.0](https://github.com/paulmeier/sillview/compare/v0.2.1...v0.3.0) (2026-06-12)


### Features

* market-data widgets & provider settings (ADR-0004) ([#25](https://github.com/paulmeier/sillview/issues/25)) ([594ea8e](https://github.com/paulmeier/sillview/commit/594ea8ebd04581a149ca26d1b74d05a544c9f056))

## [0.2.1](https://github.com/paulmeier/sillview/compare/v0.2.0...v0.2.1) (2026-06-12)


### Documentation

* align README badges and logo with kasas ([#23](https://github.com/paulmeier/sillview/issues/23)) ([dbab552](https://github.com/paulmeier/sillview/commit/dbab552baf18a0a546cb2791610bb0ca5b5a1645))

## [0.2.0](https://github.com/paulmeier/sillview/compare/v0.1.4...v0.2.0) (2026-06-12)


### Features

* reach feature parity with the kasas web dashboard ([#20](https://github.com/paulmeier/sillview/issues/20)) ([6d9060c](https://github.com/paulmeier/sillview/commit/6d9060c90dfc3002f206a841d9c88953aee4cc09))

## [0.1.4](https://github.com/paulmeier/sillview/compare/v0.1.3...v0.1.4) (2026-06-12)


### Documentation

* add ADR-0004 for external market data ownership and storage ([#18](https://github.com/paulmeier/sillview/issues/18)) ([fba55c9](https://github.com/paulmeier/sillview/commit/fba55c9d5099a5949e383dfafaa77e0e01581a18))

## [0.1.3](https://github.com/paulmeier/sillview/compare/v0.1.2...v0.1.3) (2026-06-12)


### Documentation

* add ADRs for user-created widgets and backend-plugin activation ([#16](https://github.com/paulmeier/sillview/issues/16)) ([f78a49a](https://github.com/paulmeier/sillview/commit/f78a49a49403336a7e6dc653f066ff313eb7fb5b))

## [0.1.2](https://github.com/paulmeier/sillview/compare/v0.1.1...v0.1.2) (2026-06-12)


### Documentation

* adopt kasas's dual-license model + CLA ([#12](https://github.com/paulmeier/sillview/issues/12)) ([3f284cf](https://github.com/paulmeier/sillview/commit/3f284cf08331a880c2b5809fdf43e654ce664bf3))

## [0.1.1](https://github.com/paulmeier/sillview/compare/v0.1.0...v0.1.1) (2026-06-12)


### Documentation

* add MkDocs Material site published to GitHub Pages ([#10](https://github.com/paulmeier/sillview/issues/10)) ([c878a3d](https://github.com/paulmeier/sillview/commit/c878a3d2618aed49a92a600b2c0e829ea314c145))
