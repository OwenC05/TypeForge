import test from 'node:test';
import assert from 'node:assert/strict';
import { PREFERENCES_KEY, clearPreferences, loadPreferences, parsePreferences, savePreferences, withRemembered } from '../src/preferences.ts';

function memory(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); }};
}
const blocked = {getItem: () => { throw new DOMException('blocked', 'SecurityError'); }, setItem: () => { throw new DOMException('blocked', 'SecurityError'); }, removeItem: () => { throw new DOMException('blocked', 'SecurityError'); }};

test('clean first visit: practice defaults to 30 s General with no keyboard declaration; assessment keeps its own default', () => {
 const none = loadPreferences(memory());
 assert.equal(none.stored, false);
 const practice = withRemembered(new URLSearchParams('mode=practice'), 'practice', none);
 assert.equal(practice.get('duration'), '30');
 assert.equal(practice.has('qwerty'), false, 'a keyboard declaration is never inferred');
 assert.equal(practice.has('practice'), false);
 const assessment = withRemembered(new URLSearchParams(''), 'assessment', none);
 assert.equal(assessment.has('duration'), false, 'assessment falls through to its existing 60 s default');
});

test('remembered values fill only absent URL settings; explicit URL wins; lineage links ignore preferences', () => {
 const store = memory();
 assert.equal(savePreferences('practice', {durationSeconds: 60, qwerty: true, kind: 'manual', pair: 'th'}, store), true);
 const remembered = loadPreferences(store);
 const filled = withRemembered(new URLSearchParams('mode=practice'), 'practice', remembered);
 assert.deepEqual(Object.fromEntries(filled), {mode: 'practice', duration: '60', qwerty: '1', practice: 'manual', pair: 'th'});
 const explicit = withRemembered(new URLSearchParams('mode=practice&duration=15&qwerty=0&practice=general'), 'practice', remembered);
 assert.deepEqual(Object.fromEntries(explicit), {mode: 'practice', duration: '15', qwerty: '0', practice: 'general'});
 const invalidExplicit = withRemembered(new URLSearchParams('mode=practice&duration=bogus'), 'practice', remembered);
 assert.equal(invalidExplicit.get('duration'), 'bogus', 'an invalid explicit value keeps its explained fallback instead of inheriting');
 for (const lineage of ['from=abc', 'retest=abc']) {
  const linked = withRemembered(new URLSearchParams(`mode=practice&${lineage}`), 'practice', remembered);
  assert.equal(linked.has('duration'), false); assert.equal(linked.has('qwerty'), false); assert.equal(linked.has('practice'), false);
 }
 assert.deepEqual(loadPreferences(store).assessment, {}, 'practice choices never change assessment protocol');
});

test('fields validate independently; corrupt, wrong-version and blocked storage never throw', () => {
 const partial = parsePreferences(JSON.stringify({version: 1, practice: {durationSeconds: 45, qwerty: 'yes', kind: 'manual', pair: 'TH'}, assessment: {durationSeconds: 120, kind: 'manual'}}));
 assert.deepEqual(partial.practice, {kind: 'manual'});
 assert.deepEqual(partial.assessment, {durationSeconds: 120}, 'assessment bucket never stores a practice kind');
 for (const text of ['{', 'null', '[]', JSON.stringify({version: 2, practice: {durationSeconds: 30}})]) assert.equal(parsePreferences(text).stored, false, text);
 assert.equal(loadPreferences(blocked).stored, false);
 assert.equal(savePreferences('practice', {durationSeconds: 30}, blocked), false);
 assert.doesNotThrow(() => clearPreferences(blocked));
 assert.equal(savePreferences('practice', {durationSeconds: 30}, null), false);
});

test('reset clears only the preference record', () => {
 const store = memory({other: 'kept'});
 savePreferences('assessment', {durationSeconds: 15, qwerty: false}, store);
 assert.ok(store.values.has(PREFERENCES_KEY));
 clearPreferences(store);
 assert.equal(store.values.has(PREFERENCES_KEY), false);
 assert.equal(store.values.get('other'), 'kept');
});
