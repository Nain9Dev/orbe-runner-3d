import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Permite ejecutar el juego de forma relativa en GitHub Pages
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});
