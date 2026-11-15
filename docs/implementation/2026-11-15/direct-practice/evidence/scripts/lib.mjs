// Evidence harness for the T4 direct-practice implementation.
// playwright-core is NOT a project dependency: install it in a scratch directory
// (`npm install --prefix <scratch>/pw --save-exact playwright-core@1.65.1`) and set
// PLAYWRIGHT_MODULE to its index.mjs and SCRATCH to that scratch directory. Profiles are
// fresh persistent dp-impl-* directories under SCRATCH, deleted when each context closes.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.PLAYWRIGHT_MODULE || !process.env.SCRATCH) throw new Error('Set PLAYWRIGHT_MODULE and SCRATCH.');
const { chromium } = await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href);
export { chromium };
export const BASE = process.env.BASE ?? 'http://127.0.0.1:5301';
export const OUT = path.resolve(here, '..');
export const SHOTS = path.join(OUT, 'screenshots');
export const SCRATCH = path.resolve(process.env.SCRATCH);
export const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(SHOTS, { recursive: true });

export const VIEWPORTS = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 }, 320: { width: 320, height: 640 } };

let counter = 0;
const opened = new Set();
/** A fresh persistent profile (own IndexedDB/localStorage) under SCRATCH, named dp-impl-*. */
export async function launch(label, viewport, extra = {}) {
  const dir = fs.mkdtempSync(path.join(SCRATCH, `dp-impl-${label}-${counter++}-`));
  const context = await chromium.launchPersistentContext(dir, { executablePath: CHROME, headless: true, viewport, deviceScaleFactor: 1, reducedMotion: 'reduce', acceptDownloads: true, ...extra });
  const errors = [];
  const record = page => page.on('pageerror', error => errors.push(`${String(error)} @ ${page.url()}`));
  context.on('page', record);
  for (const page of context.pages()) record(page);
  const close = context.close.bind(context);
  context.close = async () => { await close().catch(() => {}); opened.delete(dir); removeProfile(dir); };
  opened.add(dir);
  return { context, dir, errors, page: context.pages()[0] ?? await context.newPage() };
}
export function removeProfile(dir) {
  if (!path.resolve(dir).startsWith(SCRATCH) || !path.basename(dir).startsWith('dp-impl-')) throw new Error(`Refusing to remove ${dir}`);
  fs.rmSync(dir, { recursive: true, force: true });
}
process.on('exit', () => { for (const dir of opened) { try { removeProfile(dir); } catch { /* best effort */ } } });

/** Chrome's own version via CDP (the UA string is reduced). */
export async function chromeVersion(context, page) {
  const session = await context.newCDPSession(page);
  const { product } = await session.send('Browser.getVersion');
  await session.detach();
  return product;
}

/** Seeded Math.random so prompt order is reproducible; installed before any app script runs. */
export const seededRandom = seed => `(() => { let s = ${seed} >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;

export const target = p => p.locator('#target-description').textContent().then(t => t.replace('Passage to copy: ', ''));
export const active = p => p.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}` : null; });
export const promptIds = p => p.evaluate(() => document.querySelector('#stage')?.dataset.promptIds ?? null);
export async function shot(page, file, opts = {}) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(SHOTS, file), ...opts });
  return `screenshots/${file}`;
}
export async function saved(p) {
  return p.evaluate(() => new Promise(resolve => {
    const open = indexedDB.open('typeforge');
    open.onerror = () => resolve([]);
    open.onsuccess = () => { const db = open.result; if (!db.objectStoreNames.contains('results')) { db.close(); resolve([]); return; }
      const r = db.transaction('results').objectStore('results').getAll(); r.onsuccess = () => { db.close(); resolve(r.result); }; };
  }));
}
export const savedInPlace = p => p.waitForFunction(() => document.querySelector('#save-state')?.textContent?.startsWith('Saved in this browser'), null, { polling: 100 });
/** Geometry probe of the stage, active line, slot and caret (read-only). */
export function geometry(p) {
  return p.evaluate(() => {
    const rect = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) }; };
    const prompt = document.querySelector('#prompt');
    const caret = document.querySelector('#prompt .cursor');
    const caretTop = caret ? caret.getBoundingClientRect().top : null;
    const surface = document.querySelector('#typing-viewport');
    return {
      viewport: { w: innerWidth, h: innerHeight }, scrollY,
      stage: rect(document.querySelector('#stage')), surface: rect(surface), slot: rect(document.querySelector('#slot')), restart: rect(document.querySelector('#restart')),
      rail: rect(document.querySelector('#rail')), prompt: rect(prompt), caret: rect(caret),
      activeLineTop: caretTop, activeLineTopPct: caretTop === null ? null : +((caretTop / innerHeight) * 100).toFixed(2),
      surfaceScrollTop: surface?.scrollTop ?? null,
      passageFontPx: prompt ? parseFloat(getComputedStyle(prompt).fontSize) : null,
      slotText: document.querySelector('#exercise-warning')?.textContent ?? null,
      slotOverflow: (() => { const s = document.querySelector('#slot'); return s ? s.scrollHeight > s.clientHeight + 1 : null; })(),
      docOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
}
/** Write a result file into the evidence directory. */
export function writeJson(name, value) { fs.writeFileSync(path.join(OUT, name), JSON.stringify(value, null, 2) + '\n'); }
/** Seed saved results directly through the app's own storage module (validated like a real save). */
export async function seedResults(page, results) {
  return page.evaluate(async rows => {
    const storage = await import('/src/storage.ts').catch(() => null);
    if (!storage) throw new Error('seedResults needs the dev server');
    for (const row of rows) await storage.saveResult(row);
    return rows.length;
  }, results);
}
