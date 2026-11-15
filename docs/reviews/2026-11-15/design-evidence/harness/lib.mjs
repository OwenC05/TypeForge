import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
export const BASE = 'http://127.0.0.1:5187';
export const OUT = 'C:/Users/Owenc/orca/workspaces/TypeForge/typeforge-daily-practice/docs/reviews/2026-11-15/design-evidence';
export const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });
export const log = [];
export function note(step, data = {}) { const e = { t: new Date().toISOString(), step, ...data }; log.push(e); console.log(JSON.stringify(e)); }
export function saveLog(name) { fs.writeFileSync(path.join(OUT, name), JSON.stringify(log, null, 2)); }
export async function shot(page, name, opts = {}) { await page.screenshot({ path: path.join(OUT, name), ...opts }); note('screenshot', { file: name, url: page.url(), viewport: page.viewportSize(), fullPage: !!opts.fullPage }); }
export async function launch(userDataDir, viewport, extra = {}) {
  fs.mkdirSync(userDataDir, { recursive: true });
  return chromium.launchPersistentContext(userDataDir, { executablePath: CHROME, headless: true, viewport, ...extra });
}
export const target = p => p.locator('#target-description').innerText().then(t => t.replace('Passage to copy: ', ''));
export const active = p => p.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}${a.textContent && a.tagName === 'A' ? ' "' + a.textContent.trim() + '"' : ''}` : null; });
export async function savedResults(p) {
  return p.evaluate(() => new Promise((resolve) => {
    const open = indexedDB.open('typeforge');
    open.onerror = () => resolve({ error: String(open.error) });
    open.onsuccess = () => { const db = open.result; if (!db.objectStoreNames.contains('results')) { db.close(); resolve([]); return; }
      const r = db.transaction('results').objectStore('results').getAll(); r.onsuccess = () => { db.close(); resolve(r.result.map(x => ({ id: x.id, mode: x.mode, completedAt: x.completedAt, durationMs: x.settings.durationMs, qwerty: x.settings.qwerty, wpm: x.metrics.wpm, accuracy: x.metrics.accuracy, eligible: x.eligibleForProgress, sentences: x.sentences.length, practiceFocus: x.practiceFocus ?? null, manualDrill: x.manualDrill ?? null }))); }; };
  }));
}
// Type passages with real key events until the run completes and the page leaves practice.
export async function typeRun(p, { delay = 95, errorAt = null, onError = null, maxMs = 200000 } = {}) {
  const started = Date.now();
  let passages = 0;
  try {
    while (Date.now() - started < maxMs) {
      if (!p.url().includes('practice.html')) break;
      const state = await p.locator('#exercise-state').innerText().catch(() => '');
      if (/Time is up|result is ready/i.test(state)) { await p.waitForURL(/results\.html/, { timeout: 8000 }).catch(() => {}); break; }
      const t = await target(p);
      const value = await p.locator('#typing-input').inputValue();
      const rest = t.slice(value.length);
      for (let i = 0; i < rest.length; i++) {
        if (passages === 0 && errorAt !== null && value.length + i === errorAt) {
          await p.keyboard.type('q', { delay });
          if (onError) await onError(p);
          await p.keyboard.press('Backspace');
          await p.waitForTimeout(delay);
        }
        await p.keyboard.type(rest[i], { delay });
        if (!p.url().includes('practice.html') || await p.locator('#typing-input').isDisabled().catch(() => true)) throw new Error('done');
      }
      await p.keyboard.press('Space');
      passages++;
      await p.waitForTimeout(delay);
    }
  } catch (e) { if (e.message !== 'done' && !/Target page|navigat|closed|Execution context/i.test(e.message)) throw e; }
  await p.waitForURL(/results\.html/, { timeout: 10000 }).catch(() => {});
  return { passages, elapsedMs: Date.now() - started, url: p.url() };
}
