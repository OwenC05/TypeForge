// Run canonical regression modules in the normal Node realm, with canonical app/helper bytes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
const revision = '91ca6bc3a232ed8a26a93bc59c71029ff27346e7';
const show = path => execFileSync('git', ['show', `${revision}:typing-app/client/${path}`], { encoding: 'utf8', windowsHide: true }).replace(/\r\n/g, '\n');
const dataModule = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const app = show('src/app.ts');
const helper = dataModule(stripTypeScriptTypes(show('src/unsaved.ts')));
for (const name of ['engine.ts', 'model.ts', 'profile.ts', 'generated/model.json']) {
  assert.equal(show(`src/${name}`), readFileSync(new URL(`../../../../../../typing-app/client/src/${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n'));
}
for (const file of ['continuation.test.ts', 'unsaved.test.ts']) {
  const testUrl = new URL(`../../../../../../typing-app/client/tests/${file}`, import.meta.url);
  let code = stripTypeScriptTypes(show(`tests/${file}`));
  code = code.replace(/^const source = .*;$/m, () => `const source = ${JSON.stringify(app)};`);
  code = code.replaceAll('import.meta.url', JSON.stringify(testUrl.href));
  code = code.replace(/from '([^']+)'/g, (match, spec) => spec.startsWith('../src/') ? `from '${spec === '../src/unsaved.ts' ? helper : new URL(spec, testUrl).href}'` : match);
  await import(dataModule(code));
}
