import config from './coach-config.json' with { type: 'json' };
import catalogue from './coach-catalogue.json' with { type: 'json' };
import { CORPUS_VERSION, assessmentPrompts, practicePrompts } from './corpus.ts';
import type { CertifiedPlan, FinitePracticeResult } from './coach-types.ts';

export const CONFIG_ID = 'de43c1c2266364e8c859ac3abc61126590fbec2d10be9b7e0e14616770411995';
export const CATALOGUE_ID = '17de69ffe905a28e8e00ad65d1494a003b080bcd2a894a81fea5c28351594a25';
export const BANK_HASH = 'b73528f56537020c915dcf5e3a6a4e970e438ebc3210758f093901d92ef736b1';

/** JSON content identity: reject values that JSON would silently omit/coerce. */
export function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>();
  function encode(v: unknown): string {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v);
    if (typeof v === 'number' && Number.isFinite(v)) return JSON.stringify(v);
    if (typeof v !== 'object' || ancestors.has(v!)) throw new Error('Invalid canonical JSON');
    const object = v as Record<string, unknown>;
    if (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null)
      throw new Error('Invalid canonical JSON object');
    ancestors.add(object);
    let result: string;
    if (Array.isArray(v)) {
      if (Object.keys(v).length !== v.length) throw new Error('Invalid canonical JSON array');
      result = `[${Array.from(v, encode).join(',')}]`;
    } else result = `{${Object.keys(object).sort().map(k => `${JSON.stringify(k)}:${encode(object[k])}`).join(',')}}`;
    ancestors.delete(object);
    return result;
  }
  return encode(value);
}

// Synchronous SHA-256 keeps the frozen pure projection/admission signatures synchronous.
// Storage may use WebCrypto outside transactions; both hash the same canonical UTF-8 bytes.
const SHA_K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);
const rotate = (v: number, n: number) => (v >>> n) | (v << (32 - n));
export function hashCanonical(value: unknown): string {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes); padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bytes.length / 0x20000000));
  view.setUint32(padded.length - 4, bytes.length * 8);
  const h = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + 4 * i);
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      w[i] = w[i - 16] + (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) + w[i - 7] +
        (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10));
    }
    let [a,b,c,d,e,f,g,j] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (j + (rotate(e,6) ^ rotate(e,11) ^ rotate(e,25)) + ((e & f) ^ (~e & g)) + SHA_K[i] + w[i]) >>> 0;
      const t2 = ((rotate(a,2) ^ rotate(a,13) ^ rotate(a,22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      j=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    [a,b,c,d,e,f,g,j].forEach((v, i) => { h[i] = (h[i] + v) >>> 0; });
  }
  return Array.from(h, n => n.toString(16).padStart(8, '0')).join('');
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
export const COACH_CONFIG = deepFreeze(config);
deepFreeze(catalogue);

export function validateCoachConfig(value: unknown): typeof COACH_CONFIG {
  if (hashCanonical(config) !== CONFIG_ID || canonicalJson(value) !== canonicalJson(config))
    throw new Error('Invalid coach config');
  return COACH_CONFIG;
}

export interface PairOccurrence { pair: string; end: number; word: string; wordEnd: number }
export function pairOccurrences(text: string, pair?: string): PairOccurrence[] {
  const found: PairOccurrence[] = [];
  for (const match of text.matchAll(/[a-z]+/g)) {
    for (let i = 0; i + 1 < match[0].length; i++) {
      const current = match[0].slice(i, i + 2);
      if (pair === undefined || pair === current) found.push({ pair: current,
        end: match.index + i + 2, word: match[0], wordEnd: match.index + match[0].length });
    }
  }
  return found;
}

/** Fixed catalogue resolution only. Failure is independent of prediction/Ridge. */
export function resolveCertifiedPlan(pair: string): CertifiedPlan | null {
  try {
    validateCoachConfig(config);
    if (CORPUS_VERSION !== '1' || hashCanonical({ corpusVersion: CORPUS_VERSION, assessmentPrompts, practicePrompts }) !== BANK_HASH ||
      hashCanonical(catalogue) !== CATALOGUE_ID || catalogue.bankHash !== BANK_HASH) return null;
    const template = catalogue.templates.find(t => t.pair === pair);
    if (!template) return null;
    const prompts = template.promptIds.map(id => practicePrompts.find(p => p.id === id));
    if (prompts.some(p => !p)) return null;
    const plan = prompts as NonNullable<typeof prompts[number]>[];
    if (new Set(plan.map(p => p.id)).size !== plan.length || new Set(plan.map(p => p.text)).size !== plan.length ||
      hashCanonical({ pair, bankHash: BANK_HASH, prompts: plan }) !== template.planHash) return null;
    const exposure = config.exposure;
    const targetBank = practicePrompts.filter(p => pairOccurrences(p.text, pair).length);
    if (targetBank.length < exposure.minimumBankPassages ||
      new Set(targetBank.flatMap(p => pairOccurrences(p.text, pair).map(o => o.word))).size < exposure.minimumWords) return null;
    const generalCharacters = practicePrompts.reduce((n, p) => n + p.text.length, 0);
    const generalOpportunities = targetBank.reduce((n, p) => n + pairOccurrences(p.text, pair).length, 0);
    const ends: number[] = [], words = new Set<string>();
    let characters = 0, passages = 0;
    for (const prompt of plan) {
      const occurrences = pairOccurrences(prompt.text, pair);
      if (!occurrences.length) return null;
      for (const o of occurrences) {
        ends.push(characters + o.end);
        if (characters + o.wordEnd <= exposure.wordsByCharacter) words.add(o.word);
      }
      characters += prompt.text.length;
      if (characters <= exposure.passagesByCharacter) passages++;
    }
    if (characters < exposure.minimumPlanCharacters || characters > exposure.maximumPlanCharacters ||
      ends[0] > exposure.firstTargetByCharacter || words.size < exposure.minimumWords || passages < exposure.minimumPassages) return null;
    let opportunities = 0;
    for (let n = exposure.allPrefixesFrom; n <= characters; n++) {
      while (opportunities < ends.length && ends[opportunities] <= n) opportunities++;
      if (4 * opportunities * generalCharacters < 5 * n * generalOpportunities) return null;
    }
    return deepFreeze({ adapterId: 'finite-practice-adapter-v1', pair, catalogueId: CATALOGUE_ID,
      bankHash: BANK_HASH, planHash: template.planHash,
      certificateId: hashCanonical({ configId: CONFIG_ID, catalogueId: CATALOGUE_ID, bankHash: BANK_HASH, pair, prompts: plan }),
      characterCount: characters, prompts: plan.map(p => ({ ...p })) });
  } catch { return null; }
}

export function validateCertifiedPlan(value: unknown): CertifiedPlan {
  const pair = value !== null && typeof value === 'object' ? (value as CertifiedPlan).pair : undefined;
  const expected = typeof pair === 'string' ? resolveCertifiedPlan(pair) : null;
  if (!expected || canonicalJson(value) !== canonicalJson(expected)) throw new Error('Invalid certified coach plan');
  return expected;
}

/** Historical content validation only; does not admit evidence or a new practice block. */
export async function resolveStoredFinitePlan(identity: FinitePracticeResult['plan']): Promise<CertifiedPlan | null> {
  try {
    const plan = resolveCertifiedPlan(identity?.pair);
    if (!plan || canonicalJson(identity) !== canonicalJson({ configId: CONFIG_ID, catalogueId: CATALOGUE_ID,
      planHash: plan.planHash, pair: plan.pair, sentenceCount: plan.prompts.length })) return null;
    return plan;
  } catch { return null; }
}
