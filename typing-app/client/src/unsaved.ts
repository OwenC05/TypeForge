// Page-scoped recovery for completed results. Each retry uses the original payload.
import type { SessionResult } from './engine.ts';
import type { Persistence } from './storage.ts';

export type UnsavedState = 'pending' | 'failed' | 'rejected' | 'saved';
export interface SaveRecord {
  readonly source: SessionResult;
  state: UnsavedState;
  saving: boolean;
  exported: boolean;
  reason: string;
  onSettled: (() => void) | null;
}
export interface UnsavedDeps {
  save(source: SessionResult): Promise<Persistence>;
  onChange(): void;
}

export const rejectedReason = 'It failed validation and cannot be saved here; export it instead.';

export function newSaveRecord(source: SessionResult): SaveRecord {
  return { source, state: 'pending', saving: false, exported: false, reason: '', onSettled: null };
}

/** Classify a save outcome on its original record. A missing outcome (an unexpected throw) is retryable. */
export function applyOutcome(record: SaveRecord, outcome: Persistence | null): void {
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
          // A same-ID retry checks the original payload inside the storage transaction.
          let outcome: Persistence | null = null;
          try { outcome = await this.deps.save(entry.source); } catch { outcome = null; }
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
  exportPayload(): SessionResult[] { return this.listed.map(entry => entry.source); }
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

/** Line copy for the reserved slot: one line, highest priority. */
export function unsavedLine(list: readonly SaveRecord[], retrying: boolean, leaving = false): string {
  if (!list.length) return '';
  if (leaving) return `${list.length} result${list.length === 1 ? '' : 's'} not saved. Leaving this page loses ${list.length === 1 ? 'it' : 'them'}${list.every(entry => entry.exported) ? ' (exported copies are yours to keep)' : ''}.`;
  const count = `${list.length} result${list.length === 1 ? '' : 's'} not saved`;
  const rejected = list.filter(entry => entry.state === 'rejected').length;
  const parts = [count];
  if (retrying) parts.push('saving…');
  else if (list.every(entry => entry.exported)) parts.push('exported');
  if (rejected) parts.push(`${rejected} failed validation; export only`);
  return parts.join(' · ');
}
