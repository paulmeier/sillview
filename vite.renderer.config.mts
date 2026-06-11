import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Renderer-only config. React + Tailwind v4 live here and must NOT be added to
// the main/preload Vite configs. `base: './'` makes asset URLs relative so the
// packaged renderer loads correctly over file://.
// https://vitejs.dev/config
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
