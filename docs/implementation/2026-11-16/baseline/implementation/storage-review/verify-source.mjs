import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const directory = new URL('./', import.meta.url);
const pin = '2832ceef907a02ca7a9487bfe7eb6b398218d911';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
const before = JSON.parse(readFileSync(new URL('source-before.json', directory)));
const after = before.map(entry => {
  const gitBlob = git('hash-object', `--path=${entry.path}`, entry.path);
  const sha256 = createHash('sha256').update(readFileSync(entry.path)).digest('hex');
  assert.equal(gitBlob, git('rev-parse', `${pin}:${entry.path}`), entry.path);
  assert.equal(gitBlob, entry.gitBlob, entry.path);
  assert.equal(sha256, entry.sha256, entry.path);
  return { path: entry.path, gitBlob, sha256 };
});
const contract = readFileSync('docs/implementation/2026-11-16/baseline/policy/interfaces-r2.ts', 'utf8')
  .replace("from '../../../../../typing-app/client/src/engine.ts'", "from './engine.ts'");
assert.equal(contract, readFileSync('typing-app/client/src/coach-types.ts', 'utf8'));
assert.equal(git('diff', '--name-only', pin, '--', 'typing-app/client'), '');
const result = { sourcePin: pin, briefHead: git('rev-parse', 'HEAD'), pinnedFiles: before.length,
  beforeAfterEqual: true, typeMirrorEqualExceptEngineImport: true, sourceDiffFromPin: [],
  node: process.version, scopeDiff: git('status', '--short') };
writeFileSync(new URL('source-after.json', directory), JSON.stringify(after, null, 2) + '\n');
writeFileSync(new URL('source-verification.json', directory), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
