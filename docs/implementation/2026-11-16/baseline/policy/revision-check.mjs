// P1 amendment evidence, not production code or an IndexedDB/UX implementation.
// Reuses C2's published engine recipe and he plan at frozen commit 87fe85e;
// no repeated corpus search, participant data or fitted model.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { assessmentPrompts, practicePrompts } from '../../../../../typing-app/client/src/corpus.ts';
import { TypingEngine } from '../../../../../typing-app/client/src/engine.ts';
import { validateResult } from '../../../../../typing-app/client/src/storage.ts';

const now = Date.parse('2026-11-16T12:00:00.000Z');
const AGE = 30 * 86400000, EPS = 1e-10;
const canonical = x => x === null || typeof x !== 'object' ? JSON.stringify(x)
  : Array.isArray(x) ? `[${x.map(canonical)}]`
    : `{${Object.keys(x).sort().map(k => `${JSON.stringify(k)}:${canonical(x[k])}`).join(',')}}`;
const hash = x => createHash('sha256').update(canonical(x)).digest('hex');
const sum = xs => { let total = 0, correction = 0; for (const x of xs) {
  const y = x - correction, next = total + y; correction = (next - total) - y; total = next;
} return Number.isFinite(total) ? total : null; };
const unique = xs => [...new Set(xs)];
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const order = (a, b) => compare(a.completedAt, b.completedAt) || compare(a.id, b.id);
const validTime = x => typeof x === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x)
  && Number.isFinite(Date.parse(x)) && new Date(x).toISOString() === x;
const occurrences = (text, pair) => [...text.matchAll(/[a-z]+/g)].flatMap(w =>
  Array.from({ length: w[0].length - 1 }, (_, i) => ({ pair: w[0].slice(i, i + 2),
    end: w.index + i + 2, word: w[0], wordEnd: w.index + w[0].length })))
  .filter(x => pair === undefined || x.pair === pair);
const bankFor = r => r.mode === 'assessment' ? assessmentPrompts : practicePrompts;
let checks = 0;
const evidence = [];
const check = (name, actual, expected) => {
  assert.deepEqual(actual, expected, name); checks++; evidence.push({ name, result: 'passed' });
};
const cloned = x => structuredClone(x);

// Synthetic source membership is a fixture input; nothing here writes browser storage.
const member = r => ({ id: r.id, hash: hash(r), epoch: 'epoch-1', purpose: 'ordinary' });
function sourceSet(results) {
  const byId = new Map();
  for (const r of results) {
    if (byId.has(r.id) && hash(byId.get(r.id)) !== hash(r)) return { error: 'source-id-conflict', rows: [] };
    byId.set(r.id, r);
  }
  return { rows: [...byId.values()].sort(order) };
}
function qualifying(r, memberships, epoch = 'epoch-1', assessmentOnly = false) {
  try { validateResult(r); } catch { return false; }
  const m = memberships.get(r.id);
  return validTime(r.completedAt) && Date.parse(r.completedAt) <= now &&
    r.eligibleForProgress && !r.qualityFlags.length && r.metrics.elapsedMs === 30000 &&
    r.metrics.attemptedCharacters >= 1 && r.settings.inputMode === 'flow-v1' &&
    r.settings.durationMs === 30000 && r.settings.qwerty && r.settings.language === 'en' &&
    r.settings.corpusVersion === '1' && r.metricVersion === 1 && r.schemaVersion === 1 &&
    (!assessmentOnly || r.mode === 'assessment') && m?.epoch === epoch &&
    m.purpose === 'ordinary' && m.hash === hash(r);
}
const median = xs => { const sorted = [...xs].sort((a, b) => a - b), n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2; };
function baseline(results, memberships, { exhausted = true, epoch = 'epoch-1', pendingSave = 0 } = {}) {
  const set = sourceSet(results);
  if (set.error) return { state: 'unavailable', reason: set.error, summary: null };
  const witnesses = set.rows.filter(r => qualifying(r, memberships, epoch, true)).slice(-10);
  const complete = witnesses.length === 10 || exhausted;
  const common = { counted: witnesses.length, complete, pendingSave, ids: witnesses.map(r => r.id) };
  if (witnesses.length !== 10 || !complete) return { ...common, summary: null };
  const wpms = witnesses.map(r => r.metrics.wpm);
  const accuracies = witnesses.map(r => r.metrics.accuracy);
  return { ...common, summary: {
    sourceIds: common.ids, sourceHashes: witnesses.map(hash),
    medianWpm: wpms.every(x => Number.isFinite(x) && x >= 0) ? median(wpms) : null,
    medianAccuracy: accuracies.every(x => Number.isFinite(x) && x >= 0 && x <= 100) ? median(accuracies) : null,
    validAccuracySources: accuracies.filter(x => Number.isFinite(x) && x >= 0 && x <= 100).length,
  } };
}

// Coach-only semantic constraints; ordinary result validation/calibration stays unchanged.
function sentenceIssue(r, s) {
  const prompt = bankFor(r).find(p => p.id === s.promptId);
  if (!prompt || prompt.text !== s.promptText) return 'coach-prompt-identity';
  if (!s.eligible || !s.submitted || !s.diagnosticsAvailable || s.response !== s.promptText || s.qualityFlags.length) return 'not-clean';
  const expectedKeys = [...s.promptText].reduce((a, char) => { a[char] = (a[char] ?? 0) + 1; return a; }, {});
  if (Object.keys(s.keys).length !== Object.keys(expectedKeys).length ||
    Object.entries(expectedKeys).some(([k, n]) => !s.keys[k] || s.keys[k].attempts !== n ||
      s.keys[k].correct !== n || s.keys[k].firstAttempts !== n || s.keys[k].firstErrors !== 0)) return 'coach-sentence-envelope';
  for (const [pair, stats] of Object.entries(s.pairs)) {
    const available = occurrences(prompt.text, pair).length;
    if (!Number.isSafeInteger(stats.count) || stats.count < 1 || stats.count > available) return 'coach-pair-count';
    const tolerance = 64 * Number.EPSILON * stats.count * Math.max(Math.abs(Math.log(Number.MIN_VALUE)), Math.log(5000));
    if (!Number.isFinite(stats.logSum) || stats.logSum < stats.count * Math.log(Number.MIN_VALUE) - tolerance ||
      stats.logSum > stats.count * Math.log(5000) + tolerance) return 'coach-log-domain';
  }
  const observations = sum(Object.values(s.pairs).map(x => x.count));
  if (observations === null || observations > occurrences(prompt.text).length || observations > s.promptText.length - 1) return 'coach-sentence-envelope';
  return null;
}
function runIssue(r) {
  const attemptedKeys = sum(r.sentences.flatMap(s => Object.values(s.keys).map(k => k.attempts)));
  const correctKeys = sum(r.sentences.flatMap(s => Object.values(s.keys).map(k => k.correct)));
  if (attemptedKeys === null || correctKeys === null || attemptedKeys > r.metrics.attemptedCharacters ||
    correctKeys > r.metrics.correctAttempts) return 'coach-run-envelope';
  const valid = r.sentences.filter(s => sentenceIssue(r, s) === null);
  const observations = sum(valid.flatMap(s => Object.values(s.pairs).map(p => p.count)));
  // Necessary arithmetic-time bound from geometric means; not recovery of omitted IKIs.
  const omitted = sum(valid.map(s => occurrences(s.promptText).length - sum(Object.values(s.pairs).map(p => p.count))));
  const observedMinimum = sum(valid.flatMap(s => Object.values(s.pairs).map(p => p.count * Math.exp(p.logSum / p.count))));
  const minimumTime = observedMinimum === null || omitted === null ? null : sum([observedMinimum, omitted * 5000]);
  if (observations === null || minimumTime === null || observations > r.metrics.attemptedCharacters || observations > r.metrics.correctAttempts ||
    minimumTime > r.metrics.elapsedMs + 1e-6) return 'coach-run-envelope';
  return null;
}
function retained(results, memberships, epoch = 'epoch-1') {
  const set = sourceSet(results);
  if (set.error) return { error: set.error, rows: [], windowIds: [], excluded: [] };
  // Window first; do not replace errorful or coach-rejected runs with older clean runs.
  const selected = set.rows.filter(r => qualifying(r, memberships, epoch) && Date.parse(r.completedAt) >= now - AGE).slice(-20);
  const newest = new Map(), excluded = [];
  for (const r of selected) for (let i = 0; i < r.sentences.length; i++) {
    const s = r.sentences[i];
    const immutable = bankFor(r).find(p => p.id === s.promptId);
    if (s.eligible && s.submitted) newest.set(immutable?.text ?? s.promptText, { result: r, sentence: s, ordinal: i });
  }
  const badRuns = new Set(selected.filter(r => runIssue(r)).map(r => r.id));
  const rows = [];
  for (const row of newest.values()) {
    const reason = badRuns.has(row.result.id) ? 'coach-run-envelope' : sentenceIssue(row.result, row.sentence);
    if (reason) excluded.push({ id: row.result.id, ordinal: row.ordinal, reason }); else rows.push(row);
  }
  return { rows: rows.sort((a, b) => order(a.result, b.result) || a.ordinal - b.ordinal), windowIds: selected.map(r => r.id), excluded };
}
function stats(rows, pair) {
  const targets = [], references = [], targetRuns = new Set(), prompts = new Set(), words = new Set();
  for (const { result: r, sentence: s } of rows) for (const [p, x] of Object.entries(s.pairs).sort(([a], [b]) => compare(a, b))) {
    if (p === pair) {
      targets.push(x); targetRuns.add(r.id); prompts.add(s.promptText);
      occurrences(s.promptText, pair).forEach(o => words.add(o.word));
    } else references.push(x);
  }
  const target = sum(targets.map(x => x.count)), reference = sum(references.map(x => x.count));
  const targetLogSum = sum(targets.map(x => x.logSum)), referenceLogSum = sum(references.map(x => x.logSum));
  const delta = target && reference ? targetLogSum / target - referenceLogSum / reference : null;
  return { target, reference, targetLogSum, referenceLogSum,
    runs: targetRuns.size, prompts: prompts.size, words: words.size,
    delta: Number.isFinite(delta) ? delta : null };
}
function inspect(results, memberships, pair) {
  const selection = retained(results, memberships);
  const accepted = selection.rows.filter(({ sentence: s }) => !occurrences(s.promptText, pair).length ||
    s.pairs[pair]?.count === occurrences(s.promptText, pair).length);
  // Runs with no remaining pair observations contribute neither target nor reference.
  const contributing = accepted.filter(r => Object.keys(r.sentence.pairs).length);
  const ids = unique(contributing.map(r => r.result.id));
  const old = new Set(ids.slice(0, Math.floor(ids.length / 2)));
  const full = stats(contributing, pair);
  const halves = [stats(contributing.filter(r => old.has(r.result.id)), pair), stats(contributing.filter(r => !old.has(r.result.id)), pair)];
  const support = full.target >= 20 && full.reference >= 80 && full.runs >= 4 && full.prompts >= 4 && full.words >= 3;
  const timing = !selection.error && support && Number.isFinite(full.delta) && Math.abs(full.delta) > EPS &&
    full.delta + EPS >= Math.log(1.25) && halves.every(h => h.target >= 8 && h.reference >= 20 && h.runs >= 2 &&
      Number.isFinite(h.delta) && h.delta + EPS >= Math.log(1.1));
  return { full, halves, contributingRunIds: ids, windowIds: selection.windowIds,
    excluded: selection.excluded, support, timing, error: selection.error ?? null };
}

const heIds = ['003','019','048','013','078','028','001','036','054','002','047','074'].map(n => `practice-${n}`);
function certificate(pair, ids) {
  const bank = practicePrompts.filter(p => occurrences(p.text, pair).length);
  const generalCount = sum(bank.map(p => occurrences(p.text, pair).length));
  const generalCharacters = sum(practicePrompts.map(p => p.text.length));
  let length = 0, ends = [], words = [], passages = [], repeat = false;
  const used = new Set();
  for (const id of ids) {
    const p = bank.find(p => p.id === id);
    if (!p) return { pass: false, reason: 'invalid-plan-identity' };
    if (used.has(id)) repeat = true;
    used.add(id);
    occurrences(p.text, pair).forEach(o => { ends.push(length + o.end); words.push({ word: o.word, end: length + o.wordEnd }); });
    length += p.text.length; passages.push({ id, end: length });
  }
  let firstFailure = null, count = 0;
  for (let n = 20; n <= length; n++) {
    while (count < ends.length && ends[count] <= n) count++;
    if (!generalCount || 4 * count * generalCharacters < 5 * n * generalCount) { firstFailure = n; break; }
  }
  const words240 = unique(words.filter(w => w.end <= 240).map(w => w.word)).length;
  const passages480 = unique(passages.filter(p => p.end <= 480).map(p => p.id)).length;
  return { pass: bank.length >= 4 && length >= 480 && length <= 600 && !repeat && ends[0] <= 20 &&
    firstFailure === null && words240 >= 3 && passages480 >= 4,
    length, firstFailure, words240, passages480, promptIds: ids };
}
function shuffled(seed) {
  const xs = [...assessmentPrompts]; let state = seed >>> 0;
  for (let i = xs.length - 1; i; i--) { state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    const j = (state >>> 0) % (i + 1); [xs[i], xs[j]] = [xs[j], xs[i]]; }
  return xs;
}
function engineRun(prompts, targetMs, index, { oneKey = false, otherMs = 200, mode = 'assessment', pair = 'he' } = {}) {
  const engine = new TypingEngine({ id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    prompts, inputMode: 'flow-v1', durationMs: 30000, qwerty: true, corpusVersion: '1', mode });
  let time = 0;
  do {
    const position = engine.value.length, text = engine.prompt.text;
    const char = position === text.length ? ' ' : text[position];
    const p = position > 0 && position < text.length ? text.slice(position - 1, position + 1) : '';
    const delay = p === pair ? targetMs : otherMs;
    if (time + delay >= 30000 && engine.state !== 'idle') break;
    time += delay; engine.edit({ start: position, end: position, text: oneKey ? 'x' : char, pressTime: time }, time);
    if (oneKey) break;
  } while (engine.state === 'running');
  engine.tick(30000 + otherMs);
  const result = engine.result(new Date(Date.UTC(2026, 10, 16, 10, index)).toISOString());
  assert.ok(result); validateResult(result); return result;
}
const membersFor = rs => new Map(rs.map(r => [r.id, member(r)]));
const witness = ms => Array.from({ length: 10 }, (_, i) => engineRun(shuffled(1001 + i), ms, i));
const heCertificate = certificate('he', heIds);
check('C2 exact he plan certificate', [heCertificate.pass, heCertificate.length, heCertificate.words240, heCertificate.passages480], [true, 501, 8, 11]);
const config = JSON.parse(readFileSync(new URL('coach-config.example.json', import.meta.url), 'utf8'));
const catalogue = JSON.parse(readFileSync(new URL('finite-catalogue.example.json', import.meta.url), 'utf8'));
const bankHash = hash({ corpusVersion: '1', assessmentPrompts, practicePrompts });
function catalogueValid(value) {
  if (hash(value) !== config.exposure.catalogueId || value.bankHash !== bankHash ||
    canonical(value.templates.map(t => t.pair)) !== canonical(['he', 'in', 'le', 'th'])) return false;
  return value.templates.every(t => t.planHash === hash({ pair: t.pair, bankHash,
    prompts: t.promptIds.map(id => practicePrompts.find(p => p.id === id)) }) && certificate(t.pair, t.promptIds).pass);
}
check('four fixed C2-derived catalogue entries hash and recertify', catalogueValid(catalogue), true);
check('first increment never auto-enables prospective coach', config.releaseScope.automaticCoachingEnabled, false);
const tamperedCatalogue = cloned(catalogue); tamperedCatalogue.templates[0].promptIds.reverse();
check('catalogue identity cannot authorize changed plan', catalogueValid(tamperedCatalogue), false);
const wrongBank = cloned(catalogue); wrongBank.bankHash = '0'.repeat(64);
check('wrong immutable bank identity fails catalogue', catalogueValid(wrongBank), false);
const connected = [249.999999, 250, 250.000001].map(ms => {
  const sources = witness(ms), memberships = membersFor(sources), profile = inspect(sources, memberships, 'he');
  return { ms, sources, memberships, profile, baseline: baseline(sources, memberships), pass: profile.timing && heCertificate.pass };
});
check('same ten-engine-run path below at above effect', connected.map(x => x.pass), [false, true, true]);
const at = connected[1];
check('connected counts and distinct source contexts', [at.profile.full.target, at.profile.full.reference, at.profile.full.runs, at.profile.full.prompts, at.profile.full.words], [28, 543, 10, 19, 4]);
check('connected whole-run half support', at.profile.halves.map(h => [h.target, h.reference, h.runs]), [[10, 234, 5], [18, 309, 5]]);
check('connected ten baseline witnesses', at.baseline.ids.length, 10);
check('connected source semantic exclusions', at.profile.excluded, []);
const uniform = witness(200), uniformMembers = membersFor(uniform);
check('uniform real engine he abstains', inspect(uniform, uniformMembers, 'he').timing, false);
for (const pair of ['in', 'le', 'th']) check(`uniform real engine catalogue ${pair} abstains`, inspect(uniform, uniformMembers, pair).timing, false);
check('permuted source array derives same retained history', inspect([...at.sources].reverse(), at.memberships, 'he'), at.profile);
const permutedPairs = cloned(at.sources);
permutedPairs.forEach(r => r.sentences.forEach(s => { s.pairs = Object.fromEntries(Object.entries(s.pairs).reverse()); }));
check('pair insertion order cannot alter derived statistics', inspect(permutedPairs, membersFor(permutedPairs), 'he').full, at.profile.full);

// The forged old-validator success must never turn uniform sources into a coach target.
const forged = cloned(uniform);
for (const r of forged) for (const s of r.sentences.filter(s => s.eligible)) s.pairs.zz = { count: 299, logSum: -Number.MAX_SAFE_INTEGER };
for (const r of forged) validateResult(r);
const forgedOutcome = inspect(forged, membersFor(forged), 'he');
check('absent zz complement rejected coach-only', forgedOutcome.timing, false);
check('malformed complement produces pair-count diagnostics', forgedOutcome.excluded.some(x => x.reason === 'coach-pair-count'), true);
check('coach rejection does not change ten-test participation', baseline(forged, membersFor(forged)).counted, 10);
const firstClean = at.sources.flatMap(r => r.sentences.map(s => ({ r, s }))).find(x => x.s.eligible);
const semanticMutations = [
  ['wrong immutable text', s => { s.promptText += ' x'; }, 'coach-prompt-identity'],
  ['absent pair', s => { s.pairs.zz = { count: 1, logSum: Math.log(200) }; }, 'coach-pair-count'],
  ['excess pair count', s => { const p = Object.keys(s.pairs)[0]; s.pairs[p].count = occurrences(s.promptText, p).length + 1; }, 'coach-pair-count'],
  ['impossible lower log', s => { const p = Object.keys(s.pairs)[0]; s.pairs[p].logSum = -Number.MAX_SAFE_INTEGER; }, 'coach-log-domain'],
  ['nonfinite log', s => { s.pairs[Object.keys(s.pairs)[0]].logSum = Infinity; }, 'coach-log-domain'],
  ['impossible upper log', s => { const p = Object.keys(s.pairs)[0]; s.pairs[p].logSum = s.pairs[p].count * Math.log(5001); }, 'coach-log-domain'],
  ['missing first-attempt accounting', s => { s.keys[Object.keys(s.keys)[0]].firstAttempts = 0; }, 'coach-sentence-envelope'],
];
for (const [name, mutate, reason] of semanticMutations) {
  const sentence = cloned(firstClean.s); mutate(sentence); check(name, sentenceIssue(firstClean.r, sentence), reason);
}
for (const ms of [0.5, 5000]) {
  const s = cloned(firstClean.s);
  Object.values(s.pairs).forEach(p => { p.logSum = p.count * Math.log(ms); });
  check(`sentence positive interval domain ${ms}`, sentenceIssue(firstClean.r, s), null);
}
const partial = cloned(firstClean.s), partialPair = Object.keys(partial.pairs).find(p => partial.pairs[p].count > 1);
assert.ok(partialPair); partial.pairs[partialPair].count--; partial.pairs[partialPair].logSum -= Math.log(200);
check('filtered intervals allow partial reference count', sentenceIssue(firstClean.r, partial), null);
const noRef = cloned(firstClean.s); noRef.pairs = {};
check('empty timing is not fabricated evidence', stats([{ result: firstClean.r, sentence: noRef }], 'he').delta, null);
const badRun = cloned(firstClean.r); badRun.metrics.attemptedCharacters = 1;
check('run attempts envelope', runIssue(badRun), 'coach-run-envelope');
const wrongCorrectEnvelope = cloned(firstClean.r); wrongCorrectEnvelope.metrics.correctAttempts = 0;
check('run correct-attempt envelope', runIssue(wrongCorrectEnvelope), 'coach-run-envelope');
const timeImpossible = cloned(firstClean.r);
timeImpossible.sentences.filter(s => s.eligible).forEach(s => Object.values(s.pairs).forEach(p => { p.logSum = p.count * Math.log(5000); }));
check('necessary aggregate time envelope', runIssue(timeImpossible), 'coach-run-envelope');
const filteredEngine = engineRun(assessmentPrompts, 5000.001, 40);
check('actual engine filtered interval remains coach-admissible', runIssue(filteredEngine), null);
check('actual engine filter omits target without invented attribution', filteredEngine.sentences.some(s => s.eligible && occurrences(s.promptText, 'he').length > (s.pairs.he?.count ?? 0)), true);
const subMsEngine = engineRun(shuffled(1001), 0.5, 0);
check('actual engine positive sub-ms log aggregates remain admissible', runIssue(subMsEngine), null);
const exactlyFiveSeconds = engineRun(assessmentPrompts, 5000, 41);
check('actual engine exact5000ms interval remains admitted', exactlyFiveSeconds.sentences.some(s => s.eligible && s.pairs.he?.count > 0), true);
check('exact5000ms completed run passes necessary envelope', runIssue(exactlyFiveSeconds), null);
check('nonfinite accumulation rejects', sum([Number.MAX_VALUE, Number.MAX_VALUE]), null);

const oneKeys = Array.from({ length: 10 }, (_, i) => engineRun(assessmentPrompts, 250, i, { oneKey: true }));
check('one-key milestone has useful descriptive summary', baseline(oneKeys, membersFor(oneKeys)).summary.medianAccuracy, 0);
check('one-key milestone never manufactures timing', inspect(oneKeys, membersFor(oneKeys), 'he').timing, false);
check('pending save is not a source witness', baseline(oneKeys.slice(0, 9), membersFor(oneKeys), { pendingSave: 1 }).summary, null);
check('pending eleventh save preserves prior ten-source summary', baseline(oneKeys, membersFor(oneKeys), { pendingSave: 1 }).summary, baseline(oneKeys, membersFor(oneKeys)).summary);
const elevenTests = [...oneKeys, engineRun(assessmentPrompts, 250, 10, { oneKey: true })];
check('summary deterministic newest-ten witness selection', baseline([...elevenTests].reverse(), membersFor(elevenTests)).ids, elevenTests.slice(1).map(r => r.id));
check('incomplete scan below ten gives no summary', baseline(oneKeys.slice(0, 9), membersFor(oneKeys), { exhausted: false }).complete, false);
check('overlapping pages count IDs once', baseline([...oneKeys, ...oneKeys], membersFor(oneKeys)).counted, 10);
const conflicting = cloned(oneKeys[0]); conflicting.metrics.wpm += 1;
check('same ID different bytes fails lookup integrity', baseline([...oneKeys, conflicting], membersFor(oneKeys)).reason, 'source-id-conflict');
check('delete a witness revokes summary', baseline(at.sources.slice(1), at.memberships).summary, null);
check('reset excludes old captured memberships', baseline(at.sources, at.memberships, { epoch: 'epoch-2' }).counted, 0);
check('failed membership write/reload not guessed', baseline(at.sources, new Map()).counted, 0);
check('known source rewrite invalidates membership hash', baseline([conflicting, ...oneKeys.slice(1)], membersFor(oneKeys)).counted, 9);
check('median even set averages middle two', median([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), 4.5);
const nullAccuracy = cloned(at.sources); nullAccuracy[0].metrics.accuracy = null;
check('accuracy missing does not silently use nine-test median', baseline(nullAccuracy, membersFor(nullAccuracy)).summary.medianAccuracy, null);
check('available WPM survives unavailable accuracy', Number.isFinite(baseline(nullAccuracy, membersFor(nullAccuracy)).summary.medianWpm), true);
for (const [t, ok] of [['2026-02-30T12:00:00.000Z', false], ['2026-11-16T12:00:00.000Z', true], ['2026-11-16T12:00:00Z', false]]) check(`strict UTC ${t}`, validTime(t), ok);
for (const [age, ok] of [[AGE - 1, true], [AGE, true], [AGE + 1, false], [-1, false]]) {
  const r = cloned(at.sources[0]); r.completedAt = new Date(now - age).toISOString();
  check(`coach age ${age}`, retained([r], membersFor([r])).windowIds.length > 0, ok);
}
const clean20 = Array.from({ length: 20 }, (_, i) => engineRun(shuffled(1001 + i), 250, i));
const noClean20 = Array.from({ length: 20 }, (_, i) => engineRun(assessmentPrompts, 250, i + 20, { oneKey: true }));
check('twenty recent errorful runs evict clean evidence', retained([...clean20, ...noClean20], membersFor([...clean20, ...noClean20])).rows, []);
for (const n of [19, 20, 21]) {
  const rs = Array.from({ length: n }, (_, i) => engineRun(shuffled(1001 + i), 250, i));
  check(`newest window ${n}`, retained(rs, membersFor(rs)).windowIds.length, Math.min(n, 20));
}
const tied = cloned(at.sources); tied.forEach(r => { r.completedAt = at.sources[0].completedAt; });
check('tied timestamps use source ID order', baseline([...tied].reverse(), membersFor(tied)).ids, tied.map(r => r.id));
const rows = retained(at.sources, at.memberships).rows;
const referenceOnlyPrompts = assessmentPrompts.filter(p => !occurrences(p.text, 'he').length);
assert.ok(referenceOnlyPrompts.length);
const refOnly = engineRun(referenceOnlyPrompts, 250, 30);
refOnly.completedAt = '2026-11-16T09:59:00.000Z';
const referenceOnlySources = [refOnly, ...at.sources];
const withReferenceOnly = inspect(referenceOnlySources, membersFor(referenceOnlySources), 'he');
check('reference-only contributing run participates in odd half partition', withReferenceOnly.contributingRunIds.length, 11);
check('old half has five all-contributing runs but four target runs', withReferenceOnly.halves[0].runs, 4);
check('reference-only run cannot add target observations', withReferenceOnly.full.target, at.profile.full.target);
const half7and13 = cloned(at.sources);
const excludeForBoundary = new Set(['assessment-015','assessment-022','assessment-007','assessment-021','assessment-023']);
for (const r of half7and13) for (const s of r.sentences) if (excludeForBoundary.has(s.promptId)) {
  s.eligible = false; s.qualityFlags = unique([...s.qualityFlags, 'edited']); s.pairs = {}; delete s.prediction;
}
half7and13.forEach(validateResult);
const sevenThirteen = inspect(half7and13, membersFor(half7and13), 'he');
check('composed whole-run halves seven plus thirteen sum to twenty', [sevenThirteen.full.target, ...sevenThirteen.halves.map(h => h.target)], [20, 7, 13]);
check('full support cannot override half seven shortfall', [sevenThirteen.support, sevenThirteen.timing], [true, false]);
const newerUniform = Array.from({ length: 10 }, (_, i) => engineRun(shuffled(1001 + i), i < 5 ? 400 : 200, i));
const pooled = inspect(newerUniform, membersFor(newerUniform), 'he');
check('actual engine pooled effect can pass while a half is uniform', pooled.full.delta + EPS >= Math.log(1.25), true);
check('actual engine uniform newer half prevents timing qualification', pooled.timing, false);
const lastTargetRow = [...rows].reverse().find(row => row.sentence.pairs.he?.count > 1);
assert.ok(lastTargetRow);
const partialNew = cloned(lastTargetRow.result);
partialNew.id = '00000000-0000-4000-8000-999999999990';
partialNew.completedAt = '2026-11-16T11:00:00.000Z';
// Retain only the chosen real engine sentence; its incomplete target aggregate is a
// valid filtered-count possibility, not a claim that we recovered omitted positions.
partialNew.sentences = [cloned(lastTargetRow.sentence)];
partialNew.sentences[0].pairs.he.count--;
partialNew.sentences[0].pairs.he.logSum -= Math.log(250);
validateResult(partialNew);
const partialNewSources = [...at.sources, partialNew];
const partialRetained = retained(partialNewSources, membersFor(partialNewSources));
check('newest partial target supersedes older full row before attribution', partialRetained.rows.find(r => r.sentence.promptText === lastTargetRow.sentence.promptText).result.id, partialNew.id);
const partialProfile = inspect(partialNewSources, membersFor(partialNewSources), 'he');
check('no candidate-specific older full-target backfill', partialProfile.full.target, at.profile.full.target - lastTargetRow.sentence.pairs.he.count);
const duplicateSentence = cloned(at.sources);
duplicateSentence[0].sentences.push(cloned(duplicateSentence[0].sentences.find(s => s.eligible)));
const duplicateMembers = membersFor(duplicateSentence);
check('same-run duplicate text picks greatest ordinal only', retained(duplicateSentence, duplicateMembers).rows.filter(r => r.result.id === duplicateSentence[0].id && r.sentence.promptText === duplicateSentence[0].sentences.at(-1).promptText).length <= 1, true);
// A deliberately contradictory same-run attempt envelope rejects that run, never
// converts the duplicated text into another run/prompt context.
check('duplicate sentence cannot increase target-run support', inspect(duplicateSentence, duplicateMembers, 'he').full.runs <= at.profile.full.runs, true);
check('full counts compose from whole-run halves', at.profile.halves.reduce((n, h) => n + h.target, 0), at.profile.full.target);
check('reference counts compose from whole-run halves', at.profile.halves.reduce((n, h) => n + h.reference, 0), at.profile.full.reference);
check('half logs compose within arithmetic tolerance', Math.abs(sum(at.profile.halves.map(h => h.targetLogSum)) - at.profile.full.targetLogSum) < EPS, true);

// In-memory final-admission relation tests; NOT executed DB transactions or races.
function admit(snapshot, current, { started = false, budgetComplete = true, epoch = 'epoch-1',
  examinedRows = 20, examinedBytes = 1024 * 1024, capturedGeneration = 1, currentGeneration = 1,
  capturedRevision = 1, currentRevision = 1 } = {}) {
  if (started || !budgetComplete || epoch !== 'epoch-1' || examinedRows > 500 || examinedBytes > 16 * 1024 * 1024 ||
    capturedGeneration !== currentGeneration || capturedRevision !== currentRevision) return false;
  const currentById = new Map(current.map(r => [r.id, r]));
  return snapshot.every(r => currentById.has(r.id) && hash(currentById.get(r.id)) === hash(r));
}
check('same sources final admission relation', admit(at.sources, at.sources), true);
check('deleted source final relation rejects', admit(at.sources, at.sources.slice(1)), false);
const rewritten = cloned(at.sources); rewritten[0].sentences[0].response += 'x';
check('rewritten source final relation rejects', admit(at.sources, rewritten), false);
check('admission after typing starts rejects', admit(at.sources, at.sources, { started: true }), false);
check('budget truncation cannot become no-effect', admit(at.sources, at.sources, { budgetComplete: false }), false);
for (const [rowsExamined, ok] of [[499,true],[500,true],[501,false]]) check(`shared row budget relation ${rowsExamined}`, admit(at.sources, at.sources, { examinedRows: rowsExamined }), ok);
for (const [bytesExamined, ok] of [[16777215,true],[16777216,true],[16777217,false]]) check(`shared byte budget relation ${bytesExamined}`, admit(at.sources, at.sources, { examinedBytes: bytesExamined }), ok);
check('late preparation generation rejected by relation', admit(at.sources, at.sources, { currentGeneration: 2 }), false);
check('late source revision rejected by relation', admit(at.sources, at.sources, { currentRevision: 2 }), false);
check('reset while old run in flight rejects next epoch', admit(at.sources, at.sources, { epoch: 'epoch-2' }), false);
const historical = canonical(at.profile); admit(at.sources, []);
check('deletion does not mutate an admitted historical snapshot', canonical(at.profile), historical);
// Prospective decision witness relationships only: passing these does not override
// the disabled r1 release scope or supply a real transaction/review authorization.
const relationalDecision = { witnessIds: at.baseline.ids, sourceIds: at.profile.windowIds,
  sourceHashes: Object.fromEntries(at.sources.map(r => [r.id, hash(r)])),
  full: at.profile.full, halves: at.profile.halves,
  certificateId: hash({ configId: hash(config), catalogueId: hash(catalogue), bankHash, pair: 'he', promptIds: heIds }) };
function decisionRelations(d, current) {
  const b = baseline(current, membersFor(current));
  const p = inspect(current, membersFor(current), 'he');
  const byId = new Map(current.map(r => [r.id, r]));
  return d.witnessIds.length === 10 && new Set(d.witnessIds).size === 10 &&
    canonical(d.witnessIds) === canonical(b.ids) && new Set(d.sourceIds).size === d.sourceIds.length &&
    canonical(d.sourceIds) === canonical(p.windowIds) &&
    unique([...d.witnessIds, ...d.sourceIds]).every(id => byId.has(id) && hash(byId.get(id)) === d.sourceHashes[id]) &&
    canonical(d.full) === canonical(p.full) && canonical(d.halves) === canonical(p.halves) &&
    d.certificateId === relationalDecision.certificateId;
}
check('connected decision witness relationships compose', decisionRelations(relationalDecision, at.sources), true);
check('nine witnesses cannot support suggested relation', decisionRelations({ ...relationalDecision, witnessIds: at.baseline.ids.slice(1) }, at.sources), false);
check('duplicated derived source IDs reject', decisionRelations({ ...relationalDecision, sourceIds: [...at.profile.windowIds, at.profile.windowIds[0]] }, at.sources), false);
const wrongHalves = cloned(relationalDecision); wrongHalves.halves[0].target++;
check('halves not recomposing full reject', decisionRelations(wrongHalves, at.sources), false);
const wrongHash = cloned(relationalDecision); wrongHash.sourceHashes[at.sources[0].id] = '0'.repeat(64);
check('valid shape with wrong source hash rejects', decisionRelations(wrongHash, at.sources), false);
check('certificate hash for other text cannot authorize relation', decisionRelations({ ...relationalDecision, certificateId: hash({promptIds:[...heIds].reverse()}) }, at.sources), false);
check('deleted source revokes new decision authority', decisionRelations(relationalDecision, at.sources.slice(1)), false);
check('br entire deduplicated corpus cannot reach twenty', sum([...assessmentPrompts, ...practicePrompts].map(p => occurrences(p.text, 'br').length)), 17);
check('br absent from smallest catalogue', ['he', 'in', 'le', 'th'].includes('br'), false);
check('tampered he plan identity rejects certificate', certificate('he', ['practice-999', ...heIds.slice(1)]).pass, false);
check('adjacent repeated plan rejects certificate', certificate('he', [heIds[0], ...heIds]).pass, false);
const connectedReceipt = connected.map(x => ({ targetMs: x.ms, sourceIds: x.sources.map(r => r.id),
  sourceHashes: x.sources.map(hash), sourceEpoch: 'epoch-1', profile: x.profile,
  baseline: x.baseline, certificate: heCertificate, jointlyPasses: x.pass,
  retainedRows: retained(x.sources, x.memberships).rows.map(row => ({ sourceId: row.result.id,
    promptId: row.sentence.promptId, ordinal: row.ordinal, target: row.sentence.pairs.he ?? null,
    reference: { count: sum(Object.entries(row.sentence.pairs).filter(([p]) => p !== 'he').map(([,s]) => s.count)),
      logSum: sum(Object.entries(row.sentence.pairs).filter(([p]) => p !== 'he').sort(([a],[b]) => compare(a,b)).map(([,s]) => s.logSum)) } })) }));
const report = { kind: 'P1-relational-amendment-evidence', checks, node: process.version,
  frozenC2: '87fe85ecb703a255faea046a2294419be7d5dcff', now: new Date(now).toISOString(),
  configId: hash(config), catalogueId: hash(catalogue), catalogueCertificates: catalogue.templates.map(t => ({pair:t.pair,...certificate(t.pair,t.promptIds)})),
  connected: connectedReceipt, forgedOutcome, sevenThirteen, pooled, withReferenceOnly, evidence,
  limits: ['Synthetic engine paths, not people or learning benefit', 'No repeated C2 corpus search',
    'Semantic functions live only in this evidence script', 'Final admission exercised in memory only; no DB transaction/race proof',
    'Actual exposure remains unknown; no final-response-length backfill'],
};
writeFileSync(new URL('revision-check.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ checks, connected: connectedReceipt.map(x => ({ ms: x.targetMs, passes: x.jointlyPasses,
  target: x.profile.full.target, reference: x.profile.full.reference })), certificate: heCertificate }, null, 2));
