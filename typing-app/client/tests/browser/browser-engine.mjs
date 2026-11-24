import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function launchBrowser() {
  const engine = process.env.BROWSER_ENGINE ?? 'chromium';
  assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), 'BROWSER_ENGINE must be chromium, firefox or webkit');
  assert.ok(process.env.PLAYWRIGHT_MODULE, 'Set PLAYWRIGHT_MODULE to playwright-core/index.mjs');
  const playwright = await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href);
  const type = playwright[engine];
  const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const executablePath = engine === 'chromium' && existsSync(chrome) ? chrome : undefined;
  const browser = await type.launch({ executablePath, headless: true });
  // Playwright can select its separate headless shell for bundled Chromium.
  const executable = engine === 'chromium' ? executablePath : type.executablePath();
  return { browser, engine, executable };
}
