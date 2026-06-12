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
  // react-draggable (the drag/resize engine under react-grid-layout and
  // react-resizable) guards a debug log with `if (process.env.DRAGGABLE_DEBUG)`.
  // The sandboxed Electron renderer has no `process` global, so that line throws
  // `ReferenceError: process is not defined` on every drag/resize start — before
  // the gesture begins — silently breaking widget moving and resizing. Statically
  // replacing the reference removes the runtime lookup. (NODE_ENV is already
  // defined by Vite, so only DRAGGABLE_DEBUG needs handling.)
  define: {
    'process.env.DRAGGABLE_DEBUG': 'false',
  },
});
