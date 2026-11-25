import assessmentBank from './generated/assessment-bank-v2.json' with { type: 'json' };
import practiceBank from './generated/practice-bank-v2.json' with { type: 'json' };
import candidatePairs from './generated/manual-pairs-v2.json' with { type: 'json' };
import { shufflePrompts, type Prompt } from './corpus.ts';

export const assessmentPrompts = assessmentBank.sentences;
// Ship just the 100 candidate_pairs from ml/corpus/pair_frequencies.json in the standalone client.
export const manualPairs = candidatePairs.toSorted();

export function selectAssessmentPrompts(excludeIds: readonly string[], random = Math.random): Prompt[] {
  const excluded = new Set(excludeIds);
  return shufflePrompts(assessmentPrompts.filter(prompt => !excluded.has(prompt.id)), random);
}

function occurrences(text: string, pair: string): number {
  let count = 0;
  for (let i = text.indexOf(pair); i !== -1; i = text.indexOf(pair, i + 1)) count++;
  return count;
}

const assessmentCharacters = assessmentPrompts.reduce((sum, prompt) => sum + prompt.text.length, 0);
const pairOnly: Readonly<Record<string, string>> = practiceBank.pairOnly;

export function selectPairPrompts(pair: string, random = Math.random): Prompt[] {
  if (!manualPairs.includes(pair)) return [];
  const assessed = assessmentPrompts.reduce((sum, prompt) => sum + occurrences(prompt.text, pair), 0);
  // A3 defines dense as at least twice the assessment rate per typed character, including spaces.
  const dense = practiceBank.sentences.filter(({ id, text }) => {
    if (pairOnly[id] && pairOnly[id] !== pair) return false;
    const hits = occurrences(text, pair);
    return hits > 0 && hits * assessmentCharacters >= 2 * assessed * text.length;
  });
  return shufflePrompts(dense, random);
}
