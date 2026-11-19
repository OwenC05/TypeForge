import { launch, shot, note, saveLog } from './lib.mjs';
const c = await launch(process.argv[2], { width: 1440, height: 900 });
const p = c.pages()[0] ?? await c.newPage();
for (const [u, f] of [['https://typeforge-alpha.vercel.app/practice.html?mode=practice', 'dep01-deployed-practice-1440.png'], ['https://typeforge-alpha.vercel.app/index.html', 'dep02-deployed-home-1440.png']]) {
  const resp = await p.goto(u, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => null);
  note('deployed', { url: u, status: resp?.status() ?? null, lastModified: resp?.headers()['last-modified'] ?? null, etag: resp?.headers()['etag'] ?? null, scripts: await p.evaluate(() => [...document.scripts].map(s => s.src)), h1: await p.locator('h1').first().innerText().catch(() => null), hasPracticeKind: await p.locator('#practice-kind').count() });
  await shot(p, f);
}
await c.close(); saveLog('deployed-demo-log.json');
