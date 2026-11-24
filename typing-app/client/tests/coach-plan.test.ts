import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assessmentPrompts, practicePrompts } from '../src/corpus.ts';
import { BANK_HASH, CATALOGUE_ID, COACH_CONFIG, CONFIG_ID, canonicalJson, hashCanonical,
  resolveCertifiedPlan, resolveStoredFinitePlan, validateCertifiedPlan, validateCoachConfig } from '../src/coach-plan.ts';

// Separate Node crypto oracle, never the production SHA implementation.
const canonical = (v: unknown): string => v === null || typeof v !== 'object' ? JSON.stringify(v)
  : Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
    : `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
const hash = (v: unknown) => createHash('sha256').update(canonical(v)).digest('hex');

test('exact promoted config/catalogue and corpus identities; synchronous SHA agrees with Node', () => {
  // Approved config from docs/implementation/2026-11-16/baseline/policy/coach-config.example.json on archive/process-receipts-2026-11 at 6ce7e02999c668454459da42ad5d832b5f13f9bf.
  const original = JSON.parse(readFileSync(new URL('./fixtures/approved-coach-config.json', import.meta.url), 'utf8'));
  const catalogue = JSON.parse(readFileSync(new URL('../src/coach-catalogue.json', import.meta.url), 'utf8'));
  assert.deepEqual(COACH_CONFIG, original);
  assert.equal(hash(original), CONFIG_ID);
  assert.equal(hash(catalogue), CATALOGUE_ID);
  assert.equal(hash({ corpusVersion: '1', assessmentPrompts, practicePrompts }), BANK_HASH);
  for (const value of [null, '', '😀 é', Array(80).fill('abc'), { z: -0, a: [true, 1e-300, Number.MIN_VALUE] }, original,
    { corpusVersion: '1', assessmentPrompts, practicePrompts }]) assert.equal(hashCanonical(value), hash(value));
  assert.equal(canonicalJson({ b: 2, a: 1 }), '{"a":1,"b":2}');
  for (const value of [NaN, Infinity, undefined, { a: undefined }, new Date(), Array(2)]) assert.throws(() => hashCanonical(value));
  const cyclic: unknown[] = []; cyclic.push(cyclic); assert.throws(() => hashCanonical(cyclic));
  assert.ok(Object.isFrozen(COACH_CONFIG.exposure.automaticPairs));
});

test('config rejects identity, extra fields, threshold, context and disabled-scope substitutions', () => {
  assert.equal(validateCoachConfig(JSON.parse(JSON.stringify(COACH_CONFIG))), COACH_CONFIG);
  for (const mutate of [
    (c: typeof COACH_CONFIG) => { c.support.targetIntervals = 19; },
    (c: typeof COACH_CONFIG) => { c.context.durationMs = 60000; },
    (c: typeof COACH_CONFIG) => { c.releaseScope.automaticCoachingEnabled = false; },
    (c: typeof COACH_CONFIG) => { c.schemaId = 'unknown'; },
  ]) { const c = structuredClone(COACH_CONFIG); mutate(c); assert.throws(() => validateCoachConfig(c)); }
  assert.throws(() => validateCoachConfig({ ...COACH_CONFIG, extra: true }));
});

test('all four immutable plans pass an independent every-integer-prefix certificate', () => {
  for (const [pair, length, wordCount, passages] of [['he',501,8,11],['in',491,9,11],['le',502,9,11],['th',480,3,12]] as const) {
    const plan = resolveCertifiedPlan(pair)!;
    assert.ok(plan); assert.equal(plan.characterCount, length);
    assert.equal(hash({ pair, bankHash: BANK_HASH, prompts: plan.prompts }), plan.planHash);
    const generalChars = practicePrompts.reduce((a, p) => a + p.text.length, 0);
    const opportunities = (text: string) => {
      const result: { end: number; word: string; wordEnd: number }[] = [];
      for (let pos = 1; pos < text.length; pos++) if (text.slice(pos - 1, pos + 1) === pair) {
        let start = pos - 1, end = pos + 1;
        while (start > 0 && /[a-z]/.test(text[start - 1])) start--;
        while (end < text.length && /[a-z]/.test(text[end])) end++;
        result.push({ end: pos + 1, word: text.slice(start, end), wordEnd: end });
      }
      return result;
    };
    const generalPairs = practicePrompts.reduce((a, p) => a + opportunities(p.text).length, 0);
    let offset = 0, passages480 = 0;
    const ends: number[] = [], words = new Set<string>();
    for (const p of plan.prompts) {
      assert.deepEqual(p, practicePrompts.find(x => x.id === p.id));
      for (const o of opportunities(p.text)) {
        ends.push(offset + o.end);
        if (offset + o.wordEnd <= 240) words.add(o.word);
      }
      offset += p.text.length;
      if (offset <= 480) passages480++;
    }
    assert.equal(new Set(plan.prompts.map(p => p.text)).size, plan.prompts.length);
    assert.ok(ends[0] <= 20);
    assert.equal(words.size, wordCount); assert.equal(passages480, passages);
    for (let n = 20; n <= length; n++) assert.ok(4 * ends.filter(x => x <= n).length * generalChars >= 5 * n * generalPairs, `${pair} prefix ${n}`);
    assert.deepEqual(validateCertifiedPlan(structuredClone(plan)), plan);
    assert.ok(Object.isFrozen(plan.prompts[0]));
    assert.throws(() => { plan.prompts[0].text = 'changed'; });
  }
  for (const pair of ['br', 'zz', '', 'HE']) assert.equal(resolveCertifiedPlan(pair), null);
});

test('plan validator rejects every identity substitution, reorder, repeat and extra text', () => {
  const valid = resolveCertifiedPlan('he')!;
  for (const field of ['catalogueId','bankHash','planHash','certificateId','adapterId','pair','characterCount'])
    assert.throws(() => validateCertifiedPlan({ ...valid, [field]: 'bad' }), field);
  for (const prompts of [[...valid.prompts].reverse(), [...valid.prompts, valid.prompts[0]],
    valid.prompts.map((p,i) => i ? p : { ...p, text: p.text + ' he' })])
    assert.throws(() => validateCertifiedPlan({ ...valid, prompts }));
  assert.throws(() => validateCertifiedPlan({ ...valid, practiceFocus: 'he' }));
  // A live bank substitution cannot be hidden by cached certificates.
  const text = practicePrompts[0].text;
  try { practicePrompts[0].text += ' he'; assert.equal(resolveCertifiedPlan('he'), null); }
  finally { practicePrompts[0].text = text; }
  assert.ok(resolveCertifiedPlan('he'));
});

test('stored finite resolution requires all five exact fields but no active evidence snapshot', async () => {
  for (const pair of ['he','in','le','th']) {
    const plan = resolveCertifiedPlan(pair)!;
    const identity = { configId: CONFIG_ID, catalogueId: CATALOGUE_ID, planHash: plan.planHash, pair, sentenceCount: plan.prompts.length };
    assert.deepEqual(await resolveStoredFinitePlan(identity), plan);
    for (const key of Object.keys(identity)) assert.equal(await resolveStoredFinitePlan({ ...identity, [key]: 'bad' }), null);
    const extra = { ...identity, extra: true };
    assert.equal(await resolveStoredFinitePlan(extra), null);
  }
});
