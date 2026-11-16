import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Local prototype only. Reads the production stylesheet; never writes outside this folder.
const here = import.meta.dirname;
export default defineConfig({
  root: here,
  base: './',
  server: { fs: { allow: [resolve(here, '../../../../../..')] } },
  build: { outDir: resolve(here, 'dist'), emptyOutDir: true, rollupOptions: { input: { index: resolve(here, 'index.html'), gallery: resolve(here, 'gallery.html') } } },
});
