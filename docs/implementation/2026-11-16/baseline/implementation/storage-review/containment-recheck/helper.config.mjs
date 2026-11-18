import { fileURLToPath } from 'node:url';
export default {
  root: process.cwd(),
  cacheDir: fileURLToPath(new URL('./.vite-cache', import.meta.url)),
  optimizeDeps: { noDiscovery: true, include: [] },
};
