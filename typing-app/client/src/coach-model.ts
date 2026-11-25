import type { SentenceSummary } from './engine.ts';

const PAIRS = 26 * 26;

interface CoachModel {
  version: 1;
  modelSha256: string;
  trainSha256: string;
  pairFrequenciesSha256: string;
  center: number;
  low: number;
  high: number;
  a: number[];
  b: number[];
  sigma2: number[];
  tau2: number[];
  frequency: number[];
  MIN_COUNT: number;
  GAP: number;
  COACH_Z: number;
  RANGE_Z: number;
}

export function parseCoachModel(value: unknown): CoachModel {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Expected a coach model object.');
  }
  const model = value as Partial<CoachModel>;
  const hashes = [model.modelSha256, model.trainSha256, model.pairFrequenciesSha256];
  const vectors = [model.a, model.b, model.sigma2, model.tau2, model.frequency];
  const scalars = [model.center, model.low, model.high, model.MIN_COUNT, model.GAP, model.COACH_Z, model.RANGE_Z];
  if (Object.keys(model).length !== 1 + hashes.length + vectors.length + scalars.length ||
      model.version !== 1 || !hashes.every(h => typeof h === 'string' && /^[a-f0-9]{64}$/.test(h)) ||
      !scalars.every(Number.isFinite) || !vectors.every(v =>
        Array.isArray(v) && v.length === PAIRS && Array.from(v).every(Number.isFinite))) {
    throw new TypeError('Invalid coach model fields.');
  }
  const table = model as CoachModel;
  if (table.low > table.high || !Number.isSafeInteger(table.MIN_COUNT) || table.MIN_COUNT < 1 ||
      table.COACH_Z <= 0 || table.RANGE_Z <= 0 || table.sigma2.some(v => v <= 0) ||
      table.tau2.some(v => v <= 0) || table.frequency.some(v => v < 0)) {
    throw new RangeError('Invalid coach support, thresholds, variances or frequencies.');
  }
  return structuredClone(table);
}

export async function loadCoachModel(): Promise<CoachModel> {
  const { default: table } = await import('./generated/coach-model.json', { with: { type: 'json' } });
  return parseCoachModel(table);
}

function pairIndex(name: string): number {
  return /^[a-z]{2}$/.test(name) ? (name.charCodeAt(0) - 97) * 26 + name.charCodeAt(1) - 97 : -1;
}

export function foldCoachHistory(sentences: readonly Pick<SentenceSummary, 'eligible' | 'submitted' | 'pairs'>[]) {
  const counts = new Float64Array(PAIRS);
  const logSums = new Float64Array(PAIRS);
  for (const sentence of sentences) {
    if (!sentence.eligible || !sentence.submitted) continue;
    for (const [pair, observation] of Object.entries(sentence.pairs)) {
      const p = pairIndex(pair);
      if (p < 0) continue;
      counts[p] += observation.count;
      logSums[p] += observation.logSum;
    }
  }
  return { counts, logSums };
}

export function update(model: CoachModel, history: ReturnType<typeof foldCoachHistory>) {
  const { counts, logSums } = history;
  let count = 0;
  let total = 0;
  let anchorTotal = 0;
  for (let p = 0; p < PAIRS; p++) {
    count += counts[p];
    total += logSums[p];
    anchorTotal += counts[p] * model.a[p];
  }
  const ownMean = count ? total / count : model.center;
  const speed = model.center + (count ? (total - anchorTotal) / count : 0);
  const bound = Math.min(model.high, Math.max(model.low, speed));
  const expected = new Float64Array(PAIRS);
  const gap = new Float64Array(PAIRS);
  const variance = new Float64Array(PAIRS);
  for (let p = 0; p < PAIRS; p++) {
    expected[p] = model.a[p] + model.b[p] * (bound - model.center) + (speed - bound);
    const denominator = model.sigma2[p] + counts[p] * model.tau2[p];
    gap[p] = model.tau2[p] * (logSums[p] - counts[p] * expected[p]) / denominator;
    variance[p] = model.tau2[p] * model.sigma2[p] / denominator;
  }
  return { speed, ownMean, expected, gap, variance };
}

type Personal = ReturnType<typeof update>;

export function suggestion(state: Personal, model: CoachModel, counts: Float64Array): string | null {
  let best = -1;
  let bestScore = -Infinity;
  for (let p = 0; p < PAIRS; p++) {
    if (counts[p] < model.MIN_COUNT || model.frequency[p] === 0 ||
        state.gap[p] - model.COACH_Z * Math.sqrt(state.variance[p]) <= model.GAP) continue;
    const interval = Math.exp(state.expected[p] + 0.5 * model.sigma2[p]);
    const score = model.frequency[p] * interval * Math.expm1(state.gap[p]);
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best < 0 ? null : String.fromCharCode(97 + Math.floor(best / 26), 97 + best % 26);
}

/** Nominal 80% interval for the mean of m later log-ms observations of this pair. */
export function laterMeanRange(model: CoachModel, state: Personal, pair: string, m: number): [number, number] {
  const p = pairIndex(pair);
  if (p < 0 || !Number.isSafeInteger(m) || m < 1) throw new RangeError('Expected a letter pair and positive count.');
  const mean = state.expected[p] + state.gap[p];
  const radius = model.RANGE_Z * Math.sqrt(state.variance[p] + model.sigma2[p] / m);
  return [mean - radius, mean + radius];
}
