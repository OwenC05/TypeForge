import { MAX_PROMPT_LENGTH, type Prompt, type SentenceSummary, type SessionResult } from './engine.ts';
import { baselineLogMs, pairPositions, type ModelArtifact } from './model.ts';
import { shufflePrompts } from './corpus.ts';

export interface HistorySnapshot {
  count: number;
  logSum: number;
  pairs: Record<string, { count: number; logSum: number }>;
}
export interface PracticeFocus {
  pair: string;
  evidenceCount: number;
  source: 'baseline';
  baselineVersion: string;
  score: number;
}

export function compatibleSettings(left: SessionResult['settings'], right: SessionResult['settings']): boolean {
  return (left.inputMode ?? 'legacy-enter-v1') === (right.inputMode ?? 'legacy-enter-v1') &&
    left.durationMs === right.durationMs && left.language === right.language &&
    left.qwerty === right.qwerty && left.corpusVersion === right.corpusVersion;
}

export function compatible(result: SessionResult, settings: SessionResult['settings']): boolean {
  return result.metricVersion === 1 && result.schemaVersion === 1 && compatibleSettings(result.settings, settings);
}

export function selectHistory(results: readonly SessionResult[], settings: SessionResult['settings']): SentenceSummary[] {
  return structuredClone(results.filter(r => r.mode === 'assessment' && settings.qwerty && compatible(r, settings))
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id))
    .flatMap(r => r.sentences.filter(s => s.eligible && s.submitted)).slice(-10));
}

export function appendHistory(sentences: readonly SentenceSummary[], sentence: SentenceSummary): SentenceSummary[] {
  return structuredClone([...sentences, ...(sentence.eligible && sentence.submitted ? [sentence] : [])].slice(-10));
}

export function buildHistory(sentences: readonly SentenceSummary[]): HistorySnapshot {
  const history: HistorySnapshot = { count: 0, logSum: 0, pairs: {} };
  for (const sentence of sentences.filter(s => s.eligible && s.submitted).slice(-10)) {
    for (const [pair, stats] of Object.entries(sentence.pairs)) {
      const aggregate = history.pairs[pair] ??= { count: 0, logSum: 0 };
      aggregate.count += stats.count;
      aggregate.logSum += stats.logSum;
      history.count += stats.count;
      history.logSum += stats.logSum;
    }
  }
  return history;
}

// Binary64 forward-error bound, not a minimum meaningful timing difference.
// At most 299 log additions/sentence, 10 sentence-pair additions, 2990 total
// additions and 8 mean/smoothing/subtraction operations; counts are exact.
// Two means contribute at most 2*gamma(n)*maxAbsLog; see foundation/ml04/numerics.md.
const roundingSteps = MAX_PROMPT_LENGTH + 10 * (MAX_PROMPT_LENGTH - 1) + 10 + 8;
const roundingProduct = roundingSteps * (Number.EPSILON / 2);
const meanDifferenceError = 2 * roundingProduct / (1 - roundingProduct);
const maxIntervalLogMagnitude = Math.max(Math.abs(Math.log(Number.MIN_VALUE)), Math.log(5000));

export function selectPracticeFocus(
  history: HistorySnapshot, practiceBank: readonly Prompt[], artifact: ModelArtifact | null,
): PracticeFocus | null {
  if (!history.count) return null;
  const user = history.logSum / history.count;
  const choices: PracticeFocus[] = [];
  for (const [pair, stats] of Object.entries(history.pairs)) {
    if (stats.count < 8) continue;
    let occurrences = 0;
    const ids = new Set<string>();
    for (const prompt of practiceBank) {
      const count = pairPositions(prompt.text).filter(p => prompt.text.slice(p - 1, p + 1) === pair).length;
      if (count) { occurrences += count; ids.add(prompt.id); }
    }
    if (ids.size < 3) continue;
    // Frozen baselines have no word-context features; their context-average is this same value.
    const baseline = baselineLogMs(history, pair, artifact);
    const difference = baseline - user;
    const tolerance = meanDifferenceError * Math.max(maxIntervalLogMagnitude, Math.abs(baseline), Math.abs(user));
    if (difference <= tolerance) continue;
    const score = difference * occurrences;
    if (Number.isFinite(score) && score > 0) choices.push({
      pair, evidenceCount: stats.count, source: 'baseline',
      baselineVersion: artifact?.baseline.version ?? 'observed-history-v1', score,
    });
  }
  return choices.sort((a, b) => b.score - a.score || a.pair.localeCompare(b.pair))[0] ?? null;
}

export function supportedManualPairs(practiceBank: readonly Prompt[]): string[] {
  const passages = new Map<string, Set<string>>();
  for (const prompt of practiceBank) {
    for (const position of pairPositions(prompt.text)) {
      const pair = prompt.text.slice(position - 1, position + 1);
      if (!passages.has(pair)) passages.set(pair, new Set());
      passages.get(pair)!.add(prompt.id);
    }
  }
  return [...passages].filter(([, ids]) => ids.size >= 3).map(([pair]) => pair).sort();
}

export function selectDrillPrompts(focus: { pair: string } | null, practiceBank: readonly Prompt[]): Prompt[] {
  if (!focus) return shufflePrompts(practiceBank);
  const target = shufflePrompts(practiceBank.filter(p =>
    pairPositions(p.text).some(i => p.text.slice(i - 1, i + 1) === focus.pair)));
  if (target.length < 3) return shufflePrompts(practiceBank);
  const targetIds = new Set(target.map(p => p.id));
  const general = shufflePrompts(practiceBank.filter(p => !targetIds.has(p.id)));
  let targetIndex = 0, generalIndex = 0;
  const result: Prompt[] = [];
  for (let i = 0; i < 120; i++) {
    const useGeneral = i % 3 === 2 && general.length > 0;
    const bank = useGeneral ? general : target;
    let index = useGeneral ? generalIndex++ : targetIndex++;
    if (bank[index % bank.length]!.id === result.at(-1)?.id) index = useGeneral ? generalIndex++ : targetIndex++;
    result.push({ ...bank[index % bank.length]! });
  }
  return result;
}

export function resolveRetest(
  origin: SessionResult | null, settings: SessionResult['settings'], assessmentBank: readonly Prompt[],
): { kind: 'retest'; sourceAssessmentId: string; excludedPromptIds: string[] } |
   { kind: 'new-assessment'; reason: string } {
  if (!origin) return { kind: 'new-assessment', reason: 'The original assessment is unavailable or was deleted.' };
  if (origin.mode !== 'assessment' || !origin.eligibleForProgress || !compatible(origin, settings)) {
    return { kind: 'new-assessment', reason: 'The original assessment is not eligible or has incompatible settings.' };
  }
  const excludedPromptIds = [...new Set(origin.sentences.map(s => s.promptId))];
  if (!assessmentBank.some(p => !excludedPromptIds.includes(p.id))) {
    return { kind: 'new-assessment', reason: 'No fresh assessment passages remain.' };
  }
  return { kind: 'retest', sourceAssessmentId: origin.id, excludedPromptIds };
}
