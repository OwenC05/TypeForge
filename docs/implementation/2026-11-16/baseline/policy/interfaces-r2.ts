// Contract declarations only. No implementation, database authority or UI approval.
import type { SessionResult, Metrics, SentenceSummary, ChartSample, Prompt,
  EngineSnapshot, Edit, StoppedSnapshot } from '../../../../../typing-app/client/src/engine.ts';

export type Hash = string; // exactly 64 lowercase hex characters
export type UTC = string; // canonical 24-character millisecond UTC + calendar round trip
export type OpaqueId = string; // 1..128 characters; source IDs retain existing UUID validation
export type Purpose = 'ordinary' | 'protected-probe';
export type SourceKind = 'timed-v1' | 'finite-practice-v1';
export type Partition = 'legacy' | 'current';
export type Reason = 'policy-invalid' | 'storage-unavailable' | 'context-unavailable'
  | 'source-integrity' | 'scan-incomplete' | 'baseline-incomplete' | 'coaching-deferred'
  | 'stale-evidence' | 'too-few-observations-for-any-pair' | 'insufficient-context-diversity'
  | 'unstable-evidence' | 'no-effect' | 'corpus-coverage' | 'exposure-unsupported' | 'supported';
export type Stop = 'row-budget' | 'byte-budget' | 'record-limit' | 'aborted' | 'failure'
  | 'authority-changed' | 'proof-unavailable';
export interface Authority {
  databaseId: OpaqueId; contextId: OpaqueId; epochId: OpaqueId; revision: number;
}
export interface Metadata {
  schemaId: 'typeforge-coach-metadata-v3'; databaseId: OpaqueId;
  defaultContextId: OpaqueId; activeEpochId: OpaqueId; legacyEpochId: OpaqueId;
  legacyCutoffCompletedAt: UTC; sourceRevision: number;
}
export interface Capture {
  databaseId: OpaqueId; contextId: OpaqueId; epochId: OpaqueId;
  capturedAt: UTC; purpose: Purpose;
}
export interface Membership extends Capture {
  schemaId: 'typeforge-coach-membership-v2'; sourceKind: SourceKind;
  resultId: string; resultSha256: Hash;
}
export interface SourceRef {
  partition: Partition; kind: SourceKind; id: string; sha256: Hash; completedAt: UTC;
}
export interface SourceRead {
  ref: SourceRef; source: SavedSource; membership: Membership | null;
}
export interface MergedCursor {
  schemaId: 'typeforge-source-cursor-v3'; databaseId: OpaqueId;
  // Native IDB keys remain structured-cloned, never serialized as arbitrary JSON.
  legacy: { before: IDBValidKey | null; exhausted: boolean };
  current: { before: IDBValidKey | null; exhausted: boolean };
}
export interface Work {
  examinedRows: number; examinedBytes: number; slices: number;
  keyRequests: number; countRequests: number; maxOperationMs: number;
  oversizedSerializedBytes: number | null; oversizedByteLowerBound: number;
  unindexableLegacy: number | null; unindexableCurrent: number | null;
}
export interface Ledger {
  readonly lookupId: OpaqueId; readonly work: Work;
  readonly terminal: Stop | null;
  // Implementation owner reserves before request and charges on settlement (even missing/failure).
  reserve(kind: 'source' | 'membership' | 'metadata', maximumBytes: number): boolean;
  settle(actualPrefixBytes: number, stop: Stop | null): void;
}
export interface VerifiedProof {
  authority: Authority; admittedAt: UTC; configId: Hash;
  method: 'all-writer-revision' | 'coherent-range-and-sources';
}
export type RangeEnd = {
  participation: 'exhausted' | 'ten-witnesses';
  summary: 'exhausted' | 'tenth-assessment';
  coach: 'exhausted' | 'twentieth-run' | 'older-than-cutoff';
};
export type RangeProof<K extends keyof RangeEnd> =
  | { complete: false; stop: Stop }
  | { complete: true; stop: RangeEnd[K];
      // Full merged newest-first prefix, with every intervening candidate classified.
      orderedSourceIds: readonly string[]; authority: Authority };
export type Participation =
  | { state: 'unavailable'; reason: Reason; counted: null; ordinal: null; proof: null }
  | { state: 'pending'; reason: 'scan-incomplete'; counted: number; ordinal: null; proof: null }
  | { state: 'not-started' | 'in-progress'; reason: 'baseline-incomplete'; counted: number;
      ordinal: number; witnesses: readonly SourceRef[]; proof: VerifiedProof }
  | { state: 'complete'; reason: 'supported'; counted: 10; ordinal: null;
      witnesses: readonly SourceRef[]; proof: VerifiedProof };
export type Summary =
  | { state: 'pending'; reason: 'scan-incomplete'; value: null }
  | { state: 'unavailable' | 'not-complete'; reason: Reason; value: null }
  | { state: 'available'; selection: 'newest-ten-qualifying-assessments-v1';
      value: { medianWpm: number; medianAccuracy: number | null; validAccuracySources: number;
        sources: readonly SourceRef[]; timeRange: { from: UTC; to: UTC } }; proof: VerifiedProof };
export interface Contrast {
  targetCount: number; referenceCount: number; targetLogSum: number;
  referenceLogSum: number; sourceRuns: number;
}
export interface Focus extends Contrast {
  pair: string; promptContexts: number; wordContexts: number;
  halves: readonly [Contrast, Contrast]; certificateId: Hash;
}
export interface CertifiedPlan {
  adapterId: 'finite-practice-adapter-v1'; pair: string; catalogueId: Hash; bankHash: Hash;
  planHash: Hash; certificateId: Hash; characterCount: number; prompts: readonly Prompt[];
}
export type Coach =
  | { state: 'not-requested'; evidenceScanComplete: null; reason: 'coaching-deferred'; snapshot: null }
  | { state: 'pending'; evidenceScanComplete: false; reason: 'scan-incomplete'; snapshot: null }
  | { state: 'unavailable'; evidenceScanComplete: false | null; reason: Reason; snapshot: null }
  | { state: 'not-ready'; evidenceScanComplete: null; reason: 'baseline-incomplete'; snapshot: null }
  | { state: 'complete-insufficient'; evidenceScanComplete: true; reason: Reason; snapshot: null;
      sources: readonly SourceRef[]; proof: VerifiedProof }
  | { state: 'complete-ready'; evidenceScanComplete: true; reason: 'supported'; snapshot: PracticeSnapshot };
export interface PracticeSnapshot {
  schemaId: 'typeforge-practice-snapshot-v2'; policyId: 'clean-pair-contrast-v1-r2-enabled';
  configId: Hash; now: UTC; generation: number; capture: Capture;
  proof: VerifiedProof; witnesses: readonly SourceRef[]; sources: readonly SourceRef[];
  focus: Focus; plan: CertifiedPlan; actualExposure: null;
}
export type Persistence =
  | { state: 'idle'; pendingIds: readonly [] }
  | { state: 'pending' | 'failed'; pendingIds: readonly string[]; sourceId: string;
      capture: Capture | null; sourceSaved: false; membershipReady: false; retryable: boolean }
  | { state: 'saved'; pendingIds: readonly string[]; sourceId: string; sourceHash: Hash;
      sourceSaved: true; membershipReady: boolean };
export interface PendingSource {
  source: SavedSource; capture: Capture | null;
  state: 'pending' | 'failed' | 'rejected'; retryable: boolean; durablySaved: false;
}
export interface PreparedStatus {
  // UI projections: each is derived from its own proved component, never another flag.
  automaticCoaching: 'enabled' | 'disabled' | 'unavailable';
  baselineProofComplete: boolean; summarySelectionProofComplete: boolean;
  evidenceScanComplete: boolean | null; pendingSave: number;
  pendingSources: readonly PendingSource[];
  participation: Participation; summary: Summary; coach: Coach;
  persistence: Persistence; otherContextCount: null; work: Work;
}
export interface ProjectionInput {
  now: UTC; authority: Authority; sources: readonly SourceRead[];
  participationRange: RangeProof<'participation'>; summaryRange: RangeProof<'summary'>;
  coachRange: RangeProof<'coach'> | null;
  config: unknown; configId: Hash; generation: number; persistence: Persistence;
  pendingSources: readonly PendingSource[];
}
export interface PreparedProjection { status: PreparedStatus; candidate: PracticeSnapshot | null }
export interface AdmissionInput {
  candidate: PracticeSnapshot; currentAuthority: Authority; currentConfigId: Hash;
  currentGeneration: number; runState: 'idle' | 'running' | 'disposed';
  proof: VerifiedProof; // produced by the actual storage final barrier/revalidation, not UI
}
export type Admission = { admitted: true; snapshot: Readonly<PracticeSnapshot> }
  | { admitted: false; reason: 'authority-changed' | 'policy-invalid' | 'scan-incomplete' | 'started' };

// New source envelope; NEVER cast to SessionResult or passed to validateResult/selectHistory.
export interface FinitePracticeResult {
  schemaId: 'typeforge-finite-practice-result-v1'; id: string; owner: 'guest';
  completedAt: UTC; mode: 'practice'; metricVersion: 1;
  termination: 'plan-exhausted'; eligibleForProgress: false;
  settings: SessionResult['settings']; metrics: Metrics;
  qualityFlags: SessionResult['qualityFlags']; sentences: SentenceSummary[]; chartSamples: ChartSample[];
  plan: { configId: Hash; catalogueId: Hash; planHash: Hash; pair: string; sentenceCount: number };
}
export type SavedSource = SessionResult | FinitePracticeResult;
export interface FiniteAdapterSnapshot {
  terminal: 'idle' | 'running' | 'timeout' | 'plan-exhausted' | 'aborted' | 'stopped';
  engine: Omit<EngineSnapshot, 'state'> & { state: EngineSnapshot['state'] | 'plan-exhausted' };
  next: Prompt | null; completedSentences: number;
}
export interface FiniteAdapter {
  edit(edit: Edit, now: number): boolean;
  tick(now: number): FiniteAdapterSnapshot;
  interrupt(now: number): void;
  abort(now: number): void;
  result(completedAt: UTC): SavedSource | null;
  stoppedSnapshot(): StoppedSnapshot | null;
}

// Exact agreed seams; implementations are leased below and do not live in this file.
export declare function captureContext(signal?: AbortSignal): Promise<Capture | null>;
export declare function saveSource(source: SavedSource, capture: Capture | null): Promise<Persistence>;
export declare function getSavedSource(id: string): Promise<SavedSource | undefined>;
export declare function listSavedSourcesPage(input: { cursor: MergedCursor | null; ledger: Ledger;
  signal?: AbortSignal }): Promise<{ sources: readonly SourceRead[]; cursor: MergedCursor;
    complete: boolean; stop: Stop | 'exhausted' | 'slice'; work: Work }>;
export declare function deleteSource(id: string): Promise<void>;
export declare function resetEpoch(expectedDatabaseId: OpaqueId): Promise<Authority>;
export declare function readPolicySlice(input: { cursor: MergedCursor | null; ledger: Ledger;
  authority: Authority; signal?: AbortSignal }): Promise<{ sources: readonly SourceRead[];
    cursor: MergedCursor; complete: boolean; stop: Stop | 'exhausted' | 'slice'; work: Work }>;
export declare function preparePractice(input: { config: unknown; generation: number; now: UTC;
  persistence: Persistence; pendingSources: readonly PendingSource[]; signal?: AbortSignal }): Promise<PreparedStatus>;
export declare function derivePolicy(input: ProjectionInput): PreparedProjection;
export declare function validateMetadata(value: unknown): Metadata;
export declare function validateMembership(value: unknown, source: SourceRef, capture: Capture): Membership;
export declare function validateFinitePracticeResult(value: unknown, plan: CertifiedPlan): FinitePracticeResult;
export declare function admitPractice(input: AdmissionInput): Admission;
export declare function createFiniteAdapter(input: { id: string; snapshot: Readonly<PracticeSnapshot> }): FiniteAdapter;
