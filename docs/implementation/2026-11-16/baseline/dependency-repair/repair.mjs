import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const out = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const root = process.cwd();
const records = JSON.parse(fs.readFileSync(path.join(out, 'primary-sources.json'), 'utf8').replace(/^\uFEFF/, ''));
const pkgPath = path.join(root, 'typing-app/client/package.json');
const lockPath = path.join(root, 'typing-app/client/package-lock.json');
const before = JSON.parse(fs.readFileSync(lockPath));
const lock = structuredClone(before);
const vite = records.find(x => x.url === 'https://registry.npmjs.org/vite/8.3.3').data;
const sm = records.find(x => x.url === 'https://registry.npmjs.org/source-map-js/1.2.2').data;
assert.equal(before.packages['node_modules/postcss'].dependencies['source-map-js'], '^1.2.1');
for (const [name, meta] of [['vite', vite], ['source-map-js', sm]]) {
  const node = lock.packages['node_modules/' + name];
  if (name === 'vite') {
    assert.equal(node.dependencies.rolldown, '~1.2.9');
    assert.equal(meta.dependencies.rolldown, '~1.2.11');
    assert.equal(lock.packages['node_modules/rolldown'].version, '1.2.11');
    node.dependencies.rolldown = meta.dependencies.rolldown;
  }
  for (const field of ['dependencies','engines','optionalDependencies','peerDependencies','peerDependenciesMeta','bin']) {
    assert.deepEqual(node[field], meta[field], `${name} ${field} changed; review required`);
  }
  node.version = meta.version; node.resolved = meta.dist.tarball; node.integrity = meta.dist.integrity;
}
lock.packages[''].devDependencies.vite = '8.3.3';
const changed = Object.keys(lock.packages).filter(k => JSON.stringify(lock.packages[k]) !== JSON.stringify(before.packages[k]));
assert.deepEqual(changed.sort(), ['', 'node_modules/source-map-js', 'node_modules/vite']);
fs.writeFileSync(path.join(out, 'changed-lock-nodes.json'), JSON.stringify(changed, null, 2));
fs.writeFileSync(pkgPath, fs.readFileSync(pkgPath, 'utf8').replace('"vite": "8.3.1"', '"vite": "8.3.3"'));
fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
console.log('Updated only root Vite pin, Vite node and source-map-js node; dependency ranges unchanged.');
