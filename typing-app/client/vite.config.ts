import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Relative assets keep local previews and /TypeForge/ deployments identical.
  base: './',
  build: {
    rollupOptions: {
      input: readdirSync(fileURLToPath(new URL('.', import.meta.url)))
        .filter((name) => name.endsWith('.html'))
        .map((name) => fileURLToPath(new URL(name, import.meta.url))),
    },
  },
});
