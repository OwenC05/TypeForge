import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const scratch = path.resolve(process.env.SDK_SCRATCHPAD);
const require = createRequire(path.join(root, 'package.json'));
const measure = dir => {
  const files = fs.readdirSync(dir, { recursive: true }).filter(file => /\.(js|css)$/.test(file)).map(file => {
    const bytes = fs.readFileSync(path.join(dir, file));
    return { file, raw: bytes.length, gzip: gzipSync(bytes).length };
  });
  return { files, js: sum(files.filter(file => file.file.endsWith('.js'))), css: sum(files.filter(file => file.file.endsWith('.css'))) };
};
const sum = files => files.reduce((total, file) => ({ raw: total.raw + file.raw, gzip: total.gzip + file.gzip }), { raw: 0, gzip: 0 });
const production = measure(path.join(root, 'dist/assets'));
const proofDir = path.join(scratch, 'dp-sdk-proof-build');
await build({ configFile: false, root, base: './', build: {
  outDir: proofDir, emptyOutDir: true,
  rollupOptions: { input: path.join(root, 'tests/browser/ui-sdk-proof.html') },
} });
const results = { production, proof: measure(proofDir) };
const entries = ['segmented-control', 'switch', 'select', 'collapsible', 'button'];
for (const withAgent of [false, true]) {
  const name = withAgent ? 'agent' : 'components';
  const imports = [...entries.map(entry => `@ui-sdk/web/${entry}`), ...(withAgent ? ['@ui-sdk/web/agent'] : [])];
  const entry = path.join(scratch, `dp-sdk-imports-${name}.mjs`);
  fs.writeFileSync(entry, imports.map(specifier => specifier.endsWith('/agent')
    ? `import { createAgent } from ${JSON.stringify(require.resolve(specifier).replaceAll('\\', '/'))}; window.costAgent = createAgent();`
    : `import ${JSON.stringify(require.resolve(specifier).replaceAll('\\', '/'))};`).join('\n'));
  const outDir = path.join(scratch, `dp-sdk-${name}-build`);
  await build({ configFile: false, root, build: { outDir, emptyOutDir: true, rollupOptions: { input: entry } } });
  results[name] = measure(outDir);
}
fs.writeFileSync(path.join(scratch, 'dp-sdk-bundle.json'), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
