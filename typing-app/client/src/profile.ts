import type { Prompt, SentenceSummary, SessionResult } from './engine.ts';

export interface HistorySnapshot {
  count: number;
  logSum: number;
  pairs: Record<string, { count: number; logSum: number }>;
}
export type PracticeFocus = { source: 'model'; pair: string } | {
  source: 'baseline'; pair: string; evidenceCount: number; baselineVersion: string; score: number;
};
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
