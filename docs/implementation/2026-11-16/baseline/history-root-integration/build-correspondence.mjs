import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root = process.cwd(), dist = path.join(root, 'typing-app/client/dist');
const out = path.join(root, 'docs/implementation/2026-11-16/baseline/history-root-integration');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const files = fs.readdirSync(dist, {recursive:true}).filter(f => fs.statSync(path.join(dist,f)).isFile());
const report = {at:new Date().toISOString(), base:'http://127.0.0.1:5301', entries:files.filter(f=>f.endsWith('.html')), files:[], devMarkers:[]};
for (const file of files) {
  const local = fs.readFileSync(path.join(dist, file));
  const response = await fetch(report.base + '/' + file.replaceAll('\\','/'));
  const served = Buffer.from(await response.arrayBuffer());
  report.files.push({file, status:response.status, localSha256:hash(local), servedSha256:hash(served)});
  if (/\.(html|js|css|map)$/.test(file)) {
    for (const marker of ['/@vite/client','/@vite/env','/@react-refresh','__open-in-editor','vite-hmr','source-map-js','SourceMapConsumer']) {
      if (local.includes(marker)) report.devMarkers.push({file, marker});
    }
  }
}
report.source = Object.fromEntries(['typing-app/client/package.json','typing-app/client/package-lock.json', ...fs.readdirSync('typing-app/client/src',{recursive:true}).filter(f=>fs.statSync(path.join('typing-app/client/src',f)).isFile()).map(f=>path.join('typing-app/client/src',f))].map(f=>[f,hash(fs.readFileSync(f))]));
fs.writeFileSync(path.join(out,'build-correspondence.json'),JSON.stringify(report,null,2));
assert.equal(report.devMarkers.length,0);
assert(report.files.every(f=>f.status===200 && f.localSha256===f.servedSha256));
console.log(`${report.entries.length} HTML entries; ${report.files.length} served files match built hashes; zero dev markers.`);
