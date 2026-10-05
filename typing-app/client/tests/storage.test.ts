import assert from 'node:assert/strict';
import test from 'node:test';
import type { SessionResult } from '../src/engine.ts';
import { validateResult, ResultValidationError, saveResult } from '../src/storage.ts';

function result(): SessionResult {
  return {
    id: 'eed705bf-e344-4660-af71-ac5a48cacb9f',
    owner: 'guest',
    schemaVersion: 1,
    metricVersion: 1,
    completedAt: '2026-09-30T12:00:00.000Z',
    mode: 'assessment',
    settings: { durationMs: 60000, language: 'en', qwerty: true, corpusVersion: '1' },
    qualityFlags: [],
    eligibleForProgress: true,
    metrics: { elapsedMs: 60000, correctCharacters: 3, attemptedCharacters: 3, correctAttempts: 3, accuracy: 100, deletedCharacters: 0, wpm: 0.6 },
    sentences: [{
      promptId: 'assessment-001',
      promptText: 'the',
      response: 'the',
      submitted: true,
      eligible: true,
      diagnosticsAvailable: true,
      qualityFlags: [],
      keys: { t: { attempts: 1, correct: 1, firstAttempts: 1, firstErrors: 0 } },
      pairs: { th: { count: 1, logSum: Math.log(0.5) } },
    }],
    chartSamples: [{ elapsedMs: 60000, wpm: 0.6, accuracy: 100 }],
  };
}

test('accepts bounded guest results including sub-millisecond timing and unknown accuracy', () => {
  assert.doesNotThrow(() => validateResult(result()));
  const invalidInput = result();
  invalidInput.qualityFlags = ['invalid-input'];
  invalidInput.eligibleForProgress = false;
  invalidInput.metrics.accuracy = null;
  assert.doesNotThrow(() => validateResult(invalidInput));
});

test('rejects corrupt shapes, unsupported versions, impossible counts and unsafe chart data', () => {
  const corruptions: Array<(value: any) => void> = [
    (value) => { value.schemaVersion = 2; },
    (value) => { value.owner = 'someone-else'; },
    (value) => { value.completedAt = 'yesterday'; },
    (value) => { value.metrics.wpm = Infinity; },
    (value) => { value.metrics.attemptedCharacters = -1; },
    (value) => { value.metrics.correctAttempts = 4; },
    (value) => { value.metrics.accuracy = 101; },
    (value) => { value.sentences[0].keys.t.firstErrors = 2; },
    (value) => { value.sentences[0].pairs.th.count = 0; },
    (value) => { value.sentences[0].pairs.th.logSum = NaN; },
    (value) => { value.sentences[0].pairs.th.logSum = Math.log(5001); },
    (value) => { value.sentences[0].submitted = false; },
    (value) => { value.sentences[0].response = 'x'.repeat(601); },
    (value) => { value.chartSamples = []; },
    (value) => { value.chartSamples[0].elapsedMs = 59999; },
    (value) => { value.chartSamples.unshift({ elapsedMs: 60000, wpm: 1, accuracy: null }); },
    (value) => { value.extra = new Uint8Array(2 * 1024 * 1024); },
  ];
  for (const corrupt of corruptions) {
    const value = result();
    corrupt(value);
    assert.throws(() => validateResult(value), /Invalid saved result/);
  }
  for (const value of [null, [], {}, 'text']) {
    assert.throws(() => validateResult(value), /Invalid saved result/);
  }
});

test('rejects an otherwise bounded record larger than the 1 MiB persistence limit', () => {
  const value = result();
  const pairs = Object.fromEntries(Array.from({ length: 299 }, (_, index) => [
    String.fromCharCode(97 + Math.floor(index / 26), 97 + index % 26),
    { count: 1, logSum: Math.log(1234.56789) },
  ]));
  value.sentences = Array.from({ length: 120 }, () => ({ ...value.sentences[0]!, pairs }));
  assert.throws(() => validateResult(value), /record exceeds 1 MiB/);
});

test('strict v1 extensions retain independent lineage and matched simultaneous predictions',()=>{
 const r=result();r.sourceAssessmentId='00000000-0000-4000-8000-000000000001';
 r.sentences[0].prediction={featureVersion:1,baseline:{kind:'user',version:'v1'},candidate:{modelVersion:'m1',status:'experimental'},pairs:{th:{count:1,observedLogSum:Math.log(.5),baselinePredictedLogSum:4,candidatePredictedLogSum:5}}};
 assert.doesNotThrow(()=>validateResult(r));
 const bad=structuredClone(r);bad.sentences[0].prediction!.pairs.th.count=2;assert.throws(()=>validateResult(bad));
 const mixed=structuredClone(r);delete mixed.sentences[0].prediction!.pairs.th.candidatePredictedLogSum;assert.throws(()=>validateResult(mixed));
 r.mode='practice';r.practiceFocus={pair:'th',evidenceCount:8,source:'baseline',baselineVersion:'v1',score:1};assert.doesNotThrow(()=>validateResult(r));
 r.sourceAssessmentId=r.id;assert.throws(()=>validateResult(r));
});

test('rejects unknown extension keys, wrong identities and selectively retained predictions',()=>{
 const valid=result();valid.sourceAssessmentId='00000000-0000-4000-8000-000000000001';
 valid.sentences[0].prediction={featureVersion:1,baseline:{kind:'user',version:'v1'},pairs:{th:{count:1,observedLogSum:Math.log(.5),baselinePredictedLogSum:4}}};
 const changes=[
  (r:any)=>r.sourceAssessmentId='not-a-uuid',
  (r:any)=>r.sentences[0].prediction.extra=1,
  (r:any)=>r.sentences[0].prediction.baseline.version='',
  (r:any)=>r.sentences[0].prediction.baseline.kind='invented',
  (r:any)=>r.sentences[0].prediction.pairs.th.observedLogSum=0,
  (r:any)=>r.sentences[0].prediction.pairs.th.baselinePredictedLogSum=NaN,
  (r:any)=>r.sentences[0].prediction.pairs.th.candidatePredictedLogSum=5,
  (r:any)=>r.sentences[0].pairs.he={count:1,logSum:4},
  (r:any)=>r.sentences[0].eligible=false,
  (r:any)=>r.settings.qwerty=false,
  (r:any)=>r.practiceFocus={pair:'th',evidenceCount:8,source:'baseline',baselineVersion:'v1',score:1},
 ];
 for(const change of changes){const r=structuredClone(valid);change(r);assert.throws(()=>validateResult(r));}
 assert.doesNotThrow(()=>validateResult(valid));
});

test('UUID self-reference cannot bypass lineage validation with uppercase spelling',()=>{
 const r=result();r.sourceAssessmentId=r.id.toUpperCase();assert.throws(()=>validateResult(r));
});

test('prediction means must exponentiate to finite positive milliseconds without clamping',()=>{
 for(const logMean of [1000,-1000,Math.log(Number.MAX_VALUE)+1]){
  const r=result();r.sentences[0].prediction={featureVersion:1,baseline:{kind:'user',version:'v1'},pairs:{th:{count:1,observedLogSum:Math.log(.5),baselinePredictedLogSum:logMean}}};
  assert.throws(()=>validateResult(r));
 }
 const r=result();r.sentences[0].prediction={featureVersion:1,baseline:{kind:'user',version:'v1'},candidate:{modelVersion:'m1',status:'experimental'},pairs:{th:{count:1,observedLogSum:Math.log(.5),baselinePredictedLogSum:Math.log(.25),candidatePredictedLogSum:Math.log(.125)}}};
 assert.doesNotThrow(()=>validateResult(r));r.sentences[0].prediction.pairs.th.candidatePredictedLogSum=-1000;assert.throws(()=>validateResult(r));
});

test('flow duration arithmetic is strict while legacy remains 60 seconds only', () => {
  for (const durationMs of [15000, 30000, 60000, 120000] as const) {
    const value = result();
    value.settings = { ...value.settings, inputMode: 'flow-v1', durationMs };
    value.metrics.elapsedMs = durationMs;
    value.metrics.wpm = 3 * 12000 / durationMs;
    value.chartSamples = [{ elapsedMs: durationMs, wpm: value.metrics.wpm, accuracy: 100 }];
    assert.doesNotThrow(() => validateResult(value));
    delete value.settings.inputMode;
    if (durationMs !== 60000) assert.throws(() => validateResult(value));
  }
  const value: any = result();
  value.settings.inputMode = 'future';
  assert.throws(() => validateResult(value));
});

test('manual drills round trip independently of evidence-backed recommendations', () => {
  const value = result();
  value.mode = 'practice';
  value.manualDrill = { pair: 'th', source: 'manual' };
  assert.doesNotThrow(() => validateResult(JSON.parse(JSON.stringify(value))));
  for (const mutate of [
    (v: any) => { v.mode = 'assessment'; },
    (v: any) => { v.manualDrill.source = 'baseline'; },
    (v: any) => { v.manualDrill.pair = 't '; },
    (v: any) => { v.manualDrill.evidenceCount = 8; },
    (v: any) => { v.practiceFocus = { pair: 'th', evidenceCount: 8, source: 'baseline', baselineVersion: '1', score: 1 }; },
  ]) {
    const invalid = structuredClone(value); mutate(invalid);
    assert.throws(() => validateResult(invalid));
  }
});


test('validation failures are permanent named errors before IndexedDB is opened', async () => {
  const invalid = result();
  invalid.owner = 'not-guest';
  assert.throws(() => validateResult(invalid), ResultValidationError);
  await assert.rejects(saveResult(invalid), { name: 'ResultValidationError', message: 'Invalid saved result: owner.' });
  assert.doesNotThrow(() => validateResult(result()));
});
