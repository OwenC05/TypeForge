// Reproducible child-local checks; no server, browser or background process.
import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {createHash} from 'node:crypto';
const evidence = dirname(fileURLToPath(import.meta.url));
const root = resolve(evidence, '../../../../..');
const client = resolve(root, 'typing-app/client');
const npmCli = resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const counter = new URL('./assertion-counter.mjs', import.meta.url).href;
const checks = [
  ['profile-model', ['--experimental-strip-types','--import',counter,'--test','--test-reporter=tap','tests/profile.test.ts','tests/model.test.ts']],
  ['typecheck', [npmCli,'run','typecheck']],
  ['build', [npmCli,'run','build']],
  ['full-tests', [npmCli,'test']],
  ['full-assertions', ['--experimental-strip-types','--import',counter,'--test','--test-reporter=tap',...readdirSync(resolve(client,'tests')).filter(f=>f.endsWith('.test.ts')).map(f=>'tests/'+f)]],
  ['after-engine', ['--experimental-strip-types',resolve(evidence,'engine-probe.mjs')]],
];
const results = [];
const outputs = {};
for (const [name, args] of checks) {
  const result = spawnSync(process.execPath,args,{cwd:client,windowsHide:true,encoding:'utf8',maxBuffer:8*1024*1024});
  const output = result.stdout + result.stderr + (result.error ? '\n'+result.error.stack : '');
  outputs[name] = output;
  writeFileSync(resolve(evidence,name+'.txt'),output.replace(/[ \t]+$/gm,'').trimEnd()+'\n');
  const assertions = [...output.matchAll(/ML04_ASSERTIONS (\{[^\n]+\})/g)].map(m=>JSON.parse(m[1]));
  results.push({name,command:[process.execPath,...args],exit:result.status,signal:result.signal,
    ...(assertions.length ? {assertions,assertionTotals:assertions.reduce((a,b)=>({attempted:a.attempted+b.attempted,passed:a.passed+b.passed,failed:a.failed+b.failed}),{attempted:0,passed:0,failed:0})}:{}),
    summaries:output.split(/\r?\n/).filter(l=>/^(# (tests|pass|fail|skipped)|ℹ (tests|pass|fail)|not ok|✖)/.test(l))});
  console.log(name+': exit '+result.status);
}
const sha256 = file => createHash('sha256').update(readFileSync(resolve(root,file))).digest('hex');
const files = ['typing-app/client/src/profile.ts','typing-app/client/tests/profile.test.ts','typing-app/client/src/generated/model.json',
  ...readdirSync(resolve(client,'dist/assets')).map(f=>'typing-app/client/dist/assets/'+f)];
const allowedFailureNames = [
  'Restart waits for fresh calibration and focus before enabling replacement input',
  'restarted retest re-resolves exact origin; deleted, incompatible or unreadable origin becomes ordinary assessment',
  'assessment from URLs never acquire retest lineage on restart; explicit practice/retest origins retain their contracts',
];
const failedNames = [...outputs['full-assertions'].matchAll(/^not ok \d+ - (.+)$/gm)].map(m=>m[1].trim());
const acceptedKnownE1 = failedNames.length===3 && allowedFailureNames.every(n=>failedNames.includes(n)) &&
  (outputs['full-assertions'].match(/code: 'ERR_INVALID_TYPESCRIPT_SYNTAX'/g) ?? []).length===3 &&
  outputs['full-assertions'].includes('# tests 101') && outputs['full-assertions'].includes('# pass 98') &&
  outputs['full-assertions'].includes('# fail 3') && outputs['full-tests'].includes('ℹ fail 3') &&
  allowedFailureNames.every(n=>outputs['full-tests'].includes('✖ '+n+' ('));
const unexpectedFailure = results.some(r=>r.exit!==0 &&
  !(acceptedKnownE1 && r.exit===1 && ['full-tests','full-assertions'].includes(r.name)));
writeFileSync(resolve(evidence,'verification.json'),JSON.stringify({synthetic:true,node:process.version,platform:process.platform,
  requested:{model:'gpt-6.1-sol',effort:'high'},observed:{clientProcess:'codex.exe',pid:1520,modelArgument:'-m gpt-6.1-sol',effortArgument:'-c model_reasoning_effort=high',backendIdentity:'unverified',appliedEffort:'unverified'},
  acceptedKnownE1,allowedFailureNames,unexpectedFailure,
  checks:results,sha256:Object.fromEntries(files.map(f=>[f,sha256(f)]))},null,2)+'\n');
process.exitCode = unexpectedFailure ? 1 : 0;
