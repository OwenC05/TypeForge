// Per-chunk and per-page initial-load size comparison of two Vite dist directories.
// Usage: node bundle.mjs <base dist> <base label> <current dist> <current label> -> ../bundle.json
// Sizes: raw bytes and gzip (zlib level 9). Chunk names drop Vite's content hash. A page's initial
// load is its HTML plus the scripts, modulepreloads and stylesheets the HTML references (lazy chunks
// such as the Select popup are excluded and listed separately).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const [baseDir, baseLabel, currentDir, currentLabel] = process.argv.slice(2);
const size = file => { const bytes = fs.readFileSync(file); return { raw: bytes.length, gzip: zlib.gzipSync(bytes, { level: 9 }).length }; };
const chunkName = file => path.basename(file).replace(/-[A-Za-z0-9_-]{8}(?=\.(js|css)$)/, '');
function describe(dist) {
  const chunks = {};
  for (const file of fs.readdirSync(path.join(dist, 'assets'))) if (/\.(js|css)$/.test(file)) chunks[chunkName(file)] = { file, ...size(path.join(dist, 'assets', file)) };
  const pages = {};
  for (const html of fs.readdirSync(dist).filter(f => f.endsWith('.html'))) {
    const text = fs.readFileSync(path.join(dist, html), 'utf8');
    const unique = [...new Set([...text.matchAll(/(?:src|href)="(?:\.?\/)?(assets\/[^"]+\.(?:js|css))"/g)].map(m => m[1]))];
    // Follow static imports (from"./x.js" / import"./x.js"); dynamic import("./x.js") stays lazy.
    for (let index = 0; index < unique.length; index++) {
      if (!unique[index].endsWith('.js')) continue;
      const code = fs.readFileSync(path.join(dist, unique[index]), 'utf8');
      for (const m of code.matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g)) if (!unique.includes(`assets/${m[1]}`)) unique.push(`assets/${m[1]}`);
    }
    const total = unique.reduce((sum, ref) => { const s = size(path.join(dist, ref)); return { raw: sum.raw + s.raw, gzip: sum.gzip + s.gzip }; }, size(path.join(dist, html)));
    pages[html] = { assets: unique.map(chunkName), ...total };
  }
  return { chunks, pages };
}
const base = describe(baseDir), current = describe(currentDir);
const delta = (a, b) => ({ raw: (b?.raw ?? 0) - (a?.raw ?? 0), gzip: (b?.gzip ?? 0) - (a?.gzip ?? 0) });
const names = [...new Set([...Object.keys(base.chunks), ...Object.keys(current.chunks)])].sort();
const report = {
  generatedAt: new Date().toISOString(), base: baseLabel, current: currentLabel, method: 'vite build output; gzip via zlib level 9; initial load = HTML + referenced scripts, modulepreloads and stylesheets',
  chunks: Object.fromEntries(names.map(name => [name, { base: base.chunks[name] ?? null, current: current.chunks[name] ?? null, delta: delta(base.chunks[name], current.chunks[name]) }])),
  pages: Object.fromEntries(Object.keys(current.pages).map(page => [page, { base: base.pages[page] ?? null, current: current.pages[page], delta: delta(base.pages[page], current.pages[page]) }])),
};
report.lazyOnly = names.filter(name => current.chunks[name] && !Object.values(current.pages).some(page => page.assets.includes(name)));
fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bundle.json'), JSON.stringify(report, null, 2) + '\n');
for (const [name, c] of Object.entries(report.chunks)) console.log(name.padEnd(28), String(c.base?.gzip ?? '-').padStart(7), '->', String(c.current?.gzip ?? '-').padStart(7), 'gzip', (c.delta.gzip >= 0 ? '+' : '') + c.delta.gzip);
for (const [page, p] of Object.entries(report.pages)) console.log('PAGE', page.padEnd(22), String(p.base?.gzip ?? '-').padStart(7), '->', String(p.current.gzip).padStart(7), 'gzip', (p.delta.gzip >= 0 ? '+' : '') + p.delta.gzip);
console.log('lazy only:', report.lazyOnly.join(', '));
