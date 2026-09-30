import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFeatures,parseModelArtifact,predictSentence} from '../src/model.ts';
const empty={count:0,logSum:0,pairs:{}};
test('features respect maximal words, lowercase pairs and cold-history fallback',()=>{
 const v=buildFeatures("Abcd can't",2,empty,5);assert.equal(v.length,682);assert.equal(v[1*26+2],1);assert.deepEqual(v.slice(676),[4,2/3,5,0,5,0]);
 assert.throws(()=>buildFeatures('Ab',1,empty,5)); assert.throws(()=>buildFeatures("a'b",2,empty,5));
});
test('missing artifact never invents population, uses explicitly labelled observed-user fallback',()=>{
 assert.equal(predictSentence('cat',empty,null).status,'unavailable');
 const p=predictSentence('cat',{count:2,logSum:10,pairs:{}},null);assert.equal(p.status,'baseline-only');assert.equal(p.predictions?.baseline.version,'observed-history-v1');
 assert.throws(()=>parseModelArtifact({}));
});

function artifact(){
 const featureNames=Array.from({length:676},(_,i)=>`pair_${String.fromCharCode(97+Math.floor(i/26),97+i%26)}`).concat(['word_length','pair_position','user_mean_log_ms','user_log_count','pair_mean_log_ms','pair_log_count']);
 return {artifactVersion:1,featureVersion:1,modelVersion:'fixture',status:'experimental',task:{language:'en',layout:'qwerty',lowercasePairsOnly:true,historySentences:10,maxIntervalMs:5000},featureNames,coefficients:Array(682).fill(0),intercept:5,populationMeanLogMs:5,baseline:{kind:'smoothed-pair',version:'fixture-base',k:5},residualLogQuantiles:{q10:-1,q90:1},provenance:{sourceUrl:'https://example.com/synthetic-test',manifestSha256:'0'.repeat(64),configSha256:'1'.repeat(64),reportVersion:'fixture'}};
}
test('strict artifact validation rejects shape/version/task and nonfinite arrays, keeps a defensive copy',()=>{
 const raw=artifact();const parsed=parseModelArtifact(raw);raw.coefficients[0]=999;assert.equal(parsed.coefficients[0],0);
 for(const mutate of [(a:any)=>a.extra=1,(a:any)=>a.featureVersion=2,(a:any)=>a.task.historySentences=11,(a:any)=>a.coefficients.pop(),(a:any)=>a.coefficients[0]=NaN,(a:any)=>delete a.coefficients[0],(a:any)=>delete a.featureNames[0],(a:any)=>a.residualLogQuantiles.q10=2,(a:any)=>a.baseline.k=2]){const a=artifact();mutate(a);assert.throws(()=>parseModelArtifact(a));}
});
test('candidate overflow drops candidate for entire sentence without replacing with baseline',()=>{
 const a=parseModelArtifact(artifact());a.coefficients[0]=1e308;
 const p=predictSentence('cat aa',empty,a);assert.equal(p.status,'baseline-only');assert.equal(p.predictions?.candidate,undefined);assert.ok(p.predictions?.occurrences.every(o=>o.candidateLogMs===undefined));
 a.populationMeanLogMs=1e308;assert.equal(predictSentence('cat',empty,a).status,'unavailable');
});
test('all candidate and baseline occurrences are prepared before a history mutation',()=>{
 const h={count:2,logSum:10,pairs:{ca:{count:1,logSum:6}}};const a=parseModelArtifact(artifact());a.coefficients[678]=1;
 const p=predictSentence('cat cat',h,a);assert.equal(p.status,'candidate-and-baseline');h.logSum=99;
 assert.ok(p.predictions?.occurrences.every(o=>o.candidateLogMs===10));
});

import { readFileSync } from 'node:fs';
import { TypingEngine, DURATION_MS } from '../src/engine.ts';
import { appendHistory, buildHistory, type HistorySnapshot } from '../src/profile.ts';
import { validateResult } from '../src/storage.ts';

interface ParityFixture {
  synthetic: true;
  modelVersion: string;
  cases: {
    prompt: string;
    history: HistorySnapshot;
    occurrences: { position: number; pair: string; features: number[]; baselineLogMs: number; predictedLogMs: number; predictedMs: number }[];
  }[];
  transitionFixture: {
    prompt: string;
    events: { LETTER: string; KEYCODE: string; PRESS_TIME: string }[];
    eligibleOccurrences: { position: number; pair: string; log: number; ms: number; length: number; relative: number }[];
    historyAfter: HistorySnapshot;
  };
}
const parity: ParityFixture = JSON.parse(readFileSync(new URL('../../../ml/fixtures/parity.json', import.meta.url), 'utf8'));
const shippedModel = parseModelArtifact(JSON.parse(readFileSync(new URL('../src/generated/model.json', import.meta.url), 'utf8')));

function close(actual: number, expected: number, label: string): void {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-6 * Math.max(Math.abs(expected), 1e-12),
    `${label}: ${actual} differs from ${expected}`);
}

test('actual exported model agrees with original Python estimator, features and baseline on golden fixtures', () => {
  assert.equal(parity.synthetic, true);
  assert.equal(parity.modelVersion, shippedModel.modelVersion);
  for (const fixture of parity.cases) {
    const preparation = predictSentence(fixture.prompt, fixture.history, shippedModel);
    assert.equal(preparation.status, 'candidate-and-baseline');
    assert.deepEqual(preparation.predictions!.occurrences.map(o => o.position), fixture.occurrences.map(o => o.position));
    for (const expected of fixture.occurrences) {
      const features = buildFeatures(fixture.prompt, expected.position, fixture.history, shippedModel.populationMeanLogMs);
      assert.equal(features.length, 682);
      features.forEach((value, index) => close(value, expected.features[index], `feature ${index}`));
      const actual = preparation.predictions!.occurrences.find(o => o.position === expected.position)!;
      close(actual.baselineLogMs, expected.baselineLogMs, 'baseline log prediction');
      close(actual.candidateLogMs!, expected.predictedLogMs, 'original estimator log prediction');
      close(Math.exp(actual.candidateLogMs!), expected.predictedMs, 'original estimator millisecond prediction');
    }
  }
});

test('shared eligible Python event stream yields identical engine observations, history and matched predictions', () => {
  const fixture = parity.transitionFixture;
  const engine = new TypingEngine({
    id: '00000000-0000-4000-8000-000000000001', qwerty: true,
    prompts: [{ id: 'synthetic-parity', text: fixture.prompt }],
  });
  const predictions = predictSentence(fixture.prompt, empty, shippedModel).predictions!;
  engine.setSentencePredictions(0, predictions);
  for (const event of fixture.events) {
    const time = Number(event.PRESS_TIME);
    engine.edit({ start: engine.value.length, end: engine.value.length, text: event.LETTER, pressTime: time }, time);
  }
  assert.equal(engine.submit(Number(fixture.events.at(-1)!.PRESS_TIME) + 1), true);
  const summary = engine.submittedSummaries[0];
  assert.equal(summary.eligible, true);
  assert.deepEqual(summary.pairs, fixture.historyAfter.pairs);
  assert.deepEqual(buildHistory(appendHistory([], summary)), fixture.historyAfter);
  for (const [pair, observed] of Object.entries(fixture.historyAfter.pairs)) {
    const occurrences = fixture.eligibleOccurrences.filter(o => o.pair === pair);
    assert.equal(occurrences.length, observed.count);
    const matched = summary.prediction!.pairs[pair];
    assert.equal(matched.count, observed.count);
    close(matched.observedLogSum, occurrences.reduce((sum, o) => sum + o.log, 0), 'matched observations');
    const prepared = occurrences.map(o => predictions.occurrences.find(p => p.position === o.position)!);
    close(matched.baselinePredictedLogSum, prepared.reduce((sum, o) => sum + o.baselineLogMs, 0), 'matched baseline');
    close(matched.candidatePredictedLogSum!, prepared.reduce((sum, o) => sum + o.candidateLogMs!, 0), 'matched candidate');
  }
  engine.tick(DURATION_MS);
  validateResult(engine.result('2026-09-30T12:00:00.000Z'));
});
