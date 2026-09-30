import type { FrozenSentencePredictions } from './engine.ts';
import type { HistorySnapshot } from './profile.ts';

export interface ModelArtifact {
  artifactVersion: 1;
  featureVersion: 1;
  modelVersion: string;
  status: 'experimental';
  task: { language: 'en'; layout: 'qwerty'; lowercasePairsOnly: true; historySentences: 10; maxIntervalMs: 5000 };
  featureNames: string[];
  coefficients: number[];
  intercept: number;
  populationMeanLogMs: number;
  baseline: { kind: 'population' | 'user' | 'smoothed-pair'; version: string; k: number };
  residualLogQuantiles: { q10: number; q90: number };
  provenance: { sourceUrl: string; manifestSha256: string; configSha256: string; reportVersion: string };
}
export interface PredictionPreparation {
  status: 'candidate-and-baseline' | 'baseline-only' | 'unavailable';
  reason: string | null;
  predictions: FrozenSentencePredictions | null;
}

const featureNames = Array.from({ length: 676 }, (_, i) =>
  `pair_${String.fromCharCode(97 + Math.floor(i / 26), 97 + i % 26)}`)
  .concat(['word_length', 'pair_position', 'user_mean_log_ms', 'user_log_count', 'pair_mean_log_ms', 'pair_log_count']);

export function parseModelArtifact(value: unknown): ModelArtifact {
  const shape = (v: unknown, keys: string[]): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(v)) ||
      Object.keys(v).length !== keys.length || !Object.keys(v).every(k => keys.includes(k))) {
      throw new Error('Invalid model artifact shape');
    }
    return v as Record<string, unknown>;
  };
  const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  const version = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 80;
  const artifact = shape(value, ['artifactVersion', 'featureVersion', 'modelVersion', 'status', 'task',
    'featureNames', 'coefficients', 'intercept', 'populationMeanLogMs', 'baseline', 'residualLogQuantiles', 'provenance']);
  const task = shape(artifact.task, ['language', 'layout', 'lowercasePairsOnly', 'historySentences', 'maxIntervalMs']);
  const baseline = shape(artifact.baseline, ['kind', 'version', 'k']);
  const residuals = shape(artifact.residualLogQuantiles, ['q10', 'q90']);
  const provenance = shape(artifact.provenance, ['sourceUrl', 'manifestSha256', 'configSha256', 'reportVersion']);
  if (artifact.artifactVersion !== 1 || artifact.featureVersion !== 1 || !version(artifact.modelVersion) || artifact.status !== 'experimental' ||
    task.language !== 'en' || task.layout !== 'qwerty' || task.lowercasePairsOnly !== true || task.historySentences !== 10 || task.maxIntervalMs !== 5000 ||
    !Array.isArray(artifact.featureNames) || artifact.featureNames.length !== 682 || !Array.from(artifact.featureNames).every((n, i) => n === featureNames[i]) ||
    !Array.isArray(artifact.coefficients) || artifact.coefficients.length !== 682 || !Array.from(artifact.coefficients).every(finite) ||
    !finite(artifact.intercept) || !finite(artifact.populationMeanLogMs) ||
    !['population', 'user', 'smoothed-pair'].includes(baseline.kind as string) || !version(baseline.version) ||
    (baseline.kind === 'smoothed-pair' ? ![1, 5, 20].includes(baseline.k as number) : baseline.k !== 0) ||
    !finite(residuals.q10) || !finite(residuals.q90) || (residuals.q10 as number) > (residuals.q90 as number) ||
    typeof provenance.sourceUrl !== 'string' || !/^https?:\/\//.test(provenance.sourceUrl) || !version(provenance.reportVersion) ||
    ![provenance.manifestSha256, provenance.configSha256].every(h => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h))) {
    throw new Error('Invalid model artifact values');
  }
  return structuredClone(value) as ModelArtifact;
}

/** Only adjacent lowercase letters inside maximal ASCII words are modelled. */
export function pairPositions(prompt: string): number[] {
  const positions: number[] = [];
  for (const word of prompt.matchAll(/[A-Za-z]+/g)) {
    for (let i = 1; i < word[0].length; i++) {
      if (/^[a-z]{2}$/.test(word[0].slice(i - 1, i + 1))) positions.push(word.index + i);
    }
  }
  return positions;
}

export function buildFeatures(
  prompt: string, position: number, history: HistorySnapshot, populationMeanLogMs: number,
): number[] {
  const word = [...prompt.matchAll(/[A-Za-z]+/g)]
    .find(w => position > w.index && position < w.index + w[0].length);
  if (!Number.isInteger(position) || !word || !/^[a-z]{2}$/.test(prompt.slice(position - 1, position + 1))) {
    throw new Error('Unsupported pair position');
  }
  const pair = prompt.slice(position - 1, position + 1);
  const stats = history.pairs[pair];
  const user = history.count ? history.logSum / history.count : populationMeanLogMs;
  const values = Array(676).fill(0);
  values[(pair.charCodeAt(0) - 97) * 26 + pair.charCodeAt(1) - 97] = 1;
  values.push(word[0].length, (position - word.index) / (word[0].length - 1),
    user, Math.log1p(history.count), stats?.count ? stats.logSum / stats.count : user,
    Math.log1p(stats?.count ?? 0));
  if (!values.every(Number.isFinite)) throw new Error('Nonfinite features');
  return values;
}

export function baselineLogMs(history: HistorySnapshot, pair: string, artifact: ModelArtifact | null): number {
  const user = history.count ? history.logSum / history.count : artifact?.populationMeanLogMs ?? NaN;
  if (!artifact) return user;
  if (artifact.baseline.kind === 'population') return artifact.populationMeanLogMs;
  if (artifact.baseline.kind === 'user') return user;
  const stats = history.pairs[pair];
  return ((stats?.logSum ?? 0) + artifact.baseline.k * user) / ((stats?.count ?? 0) + artifact.baseline.k);
}

export function predictSentence(
  prompt: string, history: HistorySnapshot, artifact: ModelArtifact | null,
): PredictionPreparation {
  const unavailable = (reason: string): PredictionPreparation => ({ status: 'unavailable', reason, predictions: null });
  const positions = pairPositions(prompt);
  if (!positions.length) return unavailable('No supported lowercase letter pairs.');
  const occurrences = positions.map(position => ({
    position, baselineLogMs: baselineLogMs(history, prompt.slice(position - 1, position + 1), artifact),
  }));
  const valid = (n: number) => Number.isFinite(n) && Number.isFinite(Math.exp(n)) && Math.exp(n) > 0;
  if (!occurrences.every(o => valid(o.baselineLogMs))) return unavailable('No finite baseline history or artifact is available.');
  const baseline = artifact ? { kind: artifact.baseline.kind, version: artifact.baseline.version } :
    { kind: 'user' as const, version: 'observed-history-v1' };
  const predictions: FrozenSentencePredictions = { featureVersion: 1, baseline, occurrences };
  if (!artifact) return { status: 'baseline-only', reason: 'Model unavailable; using observed user history.', predictions };
  try {
    const candidate = occurrences.map(o => ({
      ...o,
      candidateLogMs: buildFeatures(prompt, o.position, history, artifact.populationMeanLogMs)
        .reduce((sum, x, i) => sum + x * artifact.coefficients[i]!, artifact.intercept),
    }));
    if (!candidate.every(o => valid(o.candidateLogMs))) throw new Error('Nonfinite candidate prediction');
    predictions.candidate = { modelVersion: artifact.modelVersion, status: 'experimental' };
    predictions.occurrences = candidate;
    return { status: 'candidate-and-baseline', reason: null, predictions };
  } catch {
    return { status: 'baseline-only', reason: 'Candidate inference failed; baseline remains available.', predictions };
  }
}
