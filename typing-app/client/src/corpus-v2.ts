import assessmentBank from './generated/assessment-bank-v2.json' with { type: 'json' };
import practiceBank from './generated/practice-bank-v2.json' with { type: 'json' };
import candidatePairs from './generated/manual-pairs-v2.json' with { type: 'json' };
import { assessmentPrompts as assessmentV1, practicePrompts as practiceV1, shufflePrompts, type Prompt } from './corpus.ts';

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

export function selectPairPrompts(pair: string, random = Math.random): Prompt[] {
  if (!manualPairs.includes(pair)) return [];
  const assessed = assessmentPrompts.reduce((sum, prompt) => sum + occurrences(prompt.text, pair), 0);
  // A3 defines dense as at least twice the assessment rate per typed character, including spaces.
  const dense = practiceBank.sentences.filter(({ text }) => {
    const hits = occurrences(text, pair);
    return hits > 0 && hits * assessmentCharacters >= 2 * assessed * text.length;
  });
  return shufflePrompts(dense, random);
}

// The timed settings and coach certificates stay compatible. Each stored prompt ID names one text.
const savedPrompts = {
  assessment: new Map([...assessmentV1, ...assessmentPrompts].map(prompt => [prompt.id, prompt])),
  practice: new Map([...practiceV1, ...practiceBank.sentences].map(prompt => [prompt.id, prompt])),
};

export function findSavedPrompt(mode: 'assessment' | 'practice', id: string): Prompt | undefined {
  return savedPrompts[mode].get(id);
}
