import { defineConfig } from 'vite';

/**
 * Reserved local ports for this project: **5310** (dev) and **5311** (preview).
 *
 * `strictPort` is the important half. By default Vite, on finding its port
 * taken, silently increments to the next free one — so a second project started
 * on 5173 quietly lands on 5174 while still being *called* 5173 by everyone
 * involved. When the first project later stops and the second restarts, it takes
 * 5173 and inherits the other project's `localStorage`, cookies and service
 * worker, because those belong to the **origin** `http://localhost:5173` and not
 * to the project. That is what a session "overwriting" another one actually is.
 *
 * With `strictPort: true` the collision surfaces immediately as a failed start
 * instead of as corrupted state an hour later.
 *
 * The allocation across projects lives in `D:\Development\PORTS.md`; the copy
 * that matters for this repository is in `docs/60-runbook.md`.
 */
export default defineConfig({
  base: './', // relative paths so the build also runs from GitHub Pages

  server: {
    port: 5310,
    strictPort: true,
  },

  preview: {
    port: 5311,
    strictPort: true,
  },

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
});
