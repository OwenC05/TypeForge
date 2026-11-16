// Builds ../visual-evidence.json (schema uizze.visual-evidence.v1) from the committed captures, hashing
// every source and artifact so the ui-taste integrity helper can verify them. Observations are the
// ones recorded in report.md from inspecting each capture; this script does not judge pixels.
// Usage: node visual-receipt.mjs [unresolved-json]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const evidence = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = relative => { const bytes = fs.readFileSync(path.resolve(evidence, relative)); return { path: relative, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }; };
const image = relative => ({ ...file(relative), kind: 'image' });
const shot = name => image(`screenshots/${name}`);
const states = JSON.parse(fs.readFileSync(path.join(evidence, 'states.json'), 'utf8'));
const chrome = `Chrome ${String(states.chrome).replace('Chrome/', '')} (headless, system install)`;
const env = (width, height) => ({ kind: 'browser', name: chrome, width, height });
const vp = { 1440: [1440, 900], 390: [390, 844], 320: [320, 640] };
const unresolved = JSON.parse(process.argv[2] ?? '[]');

const checks = [
  ['ready-first-visit', 'visual', 'Clean first visit to / at 1440, 390 and 320: 30 s General ready with native focus, no gate', [1440, 390, 320].map(w => shot(`${w}-01-ready-focused-first-visit.png`)),
    'Matches target-390-ready.png structure: rail of keys with the non-interactive "s" unit (T-1), two-row wrap at 390 and 320 (T-8, keys ≥40 px), countdown 30 with GENERAL PRACTICE · 30 S and why?, passage in monospace with the active line near 40% at 390 and 37.7% at 1440. Wordmark smaller than the target; no paper grain (T-9, optional).', null],
  ['running-and-error', 'visual', 'Running block and first mismatch at 1440, 390, 320', [1440, 390, 320].flatMap(w => [shot(`${w}-03-running.png`), shot(`${w}-04-running-error.png`)]),
    'Matches target-1440-running.png: rail hidden with its space kept (T-5), top bar faded, slot as a hairline rule with restart on it (T-4), footer hidden, vermilion expected-glyph tag above the first mismatch with uniform monospace advances (T-3). Numerals and passage follow the direction sizes (96/32 px), smaller than the generated target.', null],
  ['result-in-place', 'visual', 'Practice result in place, saved, Again focused, today line above', [1440, 390, 320].map(w => shot(`${w}-10-practice-result.png`)),
    'Matches target-1440-result.png: one numeral size for both metrics with baseline labels (T-6), rail and result aligned to the content column (T-7), no restart or key hints in the result (T-10). "Saved in this browser." is sentence case (target uppercase).', null],
  ['save-failure', 'visual', 'Save failed in place, then retried', [1440, 390, 320].flatMap(w => [shot(`${w}-18-save-failure.png`), shot(`${w}-19-save-retried.png`)]),
    'Failed save uses the notice treatment left-aligned with the result (ink sentence, vermilion-deep rule, retry saving and export on one row); after a successful retry the row returns to the quiet saved state. At 390/320 the row is below the captured viewport; a full-page probe confirmed the same layout and no horizontal overflow.', null],
  ['unsaved-line', 'interaction', 'One and two carried unsaved results, then a run with a hint in the slot', [1440, 390, 320].flatMap(w => [shot(`${w}-20-unsaved-1-ready.png`), shot(`${w}-21-unsaved-2-ready.png`), shot(`${w}-22-unsaved-2-running-with-hint.png`)]),
    'The line sits first in the reserved slot without moving the stage, surface or active line (asserted equal to a clean ready block); during a run it shows only the count, inert, and a run hint fits beneath it without scrolling at all three widths.',
    ['Inject storage failure at IDBObjectStore.add', 'Complete a 15 s block; press Enter on focused Again', 'Complete a second block; press Enter on Again', 'Type three characters; press Enter for the run hint']],
  ['held-departure', 'interaction', 'In-app link held while results are unsaved, during a run and from an assessment result', [1440, 390, 320].flatMap(w => [shot(`${w}-23-departure-held-running.png`), shot(`${w}-24-departure-held-assessment.png`)]),
    'First activation is held (same document and URL): "N results not saved. Leaving this page loses them." with Export focused and "leave without saving"; the held line is operable during a run and the slot grows downward only while held (stage, active line and slot top unchanged); returning to the passage cancels the hold.',
    ['With two unsaved results, type during a run', 'Click the wordmark link', 'Observe the held line and focus; click continue typing', 'Click the wordmark again; press Enter on Export; click leave without saving', 'Assessment: click practice next, then click it again']],
  ['focus-lost', 'visual', 'Focus lost mid-run: integrity notice and continue-typing key', [1440, 390, 320].map(w => shot(`${w}-08-focus-lost.png`)),
    'The notice uses the slot with its vermilion-deep rule; the continue-typing key covers the dimmed passage; nothing above the slot moves.', null],
  ['pair-list', 'interaction', 'Pair list open from the pair trigger', [1440, 390, 320].map(w => shot(`${w}-12-pair-popover.png`)),
    'The pair trigger shows the current value (th) beside the segmented "pair" key; the lazy Select opens as a grid of supported pairs.',
    ['Return to / with 60 s pair practice remembered', 'Click the pair trigger']],
  ['zoom-200', 'visual', 'Real 200% browser zoom (profile default zoom, devicePixelRatio 2): ready and first mismatch', [image('screenshots/zoom200-01-ready.png'), image('screenshots/zoom200-02-first-mismatch.png')],
    'No horizontal overflow, rail fits, focus stays in the passage, the expected-glyph tag is in view. Restart and the slot are below the fold of the short 704×398 CSS window (page scroll).', null, [704, 398]],
];

const receipt = {
  schemaVersion: 'uizze.visual-evidence.v1',
  scope: 'TypeForge direct practice "Paper and ink" redesign at /: ready, running, error, result, save failure, unsaved-result recovery, held departure, pair list and 200% zoom',
  platform: 'web',
  sources: ['../../../../../typing-app/client/src/style.css', '../../../../../typing-app/client/src/app.ts', '../../../../../typing-app/client/src/unsaved.ts', '../../../../../typing-app/client/index.html'].map(file),
  comparison: 'target',
  target: image('../target/target-1440-running.png'),
  otherTargets: [image('../target/target-1440-result.png'), image('../target/target-390-ready.png')],
  acceptedDifferences: [
    'Numerals and passage follow the direction (96 px figures, 32 px passage at 1440), smaller than the generated targets (target inspection T-6).',
    'Wordmark smaller than in the targets; "Saved in this browser." in sentence case.',
    'Pair practice is a segmented "pair" key plus a separate trigger showing the current pair, so the value is always visible.',
    'Suggested is drawn dashed when unavailable rather than solid and faded.',
    'No paper grain (optional per T-9).',
    'Passages wrap with break-all at narrow widths (mid-word breaks); word-safe wrapping failed the geometry matrix.',
    'Clicking an untyped glyph on a line below the typed text moves the native caret to the same column on the last typed line (native textarea hit-testing; no edit).',
  ],
  unresolved,
  requiredChecks: checks.map(([id, kind]) => ({ id, kind })),
  checks: checks.map(([id, kind, state, artifacts, observed, steps, size]) => {
    const [width, height] = size ?? vp[1440];
    return { id, status: 'pass', state, observed, environment: env(width, height), viewports: size ? [`${width}x${height} CSS px`] : ['1440x900', '390x844', '320x640'], artifacts, ...(steps ? { steps } : {}) };
  }),
};
fs.writeFileSync(path.join(evidence, 'visual-evidence.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(`checks ${receipt.checks.length}, artifacts ${receipt.checks.reduce((n, c) => n + c.artifacts.length, 0)}, unresolved ${unresolved.length}`);
