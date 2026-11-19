// Session-level recovery for completed sources whose save has not been confirmed (review ET-1).
// Continuing (Again, a result-state setting, an assessment link) never waits on persistence and
// never drops a payload: each immutable completed source (a timed result or a finite practice
// record) stays listed with its original capture until it is saved in this browser or the person
// explicitly discards it. The list is ordered oldest first, never merged and never capped; every
// entry keeps its own single-flight save. The list is document-scoped and in memory only: it does
// not survive leaving the page (no new response persistence is added).
import type { SessionResult } from './engine.ts';
import type { Capture, PendingSource, Persistence, SavedSource } from './coach-types.ts';

export type UnsavedState = 'pending' | 'failed' | 'rejected' | 'saved';
/** One completed source. Its own save mutates `state`/`saving`; `source` and `capture` are never re-derived. */
export interface SaveRecord {
  readonly source: SavedSource;
  /** The capture taken before the run's first insertion; every retry reuses it, never a new one. */
  readonly capture: Capture | null;
  /** Frozen when the run started: the counted baseline test's ordinal, or null. Late saves never change it. */
  readonly test: number | null;
  /** The run was a counted baseline attempt when it started (it can still fail to qualify). */
  readonly baseline: boolean;
  state: UnsavedState;
  saving: boolean;
  exported: boolean;
  reason: string;
  /** Last outcome of the fenced save: source saved and membership ready stay distinct. */
  persistence: Persistence | null;
  onSettled: (() => void) | null;
}
export interface UnsavedDeps {
  /** The fenced source save. Content/hash and membership reconciliation happen inside it; it reports, never throws. */
  save(source: SavedSource, capture: Capture | null): Promise<Persistence>;
  onChange(): void;
}

export const rejectedReason = 'It failed validation and cannot be saved here; export it instead.';

export function newSaveRecord(source: SavedSource, capture: Capture | null = null, run: { test?: number | null; baseline?: boolean } = {}): SaveRecord {
  return { source, capture, test: run.test ?? null, baseline: run.baseline ?? false, state: 'pending', saving: false, exported: false,
    reason: '', persistence: null, onSettled: null };
}

/** Classify one fenced save outcome onto its own record. A missing outcome (an unexpected throw) is retryable. */
export function applyOutcome(record: SaveRecord, outcome: Persistence | null): void {
  record.persistence = outcome;
  if (outcome?.state === 'saved' && outcome.sourceId === record.source.id) { record.state = 'saved'; return; }
  const permanent = outcome?.state === 'failed' && !outcome.retryable;
  record.state = permanent ? 'rejected' : 'failed';
  if (permanent) record.reason = rejectedReason;
}

export class UnsavedResults {
  private readonly entries: SaveRecord[] = [];
  private readonly deps: UnsavedDeps;
  constructor(deps: UnsavedDeps) { this.deps = deps; }

  /** Keep a completed block's record when the person continues past it. Saved records are not kept. */
  adopt(record: SaveRecord | null): void {
    if (!record || record.state === 'saved' || this.entries.includes(record)) return;
    if (this.entries.some(entry => entry.source.id === record.source.id)) return;
    this.entries.push(record);
    record.onSettled = () => this.changed();
    this.changed();
  }

  /** Entries that need the person: failed or refused. Pending ones appear only if they fail. */
  get listed(): readonly SaveRecord[] { return this.entries.filter(entry => entry.state === 'failed' || entry.state === 'rejected'); }
  /** Every entry not yet saved, including pending ones (for the page-departure guard). */
  get unsaved(): readonly SaveRecord[] { return this.entries.filter(entry => entry.state !== 'saved'); }
  get retrying(): boolean { return this.entries.some(entry => entry.saving); }

  /** Unsaved sources with their original capture, for a preparation's pending projection only. */
  pendingSources(extra: SaveRecord | null = null): PendingSource[] {
    return this.atRisk(extra).map(entry => ({ source: entry.source, capture: entry.capture,
      state: entry.state === 'rejected' ? 'rejected' as const : entry.state === 'failed' ? 'failed' as const : 'pending' as const,
      retryable: entry.state !== 'rejected', durablySaved: false as const }));
  }

  /** Sequential, oldest first; single-flight per entry; stops at the first permanent refusal. */
  async retry(): Promise<void> {
    const queue = this.listed.filter(entry => entry.state === 'failed' && !entry.saving);
    if (!queue.length) return;
    for (const entry of queue) entry.saving = true;
    this.changed();
    try {
      for (let index = 0; index < queue.length; index++) {
        const entry = queue[index]!;
        try {
          // Always the original capture. An identical stored copy reconciles as saved inside the fence;
          // a different stored copy under the same id is refused there, never overwritten or assumed.
          let outcome: Persistence | null = null;
          try { outcome = await this.deps.save(entry.source, entry.capture); } catch { outcome = null; }
          applyOutcome(entry, outcome);
          if (entry.state === 'rejected') {
            for (const rest of queue.slice(index + 1)) rest.saving = false; // not attempted: retryable again
            break;
          }
        } finally {
          entry.saving = false;
          this.changed();
        }
      }
    } finally {
      // Safety net: any flag still set (an unexpected throw) is cleared and announced.
      const stuck = queue.filter(entry => entry.saving);
      for (const entry of stuck) entry.saving = false;
      if (stuck.length) this.changed();
    }
  }

  /** All listed payloads, unchanged, oldest first. */
  exportPayload(): SavedSource[] { return this.listed.map(entry => entry.source); }
  markExported(): void { for (const entry of this.listed) entry.exported = true; this.changed(); }

  /** Explicit discard: removes exactly the listed entries; pending saves stay tracked. */
  discard(): number {
    const listed = new Set(this.listed);
    let removed = 0;
    for (let index = this.entries.length - 1; index >= 0; index--) {
      if (listed.has(this.entries[index]!)) { this.entries[index]!.onSettled = null; this.entries.splice(index, 1); removed++; }
    }
    this.changed();
    return removed;
  }

  private changed(): void {
    for (let index = this.entries.length - 1; index >= 0; index--) if (this.entries[index]!.state === 'saved') this.entries.splice(index, 1);
    this.deps.onChange();
  }
  /** Entries a page departure would lose: this list plus the current block's record if unsaved. */
  atRisk(extra: SaveRecord | null = null): SaveRecord[] {
    return [...this.unsaved, ...(extra && extra.state !== 'saved' && !this.entries.includes(extra) ? [extra] : [])];
  }
}

export const isFiniteSource = (source: SavedSource): source is Exclude<SavedSource, SessionResult> => 'schemaId' in source;
/** The existing per-result export (timed results, unchanged) when every source is timed; otherwise C's
 *  separately named mixed-source envelope with the original sources and no authority metadata. */
export function exportDocument(sources: readonly SavedSource[]): SessionResult[] | { schemaId: 'typeforge-saved-sources-export-v1'; sources: SavedSource[] } {
  if (!sources.some(isFiniteSource)) return sources as SessionResult[];
  return { schemaId: 'typeforge-saved-sources-export-v1', sources: [...sources] };
}

/** Line copy for the reserved slot: one line, highest priority. */
export function unsavedLine(list: readonly SaveRecord[], retrying: boolean, leaving = false): string {
  if (!list.length) return '';
  if (leaving) return `${list.length} result${list.length === 1 ? '' : 's'} not saved. Leaving this page loses ${list.length === 1 ? 'it' : 'them'}${list.every(entry => entry.exported) ? ' (exported copies are yours to keep)' : ''}.`;
  // A baseline test that isn't saved doesn't count: said plainly, only when every listed entry is one.
  const tests = list.every(entry => entry.baseline && entry.state === 'failed');
  const count = !tests ? `${list.length} result${list.length === 1 ? '' : 's'} not saved`
    : list.length === 1 ? `${list[0]!.test ? `Test ${list[0]!.test}` : 'Your last test'} isn’t saved yet, so it doesn’t count`
      : `${list.length} tests aren’t saved yet, so they don’t count`;
  const rejected = list.filter(entry => entry.state === 'rejected').length;
  const parts = [count];
  if (retrying) parts.push('saving…');
  else if (list.every(entry => entry.exported)) parts.push('exported');
  if (rejected) parts.push(`${rejected} failed validation; export only`);
  return parts.join(' · ');
}
