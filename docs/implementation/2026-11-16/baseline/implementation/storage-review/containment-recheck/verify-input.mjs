import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const dir = new URL('./', import.meta.url);
const original = 'f6a92561c57a4cf4abd65af0d27c92c3952ad75e';
const correction = '7109d2c53120ba67388e07609254dc825e8ac5a4';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const paths = JSON.parse(readFileSync(new URL('../source-after.json', dir))).map(entry => entry.path);
const oldPaths = git('ls-tree', '-r', '--name-only', original, '--', 'docs/implementation/2026-11-16/baseline/implementation/storage-review').split('\n');
const oldEvidence = oldPaths.map(path => {
  const expected = git('rev-parse', `${original}:${path}`), actual = git('hash-object', `--path=${path}`, path);
  assert.equal(actual, expected, path);
  return { path, gitBlob: actual, sha256: digest(path) };
});
const changed = git('diff-tree', '--no-commit-id', '--name-only', '-r', correction).split('\n');
const beforeMode = process.argv.includes('--before');
const sources = paths.map(path => {
  const actual = git('hash-object', `--path=${path}`, path);
  const expected = git('rev-parse', `${beforeMode ? original : changed.includes(path) ? correction : original}:${path}`);
  assert.equal(actual, expected, path);
  return { path, gitBlob: actual, sha256: digest(path), corrected: changed.includes(path) };
});
const result = { original, correction, head: git('rev-parse','HEAD'), changed, sources, oldEvidence };
if (!beforeMode) {
  const before = JSON.parse(readFileSync(new URL('input-before.json', dir)));
  assert.deepEqual(oldEvidence, before.oldEvidence, 'Original review evidence is immutable');
  for (let i=0;i<sources.length;i++) if (!sources[i].corrected) assert.deepEqual(sources[i],before.sources[i],sources[i].path);
}
writeFileSync(new URL(beforeMode ? 'input-before.json' : 'input-after.json', dir), JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({ head: result.head, sourcePaths:sources.length, preservedEvidence:oldEvidence.length, correction, phase:beforeMode?'before':'after' }));
