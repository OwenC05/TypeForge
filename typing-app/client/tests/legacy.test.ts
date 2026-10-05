import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { DURATION_MS, TypingEngine } from '../src/engine.ts';
import { validateResult } from '../src/storage.ts';

// Regression contract: recruiter-platform PRD r2, SHA-256
// fe9c8644c57186100b7cc634e02026816f2cccf1cde0017adb30a0fa30e2b6bf.
// Optional-extension behavior belongs to the subsequent domain implementation.
const completedAt = '2026-09-30T12:00:00.000Z';
function make(prompt = 'cat') {
  return new TypingEngine({
    id: '00000000-0000-4000-8000-000000000001',
    prompts: [{ id: 'legacy-cat', text: prompt }], qwerty: true, corpusVersion: '1',
  });
}
function append(engine: TypingEngine, text: string, now: number) {
  const start = engine.value.length;
  assert.equal(engine.edit({ start, end: start, text, pressTime: now }, now), true);
}
function finish(engine: TypingEngine) {
  engine.tick(100 + DURATION_MS);
  const result = engine.result(completedAt);
  assert.ok(result);
  validateResult(result);
  return result;
}

test('legacy v1 JSON loads, validates and exports unchanged without optional extensions', () => {
  const value: unknown = JSON.parse(readFileSync(new URL('./fixtures/legacy-v1.json', import.meta.url), 'utf8'));
  const original = structuredClone(value);
  validateResult(value);
  assert.equal(Object.hasOwn(value, 'practiceFocus'), false);
  assert.equal(Object.hasOwn(value, 'sourceAssessmentId'), false);
  assert.equal(Object.hasOwn(value.sentences[0]!, 'prediction'), false);
  const exported: unknown = JSON.parse(JSON.stringify(value));
  validateResult(exported);
  assert.deepEqual(exported, original);
  assert.deepEqual(value, original, 'validation must not migrate or rewrite old data');
});

test('a submitted correction keeps attempt accuracy but cannot regain timing eligibility', () => {
  const engine = make('cat ');
  append(engine, 'c', 100);
  append(engine, 'x', 200);
  assert.equal(engine.edit({ start: 1, end: 2, text: '' }, 250), true);
  append(engine, 'a', 300);
  append(engine, 't', 400);
  append(engine, ' ', 500);
  assert.equal(engine.submit(600), true);
  const result = finish(engine);
  assert.deepEqual(result.metrics, {
    elapsedMs: 60000, correctCharacters: 4, attemptedCharacters: 5,
    correctAttempts: 4, accuracy: 80, deletedCharacters: 1, wpm: 0.8,
  });
  const sentence = result.sentences[0]!;
  assert.equal(sentence.response, 'cat ');
  assert.equal(sentence.submitted, true);
  assert.equal(sentence.eligible, false);
  assert.ok(sentence.qualityFlags.includes('edited'));
  assert.ok(sentence.qualityFlags.includes('incorrect'));
  assert.deepEqual(sentence.pairs, {});
});

test('a partial final word adds positional WPM without adding timing observations', () => {
  const engine = make();
  for (const [index, character] of [...'cat'].entries()) append(engine, character, 100 + index * 100);
  assert.equal(engine.submit(400), true);
  append(engine, 'c', 500);
  append(engine, 'a', 600);
  const result = finish(engine);
  assert.equal(result.metrics.correctCharacters, 5);
  assert.equal(result.metrics.wpm, 1);
  assert.equal(result.metrics.accuracy, 100);
  assert.equal(result.sentences[0]!.eligible, true);
  assert.equal(result.sentences[0]!.pairs.ca!.count, 1);
  assert.equal(result.sentences[1]!.response, 'ca');
  assert.equal(result.sentences[1]!.submitted, false);
  assert.deepEqual(result.sentences[1]!.qualityFlags, ['unfinished']);
  assert.deepEqual(result.sentences[1]!.pairs, {});
});

test('interruption invalidates only the affected sentence while preserving earlier eligible evidence', () => {
  const engine = make();
  for (const [index, character] of [...'cat'].entries()) append(engine, character, 100 + index * 100);
  assert.equal(engine.submit(400), true);
  append(engine, 'c', 500);
  engine.interrupt(600);
  append(engine, 'a', 700);
  append(engine, 't', 800);
  assert.equal(engine.submit(900), true);
  const result = finish(engine);
  assert.equal(result.eligibleForProgress, false);
  assert.deepEqual(result.qualityFlags, ['interrupted']);
  assert.equal(result.sentences[0]!.eligible, true);
  assert.deepEqual(result.sentences[0]!.pairs, {
    ca: { count: 1, logSum: Math.log(100) }, at: { count: 1, logSum: Math.log(100) },
  });
  assert.equal(result.sentences[1]!.submitted, true);
  assert.equal(result.sentences[1]!.eligible, false);
  assert.deepEqual(result.sentences[1]!.qualityFlags, ['interrupted']);
  assert.deepEqual(result.sentences[1]!.pairs, {});
});

test('a pre-deadline press committed at the exact deadline cannot change the frozen result', () => {
  const engine = make();
  append(engine, 'c', 100);
  assert.equal(engine.tick(60099).state, 'running');
  assert.equal(engine.edit({ start: 1, end: 1, text: 'a', pressTime: 60099 }, 60100), false);
  const frozen = engine.result(completedAt);
  assert.ok(frozen);
  assert.equal(frozen.metrics.elapsedMs, 60000);
  assert.equal(frozen.metrics.attemptedCharacters, 1);
  assert.equal(frozen.sentences[0]!.response, 'c');
  assert.equal(engine.submit(60101), false);
  engine.interrupt(60102);
  engine.tick(90000);
  assert.deepEqual(engine.result('2026-10-01T12:00:00.000Z'), frozen);
});

test('completed results defensively copy nested evidence, settings and charts on every read', () => {
  const engine = make();
  for (const [index, character] of [...'cat'].entries()) append(engine, character, 100 + index * 100);
  assert.equal(engine.submit(400), true);
  const result = finish(engine);
  const expected = structuredClone(result);
  result.settings.qwerty = false;
  result.metrics.wpm = 999;
  result.qualityFlags.push('interrupted');
  result.sentences[0]!.keys.c!.attempts = 999;
  result.sentences[0]!.pairs.ca!.logSum = 999;
  result.sentences[0]!.qualityFlags.push('edited');
  result.sentences[0]!.response = 'changed';
  result.chartSamples[0]!.wpm = 999;
  result.sentences.length = 0;
  const reread = engine.result(completedAt);
  assert.deepEqual(reread, expected);
  validateResult(reread);
});


test('legacy TypingDrill redirects only to practice chooser and preserves query intent for destination validation',()=>{
 const html=readFileSync(new URL('../TypingDrill.html',import.meta.url),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)![1];
 for(const query of ['?duration=30&qwerty=1&from=origin&practice=manual&pair=th','?duration=999&qwerty=true&practice=manual&pair=bad&redirect=https://evil.example','?retest=origin&duration=120&qwerty=0']){
  let target='';runInNewContext(script,{URLSearchParams,location:{search:query,hash:'#unsafe',replace:(value:string)=>{target=value;}}});
  const result=new URL(target,'https://typeforge.example/');assert.equal(result.pathname,'/practice.html');assert.equal(result.searchParams.get('mode'),'practice');
  assert.equal(result.searchParams.has('redirect'),false);assert.equal(result.hash,'');
  if(query.includes('duration=30')){assert.equal(result.searchParams.get('duration'),'30');assert.equal(result.searchParams.get('from'),'origin');assert.equal(result.searchParams.get('pair'),'th');assert.equal(result.searchParams.get('qwerty'),'1');}
  if(query.includes('duration=999')){assert.equal(result.searchParams.get('duration'),'999');assert.equal(result.searchParams.get('practice'),'manual');assert.equal(result.searchParams.get('pair'),'bad');assert.equal(result.searchParams.get('qwerty'),'true');}
  if(query.includes('duration=120')){assert.equal(result.searchParams.get('retest'),'origin');assert.equal(result.searchParams.get('duration'),'120');assert.equal(result.searchParams.get('qwerty'),'0');}
 }
});


test('legacy invalid settings reach destination parsers and their visible fallback messages', () => {
  const html = readFileSync(new URL('../TypingDrill.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const source = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
  const parsers = source.slice(source.indexOf('function parseDuration('), source.indexOf('function recommendationReason('));
  const focusLine = source.split('\n').find(line => line.includes("$('#focus-state').textContent ="))!;
  const warningCode = source.slice(source.indexOf('  function warning('), source.indexOf('  function paint('));
  const warningStart = source.indexOf('  const configurationWarning =');
  const warningEnd = source.indexOf('\n}', warningStart);
  for (const query of [
    '?duration=999&qwerty=true&practice=manual&pair=bad',
    '?duration=&qwerty=&practice=manual',
    '?practice=unknown&from=invalid%20id&retest=invalid%2Fid',
    '?practice=manual&pair=%3Cscript%3E%26duration%3D15',
  ]) {
    let target = '';
    runInNewContext(script, {URLSearchParams, location: {search: query, replace: (value: string) => {target = value;}}});
    const params = new URL(target, 'https://typeforge.example/').searchParams;
    const input = new URLSearchParams(query);
    assert.equal(params.get('duration'), input.get('duration'));
    assert.equal(params.get('qwerty'), input.get('qwerty'));
    assert.equal(params.get('practice'), input.get('practice'));
    assert.equal(params.get('pair'), input.get('pair'));
    assert.equal(params.has('from'), false);
    assert.equal(params.has('retest'), false);
    const nodes: Record<string, {hidden: boolean; textContent: string}> = {
      '#focus-state': {hidden: false, textContent: ''},
      '#exercise-warning': {hidden: true, textContent: ''},
    };
    const code = `${parsers}
      const parsedDuration = parseDuration(params.get('duration'));
      const parsedQwerty = parseQwerty(params.get('qwerty'));
      const practiceChoice = parsePracticeChoice(params.get('practice'), params.get('pair'), ['at', 'th'], null, 'No history');
      ${focusLine}
      ${warningCode}
      ${source.slice(warningStart, warningEnd)}
      ({parsedDuration, parsedQwerty, practiceChoice});`;
    const result = runInNewContext(stripTypeScriptTypes(code), {
      SUPPORTED_DURATIONS: [15000, 30000, 60000, 120000], params,
      $: (selector: string) => nodes[selector], lineageMessage: '', mode: 'practice', focus: null,
    });
    assert.equal(result.practiceChoice.kind, 'general');
    assert.match(nodes['#focus-state']!.textContent, /Unsupported (manual pair|practice choice).*Using General practice/);
    if (input.has('duration')) {
      assert.equal(result.parsedDuration.durationMs, 60000);
      assert.equal(result.parsedQwerty.qwerty, false);
      assert.equal(nodes['#exercise-warning']!.hidden, false);
      assert.match(nodes['#exercise-warning']!.textContent, /Unsupported duration.*60 seconds/);
      assert.match(nodes['#exercise-warning']!.textContent, /Unsupported keyboard declaration.*undeclared keyboard/);
    }
  }
});
