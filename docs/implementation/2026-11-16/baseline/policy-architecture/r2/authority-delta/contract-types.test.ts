// Compile-only independent seam checks; no runtime authority is established.
import type { ProjectionInput, Metadata, VerifiedProof, EpochReset, resetEpoch } from './interfaces-r2.ts';
declare const gathered: Omit<ProjectionInput, 'metadata' | 'finalProof'>;
declare const metadata: Metadata;
declare const proof: VerifiedProof;
const before: ProjectionInput = { ...gathered, metadata, finalProof: null };
const after: ProjectionInput = { ...before, finalProof: proof };
// @ts-expect-error Legacy classification must receive the explicit metadata input.
const noMetadata: ProjectionInput = { ...gathered, finalProof: proof };
// @ts-expect-error Missing proof state cannot masquerade as explicit pre-proof null.
const noProof: ProjectionInput = { ...gathered, metadata };
// @ts-expect-error An actual proof also requires compact selection bindings.
const scalarOnlyProof: VerifiedProof = { authority: gathered.authority, configId: gathered.configId,
  admittedAt: gathered.now, method: 'all-writer-revision' };
const exhausted: EpochReset = { committed: true, authority: null, reason: 'authority-exhausted' };
const unavailable: Awaited<ReturnType<typeof resetEpoch>> = {
  committed: false, authority: null, reason: 'context-unavailable',
};
// @ts-expect-error A committed reset with no authority must state exhaustion.
const falseSuccess: EpochReset = { committed: true, authority: null, reason: null };
// @ts-expect-error A failed reset cannot claim a committed-exhaustion outcome.
const falseCommit: EpochReset = { committed: false, authority: null, reason: 'authority-exhausted' };
void [before, after, noMetadata, noProof, scalarOnlyProof, exhausted, unavailable, falseSuccess, falseCommit];
