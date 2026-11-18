import { TypingEngine } from './engine.ts';
import type { FiniteAdapter, FiniteAdapterSnapshot, FinitePracticeResult, PracticeSnapshot } from './coach-types.ts';
import { CONFIG_ID, validateCertifiedPlan } from './coach-plan.ts';
import { validateFinitePracticeResult } from './finite-practice-result.ts';

/** The caller admits the snapshot; this adapter owns a defensive copy of its exact plan. */
export function createFiniteAdapter(input: { id: string; snapshot: Readonly<PracticeSnapshot> }): FiniteAdapter {
  const { snapshot } = input;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id) ||
      snapshot.schemaId !== 'typeforge-practice-snapshot-v2' ||
      snapshot.policyId !== 'clean-pair-contrast-v1-r2-enabled' || snapshot.configId !== CONFIG_ID ||
      snapshot.actualExposure !== null || snapshot.focus.pair !== snapshot.plan.pair) {
    throw new RangeError('Finite practice requires an admitted supported snapshot.');
  }
  const plan = structuredClone(validateCertifiedPlan(snapshot.plan));
  const engine = new TypingEngine({ id: input.id, prompts: plan.prompts, finite: true,
    mode: 'practice', inputMode: 'flow-v1', durationMs: 30000, qwerty: true, corpusVersion: '1' });
  let assembled: FinitePracticeResult | null = null;
  return {
    edit: (edit, now) => engine.edit(edit, now),
    interrupt: now => engine.interrupt(now),
    abort: now => engine.abort(now),
    stoppedSnapshot: () => engine.stoppedSnapshot(),
    tick(now): FiniteAdapterSnapshot {
      const state = engine.tick(now);
      return { terminal: state.state === 'completed' ? 'timeout' : state.state, engine: state,
        next: engine.nextPrompt, completedSentences: engine.submittedSummaries.length };
    },
    result(completedAt) {
      if (engine.state === 'completed') return engine.result(completedAt);
      if (assembled) return structuredClone(assembled);
      const data = engine.finiteResult();
      if (!data) return null;
      assembled = validateFinitePracticeResult({ ...data,
        schemaId: 'typeforge-finite-practice-result-v1', owner: 'guest', completedAt,
        mode: 'practice', metricVersion: 1, termination: 'plan-exhausted', eligibleForProgress: false,
        plan: { configId: CONFIG_ID, catalogueId: plan.catalogueId, planHash: plan.planHash,
          pair: plan.pair, sentenceCount: plan.prompts.length },
      }, plan);
      return structuredClone(assembled);
    },
  };
}
