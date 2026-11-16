// Runs the committed typing-app/client/tests/browser/typing-flow.js (a Playwright MCP-style function)
// with playwright-core against the preview on 5301. Each browser.newContext() is served by a fresh
// persistent dp-impl-flow-* profile under SCRATCH, removed afterwards.
// Usage: PLAYWRIGHT_MODULE=… SCRATCH=… node typing-flow-runner.mjs <typing-flow.js> <out.json>
import fs from 'node:fs';
import path from 'node:path';
import { chromium, CHROME, SCRATCH, removeProfile, buildIdentity } from './lib.mjs';

const [file, outFile] = process.argv.slice(2);
const source = fs.readFileSync(file, 'utf8');
const fn = new Function(`return (${source.slice(source.indexOf('async (page)'))});`)();
const opened = [];
async function open() {
  const dir = fs.mkdtempSync(path.join(SCRATCH, 'dp-impl-flow-'));
  const context = await chromium.launchPersistentContext(dir, { executablePath: CHROME, headless: true, viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  opened.push({ context, dir });
  return context;
}
const first = await open();
const version = await (async () => { const p = await first.newPage(); const v = await p.evaluate(() => navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1]); await p.close(); return v; })();
const started = Date.now();
let result;
try { result = await fn({ context: () => ({ browser: () => ({ version: () => version, newContext: open }) }) }); } catch (error) { result = { crashed: String(error) }; }
result.seconds = Math.round((Date.now() - started) / 1000);
result.build = await buildIdentity();
for (const { context, dir } of opened) { await context.close().catch(() => {}); removeProfile(dir); }
fs.writeFileSync(outFile, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ browser: result.browser, assertions: result.assertions, passed: result.passed, failed: result.failed, fails: result.results?.filter(r => r.status === 'FAIL'), errors: result.errors, crashed: result.crashed, seconds: result.seconds }, null, 1));
if (result.crashed || result.failed !== 0 || result.errors?.length) process.exitCode = 1;
