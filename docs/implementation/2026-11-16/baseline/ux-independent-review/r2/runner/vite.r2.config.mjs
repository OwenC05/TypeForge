// Review-owned r2 runner: builds the frozen author prototype (3ad71b6 = root ecf8d18) composed with
// the root-integrated production stylesheet that the prototype imports by relative path from this
// worktree (style.css blob 1b10cbea…, root ecf8d18). Writes only to TF_REVIEW_OUT.
// Packages (Vite 8.3.3, @ui-sdk/web) resolve from a client folder whose package-lock.json matches
// root (sha256 c54a9f65…), given by TF_REVIEW_NM_CLIENT; nothing is installed.
import { resolve } from 'node:path';

const here = import.meta.dirname;
const proto = resolve(here, '../../../ux/prototype');
const client = process.env.TF_REVIEW_NM_CLIENT;
const out = process.env.TF_REVIEW_OUT;
const port = Number(process.env.TF_REVIEW_PORT ?? 5318);
if (!client || !out) throw new Error('set TF_REVIEW_NM_CLIENT and TF_REVIEW_OUT');
const importer = resolve(client, 'src/main.ts');

export default {
  root: proto,
  base: './',
  cacheDir: resolve(out, 'vite-cache'),
  logLevel: 'info',
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
  preview: { host: '127.0.0.1', port, strictPort: true },
};
