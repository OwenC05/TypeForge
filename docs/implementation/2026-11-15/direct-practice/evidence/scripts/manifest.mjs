// Source/build identity for the final evidence -> ../manifest.json
// Records the last commit touching typing-app/client, its source tree hash, the sha256 of every built
// asset in typing-app/client/dist, and for each receipt that recorded the served build (Vite
// content-hashed asset names) whether it matches this dist exactly.
// Usage (from the repository root): node docs/.../evidence/scripts/manifest.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidence = path.resolve(here, '..');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const root = git('rev-parse', '--show-toplevel');
const dist = path.join(root, 'typing-app/client/dist');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const assets = Object.fromEntries(fs.readdirSync(path.join(dist, 'assets')).sort().map(file => [file, sha(path.join(dist, 'assets', file))]));
const html = Object.fromEntries(fs.readdirSync(dist).filter(file => file.endsWith('.html')).sort().map(file => [file, sha(path.join(dist, file))]));
const clientCommit = git('log', '-1', '--format=%H', '--', 'typing-app/client');
const sourceCommit = git('log', '-1', '--format=%H', '--', 'typing-app/client/src');
const servedNames = ['app', 'define-element', 'env'].map(stem => Object.keys(assets).find(name => name.startsWith(`${stem}-`) && name.endsWith('.js'))).concat(Object.keys(assets).filter(name => /^app-.*\.css$/.test(name))).sort();
const receipts = {};
for (const file of fs.readdirSync(evidence).filter(name => name.endsWith('.json') && name !== 'manifest.json').sort()) {
  const data = JSON.parse(fs.readFileSync(path.join(evidence, file), 'utf8'));
  const runs = Array.isArray(data.runs) ? data.runs.map(run => run.build) : [data.build];
  const builds = runs.filter(Boolean);
  receipts[file] = builds.length
    ? { recordedBuild: builds.map(build => build.assets), matchesThisDist: builds.map(build => JSON.stringify(build.assets) === JSON.stringify(servedNames)) }
    : { recordedBuild: null, note: 'no served-build record in this receipt; see report.md for the build it ran on' };
}
const manifest = {
  generatedAt: new Date().toISOString(),
  branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
  clientCommit, sourceCommit,
  sourceTree: git('rev-parse', `${sourceCommit}:typing-app/client/src`),
  workingTreeClientClean: git('status', '--porcelain', '--', 'typing-app/client/src', 'typing-app/client/tests').length === 0,
  node: process.version,
  servedEntryAssets: servedNames,
  dist: { assets, html },
  receipts,
};
fs.writeFileSync(path.join(evidence, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ clientCommit, sourceCommit, sourceTree: manifest.sourceTree, clean: manifest.workingTreeClientClean, servedNames, receipts }, null, 1));
