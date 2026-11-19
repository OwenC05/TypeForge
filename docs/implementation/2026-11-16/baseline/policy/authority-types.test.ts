// Compile-only seam regressions; no runtime implementation or proof authority.
import type { ProjectionInput, Metadata, VerifiedProof, EpochReset } from './interfaces-r2.ts';
declare const gathered: Omit<ProjectionInput, 'metadata' | 'finalProof'>;
declare const metadata: Metadata;
declare const actualFinalProof: VerifiedProof;

const provisional: ProjectionInput = { ...gathered, metadata, finalProof: null };
const postProof: ProjectionInput = { ...provisional, finalProof: actualFinalProof };
// @ts-expect-error S1 metadata cannot be omitted from pure classification.
const missingMetadata: ProjectionInput = { ...gathered, finalProof: actualFinalProof };
// @ts-expect-error S2 a pre-proof call must explicitly supply null, not omit proof state.
const missingProof: ProjectionInput = { ...gathered, metadata };
const exhaustedReset: EpochReset = { committed: true, authority: null, reason: 'authority-exhausted' };
// @ts-expect-error S3 committed exhaustion cannot be labelled usable reset success.
const falseResetSuccess: EpochReset = { committed: true, authority: null, reason: null };
void [postProof, missingMetadata, missingProof, exhaustedReset, falseResetSuccess];
