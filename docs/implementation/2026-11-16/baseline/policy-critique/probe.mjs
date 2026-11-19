// Independent C2 probe: imports application corpus/engine/validator, never P1's checker.
// Synthetic schedules describe possibility, never human yield or learning benefit.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { assessmentPrompts, practicePrompts } from '../../../../../typing-app/client/src/corpus.ts';
import { TypingEngine } from '../../../../../typing-app/client/src/engine.ts';
import { validateResult } from '../../../../../typing-app/client/src/storage.ts';

const root = new URL('../../../../../', import.meta.url);
const read = p => readFileSync(new URL(p, root));
const sha = b => createHash('sha256').update(b).digest('hex');
let checks = 0;
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const unique = xs => [...new Set(xs)];
const sum = xs => xs.reduce((a, b) => a + b, 0);
const words = text => [...text.matchAll(/[a-z]+/g)];
// Iterate within each word; supports overlapping pairs (aaa -> aa twice).
function occurrences(text, pair) {
  return words(text).flatMap(w => Array.from({ length: w[0].length - 1 }, (_, i) => ({
    pair: w[0].slice(i, i + 2), end: w.index + i + 2, word: w[0], wordEnd: w.index + w[0].length,
  }))).filter(x => pair === undefined || x.pair === pair);
}
const all = [...assessmentPrompts, ...practicePrompts];
const pairs = unique(all.flatMap(p => occurrences(p.text).map(x => x.pair))).sort();
const generalCharacters = sum(practicePrompts.map(p => p.text.length));
check(occurrences('aaa aa', 'aa').map(x => x.end), [2, 3, 6], 'overlap and word boundary');
check(generalCharacters, 3427, 'canonical bank denominator');

// A finite certificate with independent integer arithmetic and complete-word frontiers.
function certificate(pair, plan) {
  const bank = practicePrompts.filter(p => occurrences(p.text, pair).length);
  const generalCount = sum(bank.map(p => occurrences(p.text, pair).length));
  let offset = 0, ends = [], completedWords = [], completePassages = [], repeats = false;
  let cycle = new Set();
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    if (!bank.some(b => b.id === p.id && b.text === p.text)) return { pass: false, invalid: true };
    if (cycle.size === bank.length) cycle = new Set();
    if (cycle.has(p.text) || (i && plan[i - 1].text === p.text)) repeats = true;
    cycle.add(p.text);
    for (const x of occurrences(p.text, pair)) {
      ends.push(offset + x.end); completedWords.push({ word: x.word, end: offset + x.wordEnd });
    }
    offset += p.text.length;
    completePassages.push({ text: p.text, end: offset });
  }
  let firstFailure = null, opportunity = 0;
  for (let n = 20; n <= offset; n++) {
    while (opportunity < ends.length && ends[opportunity] <= n) opportunity++;
    if (!generalCount || 4 * opportunity * generalCharacters < 5 * n * generalCount) { firstFailure = n; break; }
  }
  const words240 = unique(completedWords.filter(w => w.end <= 240).map(w => w.word)).length;
  const passages480 = unique(completePassages.filter(p => p.end <= 480).map(p => p.text)).length;
  const pass = offset >= 240 && offset <= 16384 && plan.length <= 256 && bank.length >= 4 &&
    unique(bank.flatMap(p => occurrences(p.text, pair).map(x => x.word))).length >= 3 &&
    ends[0] <= 20 && firstFailure === null && words240 >= 3 &&
    (offset < 480 || passages480 >= 4) && !repeats;
  return { pass, length: offset, bankPrompts: bank.length, bankOccurrences: generalCount,
    words240, passages480, firstFailure, repeats, promptIds: plan.map(p => p.id) };
}

// Bounded constructive search. Failed first-prompt pruning is exhaustive, later search isn't.
function findPlan(pair, minimum = 480, nodeLimit = 2000) {
  const bank = practicePrompts.filter(p => occurrences(p.text, pair).length);
  const count = sum(bank.map(p => occurrences(p.text, pair).length));
  const bankWords = unique(bank.flatMap(p => occurrences(p.text, pair).map(x => x.word))).length;
  if (bank.length < 4 || bankWords < 3) return { status: 'impossible-bank-contexts', nodes: 0 };
  const appendPasses = (prompt, length, found) => {
    const local = occurrences(prompt.text, pair).map(x => x.end);
    let cursor = 0;
    for (let n = 1; n <= prompt.text.length; n++) {
      while (cursor < local.length && local[cursor] <= n) cursor++;
      if (length + n >= 20 && 4 * (found + cursor) * generalCharacters < 5 * (length + n) * count) return false;
    }
    return true;
  };
  const first = bank.filter(p => appendPasses(p, 0, 0));
  if (!first.length) return { status: 'impossible-first-whole-prompt', nodes: bank.length };
  let nodes = 0, exhaustedBudget = false;
  function search(plan, length, countSoFar) {
    if (++nodes > nodeLimit) { exhaustedBudget = true; return null; }
    if (length >= minimum) return certificate(pair, plan).pass ? plan : null;
    // Repeating only after the complete bank cycle, exactly as the proposed policy permits.
    const used = new Set(plan.slice(Math.floor(plan.length / bank.length) * bank.length).map(p => p.id));
    const options = (plan.length ? bank : first).filter(p => !used.has(p.id) && p.id !== plan.at(-1)?.id)
      .sort((a, b) => occurrences(b.text, pair).length / b.text.length - occurrences(a.text, pair).length / a.text.length || a.id.localeCompare(b.id));
    for (const p of options) {
      if (!appendPasses(p, length, countSoFar)) continue;
      const next = [...plan, p], nextLength = length + p.text.length;
      if (nextLength >= 240 && certificate(pair, next).words240 < 3) continue;
      const result = search(next, nextLength, countSoFar + occurrences(p.text, pair).length);
      if (result) return result;
      if (exhaustedBudget) break;
    }
    return null;
  }
  const plan = search([], 0, 0);
  return { status: plan ? 'constructed' : exhaustedBudget ? 'search-budget-exhausted' : 'exhaustive-no-plan', nodes,
    ...(plan ? { certificate: certificate(pair, plan) } : {}) };
}
const corpus = pairs.map(pair => ({ pair,
  assessmentOccurrences: sum(assessmentPrompts.map(p => occurrences(p.text, pair).length)),
  combinedOccurrences: sum(all.map(p => occurrences(p.text, pair).length)),
  practiceWords: unique(practicePrompts.flatMap(p => occurrences(p.text, pair).map(x => x.word))).length,
  assessmentTop20Ceiling: sum(assessmentPrompts.map(p => occurrences(p.text, pair).length).sort((a,b) => b-a).slice(0,20)),
  plan: findPlan(pair),
}));
const plans = new Map(corpus.filter(c => c.plan.certificate?.pass).map(c => [c.pair, c.plan.certificate]));

// Raw-interval oracle: separate target/complement arrays instead of P1 gate overrides.
function contrast(target, reference) {
  if (!target.length || !reference.length || [...target, ...reference].some(ms => !Number.isFinite(ms) || ms <= 0 || ms > 5000)) return null;
  return sum(target.map(Math.log)) / target.length - sum(reference.map(Math.log)) / reference.length;
}
for (const [ms, expected] of [[249.999999, false], [250, true], [250.000001, true]]) {
  const delta = contrast(Array(20).fill(ms), Array(80).fill(200));
  check(delta + 1e-10 >= Math.log(1.25), expected, `raw full effect ${ms}`);
}
for (const [ms, expected] of [[219.999999, false], [220, true], [220.000001, true]]) {
  check(contrast(Array(8).fill(ms), Array(20).fill(200)) + 1e-10 >= Math.log(1.1), expected, `raw half effect ${ms}`);
}
check(contrast([250], [0]), null, 'zero interval excluded');
check(contrast([250], [Infinity]), null, 'infinite interval excluded');
check(contrast([5001], [200]), null, 'above filter excluded');
check(contrast([5000], [200]) !== null, true, 'filter equality admitted');
check(contrast([0.5], [0.4]) + 1e-10 >= Math.log(1.25), true, 'sub-ms domain retained');
check(Math.abs(contrast(Array(16384).fill(200), Array(16384).fill(200))) <= 1e-10, true, 'uniform maximal attempt count');
check(Math.abs(contrast([1, 100, 5000], [5000, 1, 100])) <= 1e-10, true, 'same multiset permutations');

// Application engine provides real aggregate fields at actual <=30s deadlines.
// Fresh Fisher-Yates order per run; exact synthetic fixed delays, no edits and no model.
function shuffled(seed) {
  const xs = [...assessmentPrompts];
  let state = seed >>> 0;
  for (let i = xs.length - 1; i; i--) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    const j = (state >>> 0) % (i + 1); [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}
function run(prompts, target, targetMs, otherMs, index, oneKey = false, mode = 'assessment') {
  const engine = new TypingEngine({ id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    prompts, inputMode: 'flow-v1', durationMs: 30000, qwerty: true, corpusVersion: '1', mode });
  let time = 0;
  do {
    const position = engine.value.length;
    const text = engine.prompt.text;
    const char = position === text.length ? ' ' : text[position];
    const pair = position > 0 && position < text.length ? text.slice(position - 1, position + 1) : '';
    const delay = pair === target ? targetMs : otherMs;
    if (time + delay >= 30000 && engine.state !== 'idle') break;
    time += delay;
    engine.edit({ start: position, end: position, text: oneKey ? 'x' : char, pressTime: time }, time);
    if (oneKey) break;
  } while (engine.state === 'running');
  // First inserted character starts the 30-second monotonic deadline.
  engine.tick(30000 + otherMs);
  const result = engine.result(new Date(Date.UTC(2026, 10, 16, 10, index)).toISOString());
  assert.ok(result); validateResult(result);
  return result;
}
function selectedRows(results) {
  // Newest 20 runs BEFORE sentence quality; latest eligible exact text wins.
  const rows = new Map();
  for (const result of results.slice(-20)) for (const sentence of result.sentences) {
    if (sentence.submitted && sentence.eligible) rows.set(sentence.promptText, { result, sentence });
  }
  return [...rows.values()].sort((a,b) => a.result.completedAt.localeCompare(b.result.completedAt) || a.result.id.localeCompare(b.result.id) || a.sentence.promptId.localeCompare(b.sentence.promptId));
}
function inspect(results, pair) {
  const accepted = selectedRows(results).filter(r => !occurrences(r.sentence.promptText, pair).length ||
    r.sentence.pairs[pair]?.count === occurrences(r.sentence.promptText, pair).length);
  const ids = unique(accepted.map(r => r.result.id));
  const old = new Set(ids.slice(0, Math.floor(ids.length / 2)));
  function stats(rows) {
    let target = 0, reference = 0, tl = 0, rl = 0;
    const runIds = new Set(), prompts = new Set(), spellings = new Set();
    for (const {result, sentence} of rows) for (const [p,s] of Object.entries(sentence.pairs)) {
      if (p === pair) {
        target += s.count; tl += s.logSum; runIds.add(result.id); prompts.add(sentence.promptText);
        occurrences(sentence.promptText, pair).forEach(x => spellings.add(x.word));
      } else { reference += s.count; rl += s.logSum; }
    }
    const delta = target && reference ? tl / target - rl / reference : null;
    return { target, reference, runs: runIds.size, prompts: prompts.size, words: spellings.size, delta };
  }
  const full = stats(accepted), halves = [stats(accepted.filter(r => old.has(r.result.id))), stats(accepted.filter(r => !old.has(r.result.id)))];
  const support = full.target >= 20 && full.reference >= 80 && full.runs >= 4 && full.prompts >= 4 && full.words >= 3;
  const timing = support && full.delta + 1e-10 >= Math.log(1.25) && halves.every(h => h.target >= 8 && h.reference >= 20 && h.runs >= 2 && h.delta + 1e-10 >= Math.log(1.1));
  return { full, halves, acceptedRunIds: ids.length, support, timing, certificate: plans.has(pair),
    passes: results.length >= 10 && timing && plans.has(pair) };
}
const scenarios = [];
let firstWitness = null;
// 8 fixed schedule seeds; 10/20 runs; 400/200ms and 200/100ms targets/complements.
// Test all pairs with a theoretical >=20 unique assessment opportunities plus a constructed plan.
const eligibleCandidates = corpus.filter(c => c.assessmentOccurrences >= 20 && plans.has(c.pair)).map(c => c.pair);
for (const [otherMs, targetMs] of [[200,400], [100,200]]) for (const runs of [10,20]) for (let seed = 1; seed <= 8; seed++) {
  const outcomes = eligibleCandidates.map(pair => {
    const results = Array.from({length:runs}, (_, i) => run(shuffled(seed * 1000 + i + 1), pair, targetMs, otherMs, i));
    const outcome = inspect(results,pair);
    if (outcome.passes && !firstWitness) firstWitness = { pair, seed, runs, otherMs, targetMs, outcome,
      certificate: plans.get(pair), sources: results.map(r => ({ id:r.id, completedAt:r.completedAt,
        elapsedMs:r.metrics.elapsedMs, attempted:r.metrics.attemptedCharacters,
        sentences:r.sentences.filter(s => s.eligible).map(s => ({promptId:s.promptId, promptText:s.promptText, pairs:s.pairs})) })) };
    return {pair, support:outcome.support, timing:outcome.timing, passes:outcome.passes};
  });
  scenarios.push({seed,runs,otherMs,targetMs,passingPairs:outcomes.filter(x=>x.passes).map(x=>x.pair),
    supportPairs:outcomes.filter(x=>x.support).map(x=>x.pair),timingPairs:outcomes.filter(x=>x.timing).map(x=>x.pair)});
}
const oneKey = Array.from({length:10},(_,i)=>run(assessmentPrompts,'th',400,200,i,true));
check(oneKey.every(r=>r.metrics.attemptedCharacters===1 && r.eligibleForProgress && r.metrics.elapsedMs===30000),true,'ten one-key real-engine completions');
check(selectedRows(oneKey).length,0,'one-key milestone has no timing');
check(inspect(oneKey,'th').passes,false,'one-key milestone never fabricates focus');
// New errorful-but-integral runs consume slots, evicting otherwise usable clean sources.
const fresh = Array.from({length:20},(_,i)=>run(shuffled(i+1),'th',400,200,i));
const noClean = Array.from({length:20},(_,i)=>run(assessmentPrompts,'th',400,200,i+20,true));
check(selectedRows([...fresh,...noClean]).length,0,'admit before looking for clean text');
check(selectedRows([...fresh,...noClean.slice(0,19)]).every(r=>r.result.id===fresh.at(-1).id),true,'only twentieth-most-recent clean run survives');
const uniform = Array.from({length:20},(_,i)=>run(shuffled(i+1),'th',200,200,i));
check(pairs.some(p=>inspect(uniform,p).timing),false,'real engine uniform histories abstain all candidates');

// Current source validator accepts impossible complement aggregates. Candidate-specific
// full attribution of he alone does not protect its reference pool from these values.
const forged = structuredClone(uniform);
for (const r of forged) {
  for (const s of r.sentences.filter(s=>s.eligible)) s.pairs.zz = {count:299,logSum:-Number.MAX_SAFE_INTEGER};
  validateResult(r); // Expected reproduction: structurally accepted, not claimed authentic.
}
const malformedReference = { sourceValidatorAccepted:true, before:inspect(uniform,'he'), after:inspect(forged,'he'),
  mutation:'Add absent zz pair with count299/logSum -MAX_SAFE_INTEGER to every eligible sentence' };
check(malformedReference.before.passes,false,'uniform sources have no target');
check(malformedReference.after.passes,true,'candidate-only attribution permits fabricated complement');
const allPairCountValid = sentence => Object.entries(sentence.pairs).every(([p,s])=>s.count<=occurrences(sentence.promptText,p).length);
check(forged.flatMap(r=>r.sentences).filter(s=>s.eligible).every(allPairCountValid),false,'all-pair occurrence validation rejects impossible complements');

// Target attribution remains conservative when counts cannot locate an omitted interval.
// It is impossible to infer which word lost timing from one per-pair count/logSum.
const ambiguous = {text:'the other theme', pair:'th', retained:2,
  possibleOmissions:occurrences('the other theme','th').map(x=>x.word)};
check(ambiguous.possibleOmissions.length,3,'three candidate target locations');
check(ambiguous.retained===ambiguous.possibleOmissions.length,false,'incomplete aggregate cannot claim all three words');

// Independent raw-event boundary witnesses (artificial, separate from corpus histories).
// Counts arise from arrays of observed events with identities, rather than boolean gate inputs.
const rawStats = rows => ({count:rows.length,runs:unique(rows.map(x=>x.run)).length,
  prompts:unique(rows.map(x=>x.prompt)).length,words:unique(rows.map(x=>x.word)).length});
const boundaryEvents = n => Array.from({length:n},(_,i)=>({run:i%4,prompt:i%4,word:i%3,ms:250}));
for (const n of [19,20,21]) check(rawStats(boundaryEvents(n)).count>=20,n>=20,`count boundary ${n}`);
for (const n of [79,80,81]) check(Array(n).fill(200).length>=80,n>=80,`complement boundary ${n}`);
for (const n of [3,4,5]) {
  const events=boundaryEvents(20).map((x,i)=>({...x,run:i%n,prompt:i%n}));
  check(rawStats(events).runs>=4,n>=4,`source-run boundary ${n}`);
  check(rawStats(events).prompts>=4,n>=4,`prompt boundary ${n}`);
}
for (const n of [2,3,4]) check(rawStats(boundaryEvents(20).map((x,i)=>({...x,word:i%n}))).words>=3,n>=3,`word boundary ${n}`);
for (const n of [7,8,9]) check(boundaryEvents(n).length>=8,n>=8,`half target boundary ${n}`);
for (const n of [19,20,21]) check(Array(n).fill(200).length>=20,n>=20,`half reference boundary ${n}`);
for (const n of [1,2,3]) check(rawStats(boundaryEvents(8).map((x,i)=>({...x,run:i%n}))).runs>=2,n>=2,`half run boundary ${n}`);
check(contrast([300,300],[200,200])+1e-10>=Math.log(1.25),true,'complement excludes target');
check(Math.log(300)-sum([300,300,200,200].map(Math.log))/4<Math.log(1.25),true,'including target incorrectly changes decision');
check(contrast([400,400,200,200],Array(4).fill(200))+1e-10>=Math.log(1.25),true,'pooled contrast passes');
check(contrast([200,200],[200,200])+1e-10<Math.log(1.1),true,'new half fails despite pooled pass');
const now=Date.parse('2026-11-16T12:00:00.000Z');
for(const [age,expected] of [[2591999999,true],[2592000000,true],[2592000001,false],[-1,false]]) {
  const completedAt=new Date(now-age).toISOString(), timestamp=Date.parse(completedAt);
  check(timestamp>=now-30*86400000&&timestamp<=now,expected,`UTC age ${age}`);
}
const windowWitness=[19,20,21].map(n=>({available:n,selected:Array.from({length:n},(_,i)=>i).slice(-20)}));
check(windowWitness.map(x=>x.selected.length),[19,20,20],'window below/at/above');
check(windowWitness[2].selected[0],1,'window evicts oldest');
const connectedBoundary=[249.999999,250,250.000001].map(targetMs=>{
  const results=Array.from({length:10},(_,i)=>run(shuffled(1001+i),'he',targetMs,200,i));
  return {targetMs,outcome:inspect(results,'he')};
});
check(connectedBoundary.map(x=>x.outcome.passes),[false,true,true],'real engine below/at/above contrast with same complete qualification path');
const planForHe=plans.get('he').promptIds.map(id=>practicePrompts.find(p=>p.id===id));
const delivered=[200,100].map(otherMs=>{
  const result=run(planForHe,'he',otherMs*1.25,otherMs,100,false,'practice');
  const reached=result.sentences.map(s=>({promptId:s.promptId,characters:s.response.length,
    targetEnds:occurrences(s.promptText,'he').filter(x=>x.end<=s.response.length).length,
    words:occurrences(s.promptText,'he').filter(x=>x.wordEnd<=s.response.length).map(x=>x.word)}));
  const characters=sum(reached.map(s=>s.characters)),targetOpportunities=sum(reached.map(s=>s.targetEnds));
  const distinctWords=unique(reached.flatMap(s=>s.words)).length;
  const distinctPassages=unique(result.sentences.filter(s=>s.submitted).map(s=>s.promptText)).length;
  const densityPass=4*targetOpportunities*generalCharacters>=5*characters*112;
  const status=characters<20?'too-short-to-evaluate':characters<240?'partial-context':
    densityPass&&distinctWords>=3&&(characters<480||distinctPassages>=4)?'met':'below-contract';
  return {otherMs,targetMs:otherMs*1.25,characters,targetOpportunities,distinctWords,distinctPassages,densityPass,status,
    elapsedMs:result.metrics.elapsedMs,attemptedCharacters:result.metrics.attemptedCharacters,reached};
});
check(delivered.map(x=>x.status),['partial-context','met'],'same certified practice plan at two actual engine speeds');

// Identity/context/shape-neutral omissions that need semantic authority rejection,
// not another permissive JSON Schema check. These are acceptance vectors for root.
const negativeCases = [
  {name:'same-source-id-different-canonical-hash',expected:'integrity rejection, not deduplicated success'},
  {name:'same-text-second-prompt-id',expected:'one prompt context after immutable-bank validation'},
  {name:'newest-eligible-partial-pair-older-full-pair',expected:'newest wins then attribution abstains; no candidate-specific older backfill'},
  {name:'target-complete-reference-pair-count-exceeds-text',expected:'exclude malformed sentence; no fabricated complement'},
  {name:'log-aggregate-below-any-positive-binary64-interval',expected:'exclude impossible aggregate before accumulation'},
  {name:'old-half-target7-new-half13-total20',expected:'unstable-evidence despite full support'},
  {name:'reference-only-run-crosses-half-boundary',expected:'deterministic accepted-run split includes reference-only run'},
  {name:'newest20-with-zero-eligible-sentences',expected:'no older clean backfill; no target'},
  {name:'suggested-sidecar-nine-baseline-witnesses',expected:'semantic rejection despite structurally permissible shape'},
  {name:'half-counts-or-log-sums-do-not-compose-full',expected:'semantic rejection'},
  {name:'source-rewritten-between-scan-and-final-point-read',expected:'pending or unavailable; no stale admission'},
  {name:'context-reset-old-inflight-result-completes',expected:'result remains old epoch; no new participation'},
  {name:'missing-membership-after-bootstrap-reload',expected:'source readable but not attributed by guessing'},
  {name:'deletion-after-admission-before-result-save',expected:'active snapshot stays historical; never reused as fresh authority'},
  {name:'plan-certificate-id-valid-hash-different-text',expected:'certificate recomputation rejects'},
  {name:'no-bank-exhaustion-repeat-in-otherwise-dense-plan',expected:'exposure-unsupported'},
  {name:'certified-plan-exceeds-existing-sentence-or-character-envelope',expected:'reject plan despite a passing density calculation'},
];

const paths = ['.omx/specs/typeforge-practice-policy-v1.md','docs/implementation/2026-11-16/baseline/policy/coach-config.example.json',
  'docs/implementation/2026-11-16/baseline/policy/coach-config.schema.json','docs/implementation/2026-11-16/baseline/policy/coach-sidecar.schema.json',
  'docs/implementation/2026-11-16/baseline/policy/check-contract.mjs','docs/implementation/2026-11-16/baseline/policy/contract-boundaries.json',
  'docs/implementation/2026-11-16/baseline/policy/sidecar-examples.json','docs/implementation/2026-11-16/baseline/policy/README.md',
  'docs/implementation/2026-11-16/baseline/policy/coordination-and-validation.md',
  'docs/implementation/2026-11-16/baseline/policy/coverage-probe.mjs','docs/implementation/2026-11-16/baseline/policy/coverage-probe.json',
  'docs/implementation/2026-11-16/baseline/policy/coverage-report.md','docs/implementation/2026-11-16/baseline/policy/primary-evidence.md',
  'typing-app/client/src/engine.ts','typing-app/client/src/storage.ts','typing-app/client/src/corpus.ts','typing-app/client/src/profile.ts'];
const report = { node:process.version, head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),checks,
  sourceSha256:Object.fromEntries(paths.map(p=>[p,sha(read(p))])),scriptSha256:sha(readFileSync(new URL(import.meta.url))),
  syntheticOnly:true, limits:['No human yield, benefit, or learning effect','Plan search capped at 2000 nodes per pair',
    'No actual storage/sidecar authority integration','Constructed plans are not uniform random samplers','Accepted-source half interpretation is explicit; see report'],
  pairUniverse:pairs.length, eligibleCandidates,
  corpusSummary:{ countTwentyAssessment:corpus.filter(c=>c.assessmentOccurrences>=20).map(c=>c.pair),
    countTwentyCombined:corpus.filter(c=>c.combinedOccurrences>=20).map(c=>c.pair),
    certificateStatusCounts:Object.fromEntries(unique(corpus.map(c=>c.plan.status)).map(s=>[s,corpus.filter(c=>c.plan.status===s).length])),
    assessmentTwentyAndCertificate:eligibleCandidates,
    combinedTwentyAndCertificate:corpus.filter(c=>c.combinedOccurrences>=20&&plans.has(c.pair)).map(c=>c.pair)},
  corpus, scenarios, firstWitness, malformedReference, ambiguous, windowWitness, connectedBoundary, delivered, negativeCases };
writeFileSync(new URL('probe-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checks,pairUniverse:report.pairUniverse,corpusSummary:report.corpusSummary,
  selectedPairs:corpus.filter(c=>['br','th','he','ag','au'].includes(c.pair)),
  scenarioCounts:[10,20].flatMap(runs=>[200,100].map(otherMs=>({runs,otherMs,tested:8,
    historiesWithPassingPair:scenarios.filter(s=>s.runs===runs&&s.otherMs===otherMs&&s.passingPairs.length).length}))),
  firstWitness:firstWitness?{pair:firstWitness.pair,seed:firstWitness.seed,runs:firstWitness.runs,outcome:firstWitness.outcome}:null},null,2));
