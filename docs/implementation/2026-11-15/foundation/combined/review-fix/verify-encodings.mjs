import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const client = new URL('../../../../../../typing-app/client/', import.meta.url);
const app = new URL('src/app.ts', client);
const original = readFileSync(app);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const lf = original.toString('utf8').replace(/\r\n/g, '\n');
const summary = {originalSha256: digest(original), originalCrlf: (original.toString().match(/\r\n/g) ?? []).length, runs: []};
const npmCli = process.argv[2];
assert.ok(npmCli, 'Pass the installed npm-cli.js path');
const restartNames = '^(Restart waits for fresh calibration|restarted retest re-resolves exact origin|assessment from URLs never acquire retest lineage)';
function run(encoding, name, args) {
  const result = spawnSync(process.execPath, args, {cwd: fileURLToPath(client), encoding: 'utf8', windowsHide: true, shell: false});
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  writeFileSync(new URL(`${encoding}-${name}.txt`, import.meta.url), output.trimEnd() + '\n');
  summary.runs.push({encoding, name, command: ['node', ...args], exit: result.status, signal: result.signal, error: result.error?.message});
  assert.equal(result.status, 0, `${encoding} ${name} failed; see log`);
}
try {
  for (const encoding of ['LF', 'CRLF']) {
    writeFileSync(app, encoding === 'LF' ? lf : lf.replace(/\n/g, '\r\n'));
    const bytes = readFileSync(app);
    const crlf = (bytes.toString().match(/\r\n/g) ?? []).length;
    assert.equal(crlf, encoding === 'LF' ? 0 : (lf.match(/\n/g) ?? []).length);
    summary.runs.push({encoding, sha256: digest(bytes), crlf});
    run(encoding, 'check', [npmCli, 'run', 'check']);
    run(encoding, 'typecheck', [npmCli, 'run', 'typecheck']);
    run(encoding, 'build', [npmCli, 'run', 'build']);
    run(encoding, 'restart-assertions', ['--import', new URL('count-assertions.mjs', import.meta.url).href, '--experimental-strip-types', '--test', '--test-name-pattern', restartNames, 'tests/app.test.ts']);
  }
} finally {
  writeFileSync(app, original);
  summary.restoredSha256 = digest(readFileSync(app));
  summary.restoredExactBytes = original.equals(readFileSync(app));
  writeFileSync(new URL('encoding-results.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n');
  assert.ok(summary.restoredExactBytes, 'Original app.ts bytes must be restored');
}
console.log(JSON.stringify(summary, null, 2));
