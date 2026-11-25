import { foldCoachHistory, laterMeanRange, loadCoachModel, suggestion, update } from './coach-model.ts';
import type { SentenceSummary, SessionResult } from './engine.ts';
import { listResultsPage } from './storage.ts';

export const HISTORY_LIMIT = 200;
export const FIT_WINDOW = 20;
export const FIT_MIN_SENTENCES = 8;
export const FIT_THRESHOLD = 0.70;

type Evidence = Pick<SentenceSummary, 'submitted' | 'eligible' | 'pairs'>;
type Model = Awaited<ReturnType<typeof loadCoachModel>>;

function hasCurrentPairs(sentence: unknown): boolean {
  if (!sentence || typeof sentence !== 'object' || !('pairs' in sentence)) return false;
  const { pairs } = sentence;
  return !!pairs && typeof pairs === 'object' && !Array.isArray(pairs) && Object.entries(pairs).every(([pair, stats]) =>
    /^[a-z]{2}$/.test(pair) && stats && typeof stats === 'object' && Object.keys(stats).length === 2 && Number.isSafeInteger(stats.count) && stats.count > 0 && Number.isFinite(stats.logSum));
}

export function coachSentences(source: SessionResult): Evidence[] {
  if (!source.settings.qwerty || source.qualityFlags.length || source.practiceFocus || source.manualDrill) return [];
  return source.sentences.filter(s => s.eligible && s.submitted && hasCurrentPairs(s))
    .map(({ eligible, submitted, pairs }) => ({ eligible, submitted, pairs }));
}

export function evaluateCoach(model: Model, sentences: readonly Evidence[]) {
  const history = foldCoachHistory(sentences.slice(-HISTORY_LIMIT));
  const state = update(model, history);
  let checks = 0, inside = 0, checkedSentences = 0;
  // Only the latest checked sentences affect coverage. Each prediction sees strictly earlier evidence.
  const checkIndices: number[] = [];
  for (let i = sentences.length - 1; i > 0 && checkIndices.length < FIT_WINDOW; i--) {
    if (Object.keys(sentences[i]!.pairs).length) checkIndices.push(i);
  }
  for (const i of checkIndices.reverse()) {
    const prior = update(model, foldCoachHistory(sentences.slice(Math.max(0, i - HISTORY_LIMIT), i)));
    for (const [pair, { count, logSum }] of Object.entries(sentences[i]!.pairs)) {
      const [low, high] = laterMeanRange(model, prior, pair, count);
      const mean = logSum / count;
      inside += Number(low <= mean && mean <= high);
      checks++;
    }
    checkedSentences++;
  }
  const coverage = checks ? inside / checks : null;
  const stopped = checkedSentences >= FIT_MIN_SENTENCES && coverage !== null && coverage < FIT_THRESHOLD;
  const pair = stopped ? null : suggestion(state, model, history.counts);
  const personalGap = (index: number) => ({
    pair: String.fromCharCode(97 + Math.floor(index / 26), 97 + index % 26),
    gap: state.gap[index]!, count: history.counts[index]!,
  });
  const gaps = Array.from(history.counts, (_, index) => personalGap(index))
    .filter(g => g.count >= 2 && g.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 3);
  const speed = history.counts.some(n => n > 0) ? state.speed : null;
  return {
    hasEvidence: sentences.length > 0, speed, outside: speed !== null && (speed < model.low || speed > model.high),
    focus: pair ? personalGap((pair.charCodeAt(0) - 97) * 26 + pair.charCodeAt(1) - 97) : null,
    gaps, fit: { inside, checks, sentences: checkedSentences, coverage, stopped },
  };
}

export type CoachReadout = ReturnType<typeof evaluateCoach>;

export async function readCoach(signal?: AbortSignal): Promise<CoachReadout> {
  const model = await loadCoachModel();
  const newestFirst: Evidence[] = [];
  let checked = 0, prior = 0;
  let cursor: { completedAt: string; id: string } | null = null;
  // Keep enough warm-up for even the oldest of the 20 fit checks. Empty pair maps
  // occupy an evidence sentence but supply no check.
  while (prior < HISTORY_LIMIT) {
    signal?.throwIfAborted();
    const page = await listResultsPage(cursor, 100, hasCurrentPairs);
    for (const result of page) {
      for (const sentence of coachSentences(result).reverse()) {
        newestFirst.push(sentence);
        if (checked < FIT_WINDOW) checked += Number(Object.keys(sentence.pairs).length > 0);
        else prior++;
        if (prior === HISTORY_LIMIT) break;
      }
      if (prior === HISTORY_LIMIT) break;
    }
    if (page.length < 100) break;
    const last = page.at(-1)!;
    cursor = { completedAt: last.completedAt, id: last.id };
  }
  signal?.throwIfAborted();
  return evaluateCoach(model, newestFirst.reverse());
}
