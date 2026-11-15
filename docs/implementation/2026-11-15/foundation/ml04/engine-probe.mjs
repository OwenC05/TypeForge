// Synthetic engine reproduction, never hardware, user, or benefit evidence.
// Run from repository root with Node >=24: node --experimental-strip-types <this file>
import {readFileSync} from 'node:fs';
import {assessmentPrompts, practicePrompts} from '../../../../../typing-app/client/src/corpus.ts';
import {TypingEngine} from '../../../../../typing-app/client/src/engine.ts';
import {parseModelArtifact} from '../../../../../typing-app/client/src/model.ts';
import {buildHistory, selectPracticeFocus} from '../../../../../typing-app/client/src/profile.ts';
const artifact = parseModelArtifact(JSON.parse(readFileSync(new URL('../../../../../typing-app/client/src/generated/model.json', import.meta.url), 'utf8')));
const engine = new TypingEngine({id:'synthetic-uniform', qwerty:true, inputMode:'flow-v1', durationMs:120000, prompts:assessmentPrompts});
let time = 0;
for (const prompt of assessmentPrompts.slice(0, 10)) for (const text of prompt.text + ' ') {
  time += 200;
  if (!engine.edit({start:engine.value.length, end:engine.value.length, text, pressTime:time}, time)) throw new Error('Rejected synthetic key');
}
const summaries = engine.submittedSummaries;
console.log(JSON.stringify({synthetic:true, intervalMs:200, submitted: summaries.length,
  eligible:summaries.filter(s => s.eligible).length, observations:buildHistory(summaries).count,
  focus:selectPracticeFocus(buildHistory(summaries), practicePrompts, artifact)}, null, 2));
