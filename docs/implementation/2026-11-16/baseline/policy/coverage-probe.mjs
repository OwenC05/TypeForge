// Standard Node 24+, any cwd. Only writes the two sibling report artifacts.
// Bounded source arithmetic: no adaptive selector, optimizer, production or human data.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { assessmentPrompts, practicePrompts, CORPUS_VERSION, shufflePrompts } from '../../../../../typing-app/client/src/corpus.ts';

const root = new URL('../../../../../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const readJson = path => JSON.parse(read(path).toString('utf8').replace(/^\uFEFF/, ''));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sum = list => list.reduce((a, b) => a + b, 0);
const unique = list => [...new Set(list)].sort();
const words = text => [...text.matchAll(/[a-z]+/g)];
const pairEnds = (text, pair) => Array.from({ length: Math.max(0, text.length - 1) }, (_, i) => i + 2).filter(end => text.slice(end - 2, end) === pair);
const pairs = text => Array.from({ length: Math.max(0, text.length - 1) }, (_, i) => text.slice(i, i + 2)).filter(p => /^[a-z]{2}$/.test(p));
const count = (text, pair) => pairEnds(text, pair).length;
const targetWords = (bank, pair) => unique(bank.flatMap(p => words(p.text).map(w => w[0])).filter(w => w.includes(pair)));
const letters = text => (text.match(/[a-z]/g) ?? []).length;
const stats = bank => {
  const tokens = bank.flatMap(p => words(p.text).map(w => w[0]));
  const repeated = unique(tokens).map(word => ({ word, tokens: tokens.filter(w => w === word).length,
    prompts: bank.filter(p => words(p.text).some(w => w[0] === word)).length })).filter(w => w.tokens > 1);
  return { prompts: bank.length, uniqueTexts: unique(bank.map(p => p.text)).length,
    characters: sum(bank.map(p => p.text.length)), syntheticJoinedCharacters: sum(bank.map(p => p.text.length)) + bank.length - 1,
    letters: sum(bank.map(p => letters(p.text))), minLength: Math.min(...bank.map(p => p.text.length)), maxLength: Math.max(...bank.map(p => p.text.length)),
    wordTokens: tokens.length, uniqueWords: unique(tokens).length, repeatedWordTokensBeyondFirst: tokens.length - unique(tokens).length,
    wordTypesInMultiplePrompts: repeated.filter(w => w.prompts > 1).length, repeatedWords: repeated };
};
const general = stats(practicePrompts), assessment = stats(assessmentPrompts);
const allPairs = Array.from({ length: 676 }, (_, i) => String.fromCharCode(97 + Math.floor(i / 26), 97 + i % 26));
const catalogue = Object.fromEntries(allPairs.map(pair => {
  const bank = practicePrompts.filter(p => count(p.text, pair));
  const occurrences = sum(bank.map(p => count(p.text, pair)));
  return [pair, { occurrences, prompts: bank.length, words: targetWords(bank, pair) }];
}));
const assessmentPairs = unique(assessmentPrompts.flatMap(p => pairs(p.text)));
const maxEightInTen = assessmentPairs.filter(pair => sum(assessmentPrompts.map(p => count(p.text, pair)).sort((a, b) => b - a).slice(0, 10)) >= 8).length;
const rng = initial => { let seed = initial; return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32); };

function syntheticRun(wpm, run, schedule) {
  let remaining = wpm * 5 / 2; // 30s; includes one insertion slot for each submission Space.
  const rows = [];
  for (const prompt of shufflePrompts(assessmentPrompts, rng(20261116 + (schedule === 'seeded-restarts' ? run : 0)))) {
    if (!remaining) break;
    const consumed = Math.min(remaining, prompt.text.length), submitted = remaining > prompt.text.length;
    rows.push({ prompt, prefix: prompt.text.slice(0, consumed), submitted, run });
    remaining -= consumed + Number(submitted);
    if (!submitted) break;
  }
  return rows;
}
function support(rows, minimum, prompts = 0, contexts = 0, runs = 0, reference = 0, practicePromptsMinimum = 3) {
  const total = sum(rows.map(r => pairs(r.prefix).length));
  return assessmentPairs.filter(pair => {
    const containing = rows.filter(r => count(r.prefix, pair));
    const n = sum(containing.map(r => count(r.prefix, pair)));
    const completeWords = unique(containing.flatMap(r => words(r.prompt.text).filter(w => w.index + w[0].length <= r.prefix.length && w[0].includes(pair)).map(w => w[0])));
    return n >= minimum && total - n >= reference && catalogue[pair].prompts >= practicePromptsMinimum &&
      unique(containing.map(r => r.prompt.id)).length >= prompts && completeWords.length >= contexts && unique(containing.map(r => r.run)).length >= runs;
  });
}
const scenarios = ['seeded-restarts', 'repeated-order-stress'].flatMap(schedule => [10, 30, 60].map(wpm => {
  const runRows = Array.from({ length: 10 }, (_, run) => syntheticRun(wpm, run, schedule));
  const rows = runRows.flat(), completed = rows.filter(r => r.submitted);
  const deduplicated = [...new Map(completed.map(r => [r.prompt.text, r])).values()];
  const finalSupportCeiling = support(deduplicated, 20, 4, 3, 4, 80, 4).filter(pair => catalogue[pair].words.length >= 3);
  return { schedule, artificialWpm: wpm, slotsPerRun: wpm * 5 / 2, minutes: 5,
    exposed: rows.length, distinctExposed: unique(rows.map(r => r.prompt.id)).length,
    complete: completed.length, distinctComplete: deduplicated.length, repeatedComplete: completed.length - deduplicated.length,
    partial: rows.length - completed.length,
    illustrativeSensitivity: [8, 12, 20].map(minimum => ({ minimum,
      partialAndCompletePracticeSupported: support(rows, minimum).length,
      completePracticeSupported: support(completed, minimum).length,
      completeThreePromptsWordsRuns: support(completed, minimum, 3, 3, 3).length,
      newestTenCompleteThreePromptsWordsRuns: support(completed.slice(-10), minimum, 3, 3, 3).length })),
    finalCountContextCeiling: { retainedUniqueCompletePrompts: deduplicated.length, passingPairs: finalSupportCeiling,
      excludesEffectStabilityAndExposure: true },
    // Compact witness: no repeated prompt texts, per-pair tables or per-keystroke schedules.
    runWitnesses: runRows.map(list => list.map(r => [r.prompt.id, r.prefix.length, r.submitted])) };
}));

// A fixed, finite illustration only: target-bearing prompts ordered by earliest pair end, then ID.
// Repeat the same full-bank cycle only if needed to reach the declared length. No search or adaptation.
function planProbe(pair, length) {
  const c = catalogue[pair];
  const bank = practicePrompts.filter(p => count(p.text, pair)).sort((a, b) => pairEnds(a.text, pair)[0] - pairEnds(b.text, pair)[0] || a.id.localeCompare(b.id));
  const segments = [];
  let offset = 0;
  while (bank.length && offset < length) {
    const prompt = bank[segments.length % bank.length];
    segments.push({ prompt, start: offset, end: offset + prompt.text.length });
    offset += prompt.text.length; // no synthetic separator in either prefix or comparator denominator
  }
  const ends = segments.flatMap(s => pairEnds(s.prompt.text, pair).map(end => s.start + end));
  const wordEnds = segments.flatMap(s => words(s.prompt.text).filter(w => w[0].includes(pair)).map(w => ({ word: w[0], end: s.start + w.index + w[0].length })));
  const at = n => {
    const opportunities = ends.filter(end => end <= n).length;
    const reachedLetters = sum(segments.map(s => letters(s.prompt.text.slice(0, Math.max(0, n - s.start)))));
    return { n, opportunities, per100Characters: 100 * opportunities / n,
      per100Letters: reachedLetters ? 100 * opportunities / reachedLetters : 0,
      densityRatio: c.occurrences ? opportunities * general.characters / (n * c.occurrences) : null,
      densityPass: c.occurrences > 0 && 4 * opportunities * general.characters >= 5 * n * c.occurrences,
      words: unique(wordEnds.filter(w => w.end <= n).map(w => w.word)),
      fullyTraversedPassages: unique(segments.filter(s => s.end <= n).map(s => s.prompt.text)).length };
  };
  // Certify the full final passage too: the actual plan has intact words, not a cut at the requested minimum.
  const positions = Array.from({ length: Math.max(0, offset - 19) }, (_, i) => at(i + 20));
  const failures = positions.filter(p => !p.densityPass);
  const minimumRatio = positions.length ? Math.min(...positions.map(p => p.densityRatio ?? 0)) : null;
  let seen = new Set(), repeatBeforeExhaustion = false;
  for (const s of segments) {
    if (seen.size === bank.length) seen = new Set();
    if (seen.has(s.prompt.id)) repeatBeforeExhaustion = true;
    seen.add(s.prompt.id);
  }
  const noAdjacentRepeat = segments.every((s, i) => !i || s.prompt.id !== segments[i - 1].prompt.id);
  const checks = { planLongEnough: offset >= 240, fourBankPassages: c.prompts >= 4,
    threeBankWords: c.words.length >= 3, firstTargetBy20: (ends[0] ?? Infinity) <= 20,
    everyIntegerPrefixDensity: offset >= 20 && !failures.length && positions.length === offset - 19,
    threeWordsBy240: at(Math.min(offset, 240)).words.length >= 3,
    fourCompletePassagesBy480: offset < 480 || at(480).fullyTraversedPassages >= 4,
    noAdjacentRepeat, noRepeatBeforeBankExhaustion: !repeatBeforeExhaustion };
  return { pair, requestedMinimumLength: length, length: offset, promptIds: segments.map(s => s.prompt.id), earliestPossibleFirstTarget: bank.length ? pairEnds(bank[0].text, pair)[0] : null,
    availablePassages: c.prompts, availableWords: c.words,
    general: { occurrences: c.occurrences, characters: general.characters, per100Characters: 100 * c.occurrences / general.characters,
      per100Letters: 100 * c.occurrences / general.letters,
      legacySyntheticJoinedCharacters: general.syntheticJoinedCharacters, legacySyntheticJoinedPer100Characters: 100 * c.occurrences / general.syntheticJoinedCharacters },
    targetOnlyBank: { per100Characters: bank.length ? 100 * c.occurrences / sum(bank.map(p => p.text.length)) : 0,
      per100Letters: bank.length ? 100 * c.occurrences / sum(bank.map(p => letters(p.text))) : 0 },
    checks, certificatePass: Object.values(checks).every(Boolean),
    prefixesChecked: positions.length, failingPrefixCount: failures.length, firstFailingPrefix: failures[0] ?? null, minimumDensityRatio: minimumRatio,
    checkpoints: [20, 40, 80, 120, 240, 480].filter(n => n <= offset).map(at) };
}
const examples = ['th', 'he', 'ag', 'au', 'zz', 'br'].flatMap(pair => [240, 480].map(length => planProbe(pair, length)));
const impossibleWordPairs = allPairs.filter(pair => catalogue[pair].prompts >= 3 && catalogue[pair].words.length < 3);
const priorLearning = readJson('docs/reviews/2026-11-15/learning-evidence/source-probe.json');
const priorMl = readJson('docs/reviews/2026-11-15/ml-evidence/probe.json');
const paths = ['typing-app/client/src/corpus.ts', 'typing-app/client/src/profile.ts',
  'docs/reviews/2026-11-15/learning-evidence/source-probe.json', 'docs/reviews/2026-11-15/ml-evidence/probe.json', '.omx/specs/typeforge-practice-policy-v1.md'];
const report = {
  provenance: { node: process.version, corpusVersion: CORPUS_VERSION, seed: 20261116,
    sourceSha256: Object.fromEntries(paths.map(path => [path, hash(read(path))])), scriptSha256: hash(readFileSync(new URL(import.meta.url))) },
  definitions: [
    'Canonical General and planned-prefix characters include internal spaces but exclude synthetic passage separators; lowercase pairs never cross passage boundaries. Legacy joined-bank denominator is reported only for comparison.',
    'Certificate is exact 4*opportunities*GeneralCharacters >= 5*n*GeneralOccurrences at every integer n20..planLength, with all independent first-target/context/repeat gates. Equality passes; zero corpus support fails.',
    'Checkpoint density passes are counterexamples only, never an all-prefix certificate. The former 149 checkpoint-pass count is superseded and is not final certificate coverage; no all-pair certificate search is performed.',
    'Each synthetic scenario is ten 30-second runs: WPM*5/2 insertion slots/run including terminal submission Space. This is a normalized ideal budget, not actual engine-scored WPM or a human-yield estimate.',
    'Fresh seeded queue per run versus repeated-order stress; unfinished prefixes discarded on restart. Complete counts assume correct unedited compatible sentences and intervals <=5000ms. Errors can reduce eligible timing support to zero.',
    '8/12/20 plus 3-prompt/3-word/3-run sensitivity is illustrative only. Draft final count/context ceiling uses latest unique prompt text, 20 target/80 other intervals, 4 target-bearing runs, 4 target-bearing prompts and 3 words; it is not a passing timing recommendation.',
    'No timing effect/stability is generated. Uniform synthetic timing has zero log contrast and must abstain regardless of support/certificate. No learning benefit, confidence or delivered-dose claim follows.',
    'Fixed ordering for whole-prompt plans reaching minimum240/480 characters only; every position through the actual full final passage is checked. No adaptive sampler, optimization, content edits or production changes. Full words/passages count after complete traversal.',
    'Planned certificates do not establish actual exposure: before first target completion there may be zero opportunities, n<20 is too short, and n<240 has partial context. Unsupported examples correctly fall back to General/manual.',
  ],
  corpus: { assessment, practice: general, assessmentDistinctPairs: assessmentPairs.length,
    practiceLegacySupportedPairs: allPairs.filter(pair => catalogue[pair].prompts >= 3).length,
    assessmentPairsLegacyPracticeSupported: assessmentPairs.filter(pair => catalogue[pair].prompts >= 3).length,
    maxEightInTenDistinctAssessmentPrompts: maxEightInTen, impossibleThreeWordPairsDespiteLegacySupport: impossibleWordPairs },
  priorProbeCrosschecks: { learningPracticeSupportedPairs: priorLearning.corpus.supportedPairs,
    mlAssessmentDistinctPairs: priorMl.corpus.assessmentDistinctPairs, mlMaxEightInTen: priorMl.corpus.assessmentPairsPossibleEightInTenDistinctPrompts,
    legacyCadenceExposure: priorLearning.cadenceExposure },
  assessmentScenarios: scenarios, boundedPlans: examples,
};

// Preserve source counts and prior scenario results while changing certificate semantics/output shape.
assert.equal(report.corpus.practiceLegacySupportedPairs, priorLearning.corpus.supportedPairs);
assert.equal(assessmentPairs.length, priorMl.corpus.assessmentDistinctPairs);
assert.equal(maxEightInTen, priorMl.corpus.assessmentPairsPossibleEightInTenDistinctPrompts);
assert.deepEqual(scenarios.map(s => s.complete), [0, 10, 30, 0, 10, 30]);
assert.deepEqual(pairEnds('aaa aa', 'aa'), [2, 3, 6]);
assert.equal(4 * 5 * 100 >= 5 * 100 * 4, true); // exactly 1.25x, inclusive
assert.equal(4 * 5 * 100 >= 5 * 101 * 4, false); // next position fails without a new target
assert.equal(Math.log(200) - Math.log(200), 0); // no-effect is not a support count
assert.equal(planProbe('ag', 240).earliestPossibleFirstTarget, 24);
assert.equal(planProbe('zz', 240).certificatePass, false);
assert.equal(planProbe('au', 480).checks.noAdjacentRepeat, false);
assert.equal(planProbe('th', 240).certificatePass, false);
assert.equal(planProbe('br', 480).certificatePass, true);
const json = JSON.stringify(report, null, 2) + '\n';
assert.ok(Buffer.byteLength(json) < 150_000, 'bounded JSON must stay below150KB');
writeFileSync(new URL('./coverage-probe.json', import.meta.url), json);

const fmt = value => value === null ? 'none' : typeof value === 'number' ? String(Number(value.toFixed(3))) : String(value);
const table = (headers, rows) => [headers.join(' | '), headers.map(() => '---').join(' | '), ...rows.map(row => row.map(fmt).join(' | '))].join('\n');
const checkpointCounterexamples = examples.filter(p => p.checkpoints.length && p.checkpoints.every(c => c.densityPass) && !p.checks.everyIntegerPrefixDensity);
const markdown = `# Bounded corpus and all-prefix certificate probe\n\n` +
  `Run: \`node docs/implementation/2026-11-16/baseline/policy/coverage-probe.mjs\` (Node ${process.version}); assertions pass. JSON is ${Buffer.byteLength(json)} bytes, with hashes, compact run witnesses and twelve fixed plan examples. Only the three assigned artifacts are changed.\n\n` +
  `## Definitions and claim limits\n\n${report.definitions.map(d => '- ' + d).join('\n')}\n\n` +
  `## Corpus and ten-run source budgets\n\nAssessment has ${assessment.prompts} unique texts, ${assessment.characters} characters, ${assessment.letters} letters, ${assessment.wordTokens} word tokens/${assessment.uniqueWords} word types; ${assessment.repeatedWordTokensBeyondFirst} tokens repeat beyond first use and ${assessment.wordTypesInMultiplePrompts} word types occur in multiple prompts. Text lengths are ${assessment.minLength}-${assessment.maxLength}, excluding submission Space. Practice has ${general.prompts} unique texts and ${general.characters} canonical characters; legacy joined-bank calculation adds ${general.prompts - 1} synthetic spaces (${general.syntheticJoinedCharacters} characters). JSON retains repeated-word counts, not redundant per-pair schedules.\n\n` +
  `Prior learning/ML counts reproduce: 219 assessment pairs, 184 legacy practice-supported pairs, 170 assessment pairs with that support, and 41 pairs able to reach eight opportunities in some <=10-distinct-assessment-prompt selection. The 18 legacy-supported pairs with <3 words cannot pass the new diversity gate. No support count establishes a nonzero timing contrast.\n\n` +
  table(['Schedule', 'WPM', 'Slots/run', 'Complete', 'Distinct complete', 'Repeated complete', 'Partial', 'Illustrative >=8 +3/3/3', 'Final count/context ceiling'], scenarios.map(s => [s.schedule, s.artificialWpm, s.slotsPerRun, s.complete, s.distinctComplete, s.repeatedComplete, s.partial, s.illustrativeSensitivity[0].completeThreePromptsWordsRuns, s.finalCountContextCeiling.passingPairs.length])) + '\n\n' +
  `Ten runs are five active minutes plus setup/breaks. At artificial10 WPM, 25 slots cannot complete any assessment sentence, so participation may complete while clean-timing evidence remains empty. Final count/context column deduplicates latest eligible prompt text and applies only the draft 20/80/4-runs/4-prompts/3-words support requirements; effect, halves/stability and exposure remain unproved. The 3/3/3 column and 8/12/20 sensitivities in JSON are earlier illustrative gates.\n\n` +
  `## Bounded fixed-plan results\n\n` +
  table(['Pair', 'Minimum / actual length', 'Bank prompts/words', 'First target', 'Positions checked', 'First density failure', 'Worst density ratio', 'Words by240', 'Complete passages by480', 'All gates pass'], examples.map(p => [p.pair, p.requestedMinimumLength + '/' + p.length, p.availablePassages + '/' + p.availableWords.length, p.earliestPossibleFirstTarget, p.prefixesChecked, p.firstFailingPrefix?.n ?? null, p.minimumDensityRatio, p.checkpoints.find(c => c.n === 240)?.words.length ?? 0, p.length >= 480 ? p.checkpoints.find(c => c.n === 480)?.fullyTraversedPassages ?? 0 : 'n/a', p.certificatePass])) + '\n\n' +
  `Checkpoint counterexamples: ${checkpointCounterexamples.map(p => p.pair + '/' + p.length + ' first fails at n=' + p.firstFailingPrefix.n).join('; ') || 'none in these fixed examples'}. Passing selected 20/40/80/120/240(/480) densities therefore cannot guarantee every integer prefix. The previous149 checkpoint-pass statistic was not final certificate coverage and is superseded. br provides a bounded feasible example under this one static ordering; failure of an arbitrary ordering alone does not prove global infeasibility. ag is impossible under the stated whole-prompt rules because its earliest target completes at24 and it has only3 target-bearing prompts (<4); au has only1 prompt/word and repeated cycling violates adjacency; zz has no source support. General/manual fallback is a correct result.\n\n` +
  examples.filter(p => p.requestedMinimumLength === 480).map(p => `### ${p.pair}\n\nGeneral target opportunities=${p.general.occurrences}; /100 canonical characters=${fmt(p.general.per100Characters)}, /100 letters=${fmt(p.general.per100Letters)}, /100 legacy joined characters=${fmt(p.general.legacySyntheticJoinedPer100Characters)}. Target-only bank /100 chars=${fmt(p.targetOnlyBank.per100Characters)}, /100 letters=${fmt(p.targetOnlyBank.per100Letters)}. Available whole words: ${p.availableWords.join(', ') || 'none'}. Failed checks: ${Object.entries(p.checks).filter(([, ok]) => !ok).map(([name]) => name).join(', ') || 'none'}.\n\n` +
    table(['n', 'Opportunities', '/100 chars', '/100 letters', 'Ratio to canonical General', 'Density passes', 'Fully traversed word types'], p.checkpoints.map(c => [c.n, c.opportunities, c.per100Characters, c.per100Letters, c.densityRatio, c.densityPass, c.words.length]))).join('\n\n') + '\n\n' +
  `A plan certificate starts at20 characters and establishes planned density/context only. An actual partial run can end before any target; corrections or noncontiguous edits cannot be reconstructed as a traversed prefix from final text. Actual realized exposure needs the separately reviewed instrument. The existing [learning](../../../../reviews/2026-11-15/learning-evidence/source-probe.mjs) and [ML](../../../../reviews/2026-11-15/ml-evidence/probe.mjs) probes remain source-mechanism evidence; neither this calculation nor their opportunity counts demonstrates useful targeting or learning. No adaptive sampler, exhaustive optimizer, production change or human measurement was made.\n`;
writeFileSync(new URL('./coverage-report.md', import.meta.url), markdown);
console.log(JSON.stringify({ result: 'passed', jsonBytes: Buffer.byteLength(json),
  checkpointCounterexamples: checkpointCounterexamples.map(p => ({ pair: p.pair, length: p.length, firstFailure: p.firstFailingPrefix.n })),
  certifiedFixedPlans: examples.filter(p => p.certificatePass).map(p => [p.pair, p.length]) }, null, 2));
