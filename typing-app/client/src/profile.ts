import type { Prompt, SentenceSummary, SessionResult } from './engine.ts';
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

function compatible(result: SessionResult, settings: SessionResult['settings']): boolean {
  return result.metricVersion === 1 && result.schemaVersion === 1 &&
    result.settings.durationMs === settings.durationMs &&
    result.settings.language === settings.language &&
    result.settings.qwerty === settings.qwerty &&
    result.settings.corpusVersion === settings.corpusVersion;
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
    const score = Math.max(0, baselineLogMs(history, pair, artifact) - user) * occurrences;
    if (Number.isFinite(score) && score > 0) choices.push({
      pair, evidenceCount: stats.count, source: 'baseline',
      baselineVersion: artifact?.baseline.version ?? 'observed-history-v1', score,
    });
  }
  return choices.sort((a, b) => b.score - a.score || a.pair.localeCompare(b.pair))[0] ?? null;
}

export function selectDrillPrompts(focus: PracticeFocus | null, practiceBank: readonly Prompt[]): Prompt[] {
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
