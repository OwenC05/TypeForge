import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const dir = new URL('./', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');
for (const file of ['probes.js','probe.html']) writeFileSync(new URL(file,dir),readFileSync(new URL(`../${file}`,dir)));
const original = readFileSync(new URL('../browser-runner.cjs',dir),'utf8');
let adapted = original.replace('/storage-review/probe.html','/storage-review/containment-recheck/probe.html')
  .replace("const database='typeforge-c-independent-'+Date.now().toString(16)+'-'+Math.random().toString(16).slice(2);",'let database;')
  .replace('await p.goto(url); await peer.goto(url);',"await p.goto(url); await peer.goto(url); database = 'typeforge-c-independent-'+await p.evaluate(()=>crypto.randomUUID());");
adapted = adapted.replace('p.on(\'pageerror\',e=>errors.push(String(e)));', "p.on('pageerror',e=>errors.push(String(e))); await context.addInitScript(() => { window.recheckUnhandled=[]; window.addEventListener('unhandledrejection',event=>window.recheckUnhandled.push(String(event.reason))); });");
adapted = adapted.replace("peer.on('pageerror',e=>errors.push(String(e)));", "peer.on('pageerror',e=>errors.push(String(e))); await context.addInitScript(() => { window.recheckUnhandled=[]; window.addEventListener('unhandledrejection',event=>window.recheckUnhandled.push(String(event.reason))); });");
adapted = adapted.replace('result=await p.evaluate(which=>window.probe.run(which),which);',"result=await p.evaluate(which=>window.probe.run(which),which); result.unhandledRejections=await p.evaluate(()=>window.recheckUnhandled);");
adapted = adapted.replace('notifications=await p.evaluate(()=>notifications);',"notifications=await p.evaluate(()=>notifications); notifications.unhandledRejections = await p.evaluate(()=>window.recheckUnhandled); notifications.peerUnhandledRejections = await peer.evaluate(()=>window.recheckUnhandled);");
writeFileSync(new URL('browser-runner.cjs',dir),adapted);
writeFileSync(new URL('adaptation.json',dir),JSON.stringify({originalProbeSha256:hash(readFileSync(new URL('../probes.js',dir))),copiedProbeSha256:hash(readFileSync(new URL('probes.js',dir))),originalRunnerSha256:hash(original),adaptedRunnerSha256:hash(adapted),changes:['Probe URL moves into containment-recheck only; origin stays strict5325','Two-page database names use browser crypto.randomUUID, preserving all assertions','Add passive unhandledrejection recording without changing original63 assertions']},null,2)+'\n');
