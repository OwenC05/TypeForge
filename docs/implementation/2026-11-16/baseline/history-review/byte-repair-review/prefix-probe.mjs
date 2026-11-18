import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Execute the exact private function text, without modifying or exporting source.
const source = readFileSync(new URL('./snapshot/typing-app/client/src/storage.ts', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const start = source.indexOf('function historyJsonBytes(');
const end = source.indexOf('/** Additive bounded', start);
assert(start >= 0 && end > start);
const measure = new Function('const MAX_RESULT_BYTES = 1048576;\n' + stripTypeScriptTypes(source.slice(start, end)) + '\nreturn historyJsonBytes;')();
const MIB = 1048576;
const nativeSize = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
let assertions = 0;
const check = (condition, message) => { assertions++; assert(condition, message); };
const original = execFileSync('git', ['show', '92803c80e4270dc5018b21b1e552c7feb7f97a2f:typing-app/client/src/storage.ts'], { encoding: 'utf8', cwd: fileURLToPath(new URL('.', import.meta.url)), windowsHide: true });
const oldBody = original.slice(original.indexOf('  const root = record'), original.indexOf('  // Every property above')).trimEnd();
const newBody = source.slice(source.indexOf('  const root = record'), source.indexOf('/** Reject unsupported')).trimEnd().replace(/\}\s*$/, '').trimEnd();
check(oldBody === newBody, 'legacy structural validation body preserved exactly');
const legacyTail = text => text.slice(text.indexOf('  // Every property above'), text.indexOf('function openDatabase')).trim();
check(legacyTail(original) === legacyTail(source), 'public native JSON/UTF-8 size check preserved exactly');
const scalarCases = [null, false, true, 0, -0, 1e-7, 1e21, 1e20, Number.MIN_VALUE, Number.MAX_VALUE, NaN, Infinity, -Infinity];
const units = Array.from({ length: 65536 }, (_, n) => String.fromCharCode(n)).join('');
const strings = ['', units, '\ud800\udc00', '\ud800x\udc00', '"\\\b\t\n\f\r', '\u2028\u2029', '\udbff\udfff', '\ud800\ud800\udc00'];
const shared = { text: 'é\ud800', finite: Number.MAX_VALUE };
const sparse = new Array(64); sparse[7] = '𝄞'; sparse[50] = undefined;
const cases = [...scalarCases, ...strings, sparse, { a: shared, b: shared }, { [units]: 'escaped property name' }, Object.assign(Object.create(null), { x: 2, y: 'null prototype' })];
let state = 179176;
const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state >>> 0; };
for (let n = 0; n < 300; n++) {
  const text = Array.from({ length: n * 3 }, () => String.fromCharCode(random() % 65536)).join('');
  cases.push({ [text.slice(0, 20)]: [text, scalarCases[random() % scalarCases.length], { alias: shared }] });
}
for (const value of cases) {
  const actual = measure(value);
  check(actual.error === null && !actual.oversized && actual.bytes === nativeSize(value), 'exact native JSON UTF-8 size for finite JSON tree');
}

const boundaryCases = [];
for (const suffix of ['a', 'é', '中', '𝄞', '\ud800', '\u0001', '"', '\\']) {
  for (const delta of [-2, -1, 0, 1, 2]) {
    const suffixBytes = nativeSize(suffix) - 2;
    const value = 'x'.repeat(MIB - 2 - suffixBytes + delta) + suffix;
    const expected = nativeSize(value), measured = measure(value);
    check(measured.bytes === Math.min(expected, MIB) && measured.oversized === (expected > MIB) && measured.error === null, 'escape/surrogate boundary has exact cutoff semantics');
    boundaryCases.push({ suffixCodeUnits: [...suffix].map(c => c.codePointAt(0)), delta, actualSize: expected, measured });
  }
}

const stress = [];
const longAscii = 'a'.repeat(16 * MIB);
const hugeKey = 'é'.repeat(2 * MIB);
const lateCycle = { pad: 'x'.repeat(MIB - 64) }; lateCycle.self = lateCycle;
let deep = 'leaf'; for (let n = 0; n < 100; n++) deep = { deep };
const wide = Object.fromEntries(Array.from({ length: 150000 }, (_, n) => [`k${n}`, 0]));
for (const [label, value] of [['large scalar', longAscii], ['huge property name', { [hugeKey]: 0 }], ['wide object', wide], ['late cycle', lateCycle], ['deep', deep], ['Map', new Map()], ['Set', new Set()], ['Date', new Date()], ['binary', new Uint8Array(2 * MIB)], ['BigInt', 1n], ['undefined member', { a: undefined }]]) {
  const stringify = JSON.stringify, encode = TextEncoder.prototype.encode, charCode = String.prototype.charCodeAt;
  let scalarInspections = 0, stringifyCalls = 0, encodedBuffers = 0;
  let measured;
  try {
    JSON.stringify = () => { stringifyCalls++; throw Error('Forbidden native whole serialization'); };
    TextEncoder.prototype.encode = () => { encodedBuffers++; throw Error('Forbidden native whole encoding'); };
    String.prototype.charCodeAt = function(i) { scalarInspections++; return charCode.call(this, i); };
    measured = measure(value);
  } finally { JSON.stringify = stringify; TextEncoder.prototype.encode = encode; String.prototype.charCodeAt = charCode; }
  check(measured.bytes <= MIB && (measured.oversized || measured.error !== null), 'unsupported/oversized terminal measurement');
  check(stringifyCalls === 0 && encodedBuffers === 0 && scalarInspections <= MIB + 3, 'bounded scalar work with no whole allocation');
  if (label === 'late cycle') check(measured.error !== null && measured.bytes >= MIB - 64, 'cycle charges previously traversed prefix');
  stress.push({ label, measured, scalarInspections, stringifyCalls, encodedBuffers });
}
const result = { assertions, nativeDifferentialCases: cases.length, boundaryCases, stress, sourceMethod: 'exact private function text stripped with built-in Node module; no canonical mutation', timingClaim: 'none; native enumeration/clone/string representations remain outside this bound' };
writeFileSync(new URL('./prefix-result.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ assertions, nativeDifferentialCases: cases.length, boundaryCases: boundaryCases.length, stressCases: stress.length }));
