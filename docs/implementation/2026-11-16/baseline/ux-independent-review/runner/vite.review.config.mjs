// Review-owned runner: builds and previews the frozen P2 prototype without writing inside it.
// Packages resolve from a lockfile-identical client node_modules given by TF_REVIEW_NM_CLIENT.
import { resolve } from 'node:path';

const here = import.meta.dirname;
const proto = resolve(here, '../../ux/prototype');
const client = process.env.TF_REVIEW_NM_CLIENT;
const out = process.env.TF_REVIEW_OUT;
if (!client || !out) throw new Error('set TF_REVIEW_NM_CLIENT and TF_REVIEW_OUT');
const importer = resolve(client, 'src/main.ts');

export default {
  root: proto,
  base: './',
  cacheDir: resolve(out, 'vite-cache'),
  plugins: [{
    name: 'review-resolve-from-client',
    enforce: 'pre',
    async resolveId(source, from, options) {
      if (!source.startsWith('@ui-sdk/')) return null;
      return this.resolve(source, importer, { ...options, skipSelf: true });
    },
  }],
  build: {
    outDir: resolve(out, 'dist'), emptyOutDir: true,
    rollupOptions: { input: { index: resolve(proto, 'index.html'), gallery: resolve(proto, 'gallery.html') } },
  },
  preview: { host: '127.0.0.1', port: 5318, strictPort: true },
};
