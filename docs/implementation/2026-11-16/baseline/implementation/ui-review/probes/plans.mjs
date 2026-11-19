// Independent source check (reviewer-owned): every certified plan's sentences contain its pair,
// and the plan is the whole block (no General mixing step). Also exports an id -> text map that the
// browser probe uses to identify which bank a displayed or saved prompt came from.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolveCertifiedPlan } from '../../../../../../../typing-app/client/src/coach-plan.ts';
import { practicePrompts, assessmentPrompts } from '../../../../../../../typing-app/client/src/corpus.ts';

const out = { plans: {}, practice: {}, assessment: {} };
for (const pair of ['he', 'in', 'le', 'th']) {
  const plan = resolveCertifiedPlan(pair);
  assert.ok(plan, `certified plan ${pair}`);
  const missing = plan.prompts.filter(p => !p.text.includes(pair)).map(p => p.id);
  out.plans[pair] = { count: plan.prompts.length, missing, ids: plan.prompts.map(p => p.id), texts: plan.prompts.map(p => p.text),
    characters: plan.prompts.reduce((n, p) => n + p.text.length + 1, 0) };
  assert.equal(plan.prompts.length, 12, `${pair}: 12 prompts`);
  assert.deepEqual(missing, [], `${pair}: every sentence contains the pair`);
}
for (const p of practicePrompts) out.practice[p.id] = p.text;
for (const p of assessmentPrompts) out.assessment[p.id] = p.text;
writeFileSync(new URL('./plans.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(out.plans).map(([k, v]) => [k, { count: v.count, missing: v.missing, characters: v.characters }]))));
