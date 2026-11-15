import { chromium } from 'playwright-core';
import fs from 'node:fs'; import path from 'node:path';
export const OUT = 'C:/Users/Owenc/orca/workspaces/TypeForge/typeforge-daily-practice/.omx/plans/typeforge-keybr-evidence';
export const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export const log = [];
export function note(step, data = {}) { const e = { t: new Date().toISOString(), step, ...data }; log.push(e); console.log(JSON.stringify(e).slice(0, 1500)); }
export function saveLog(name) { fs.writeFileSync(path.join(OUT, name), JSON.stringify(log, null, 2)); }
export async function shot(page, name, opts = {}) { await page.screenshot({ path: path.join(OUT, name), ...opts }); note('screenshot', { file: name, url: page.url(), viewport: page.viewportSize(), fullPage: !!opts.fullPage }); }
export async function launch(dir, viewport, extra = {}) { fs.mkdirSync(dir, { recursive: true }); return chromium.launchPersistentContext(dir, { executablePath: CHROME, headless: true, viewport, ...extra }); }
export const active = p => p.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}${a.className && typeof a.className === 'string' ? '.' + a.className.split(' ').slice(0,2).join('.') : ''}` : null; });
