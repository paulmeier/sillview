import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'Sillview',
    appBundleId: 'so.kasas.sillview',
    appCategoryType: 'public.app-category.finance',
    // Bundle the kasas backend binary alongside the app. It lands at
    // `process.resourcesPath/bin/kasas` and is kept OUTSIDE the asar archive so
    // it stays executable. Run `npm run sync:kasas` to produce it first.
    // NOTE: for notarized distribution this binary must also be code-signed
    // (osxSign with the right entitlements) — tracked as a follow-up.
    extraResource: ['resources/bin'],
    // Code signing + notarization for release builds are intentionally left off.
    // Enable by supplying creds via env vars only (never inline):
    //   osxSign: {},
    //   osxNotarize: { appleId: process.env.APPLE_ID!, appleIdPassword: process.env.APPLE_PASSWORD!, teamId: process.env.APPLE_TEAM_ID! },
  },
  rebuildConfig: {},
  makers: [
    // macOS (our first target): DMG installer + ZIP (ZIP is required for
    // Squirrel.Mac auto-update). The Windows/Linux makers below are harmless on
    // macOS — `make` only runs the makers whose platforms include the host.
    new MakerDMG({}, ['darwin']),
    new MakerZIP({}, ['darwin']),
    new MakerSquirrel({}),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          // .mts so Vite loads it as ESM — @tailwindcss/vite and
          // @vitejs/plugin-react are ESM-only and can't be require()'d.
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
