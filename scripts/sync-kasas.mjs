#!/usr/bin/env node
/**
 * Builds the kasas binary from the sibling repo and copies it into
 * resources/bin/ so Electron Forge can bundle it (see forge.config.ts
 * extraResource). The binary is gitignored — run this before `npm start`
 * or `npm run make`.
 *
 *   npm run sync:kasas                 # build ../kasas and copy
 *   KASAS_REPO=/path/to/kasas npm run sync:kasas
 *   KASAS_SKIP_BUILD=1 npm run sync:kasas   # just copy the existing bin/kasas
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, chmodSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sillview = resolve(here, '..');
const kasasRepo = process.env.KASAS_REPO ?? resolve(sillview, '..', 'kasas');
const src = join(kasasRepo, 'bin', 'kasas');
const destDir = join(sillview, 'resources', 'bin');
const dest = join(destDir, 'kasas');

if (!existsSync(kasasRepo)) {
  console.error(`✘ kasas repo not found at ${kasasRepo}. Set KASAS_REPO=/path/to/kasas.`);
  process.exit(1);
}

if (!process.env.KASAS_SKIP_BUILD) {
  console.log(`▸ Building kasas in ${kasasRepo} (make build)…`);
  const r = spawnSync('make', ['build'], { cwd: kasasRepo, stdio: 'inherit' });
  if (r.status !== 0) {
    if (existsSync(src)) {
      console.warn('⚠ `make build` failed; copying the existing bin/kasas instead.');
    } else {
      console.error('✘ `make build` failed and no prebuilt bin/kasas exists.');
      process.exit(r.status ?? 1);
    }
  }
}

if (!existsSync(src)) {
  console.error(`✘ Expected built binary at ${src} but it does not exist.`);
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
chmodSync(dest, 0o755);
const mb = (statSync(dest).size / 1e6).toFixed(1);
console.log(`✔ Copied kasas (${mb} MB) → ${dest}`);
