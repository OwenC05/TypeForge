// Session-level recovery for completed results whose save has not been confirmed (review ET-1).
// Continuing (Again, a result-state setting, an assessment link) never waits on persistence and
// never drops a payload: each immutable completed result stays listed until it is saved in this
// browser or the person explicitly discards it. The list is ordered oldest first, never merged and
// never capped; every entry keeps its own single-flight save. The list is document-scoped and
// in memory only: it does not survive leaving the page (no new response persistence is added).
import type { SessionResult } from './engine.ts';

export type UnsavedState = 'pending' | 'failed' | 'rejected' | 'saved';
/** One completed result. The block's own save mutates `state`/`saving`; `result` is never re-derived. */
export interface SaveRecord {
  readonly result: SessionResult;
  state: UnsavedState;
  saving: boolean;
  exported: boolean;
  reason: string;
  onSettled: (() => void) | null;
}
export interface UnsavedDeps {
  save(result: SessionResult): Promise<void>;
  /** Whether a result with this id is already stored (a write that landed before its error surfaced). */
  exists(id: string): Promise<boolean>;
  isPermanent(error: unknown): boolean;
  onChange(): void;
}

export function newSaveRecord(result: SessionResult): SaveRecord {
  return { result, state: 'pending', saving: false, exported: false, reason: '', onSettled: null };
}

export class UnsavedResults {
  private readonly entries: SaveRecord[] = [];
  private readonly deps: UnsavedDeps;
  constructor(deps: UnsavedDeps) { this.deps = deps; }

  /** Keep a completed block's record when the person continues past it. Saved records are not kept. */
  adopt(record: SaveRecord | null): void {
    if (!record || record.state === 'saved' || this.entries.includes(record)) return;
    if (this.entries.some(entry => entry.result.id === record.result.id)) return;
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
          await this.deps.save(entry.result);
          entry.state = 'saved';
        } catch (error) {
          // A write that landed before its error surfaced is already saved; never write it twice.
          let stored = false;
          try { stored = await this.deps.exists(entry.result.id); } catch { stored = false; }
          if (stored) entry.state = 'saved';
          else if (this.deps.isPermanent(error)) {
            entry.state = 'rejected';
            entry.reason = 'It failed validation and cannot be saved here; export it instead.';
            break;
          } else entry.state = 'failed';
        } finally {
          entry.saving = false;
          this.changed();
        }
      }
    } finally {
      for (const entry of queue) entry.saving = false;
    }
  }

  /** All listed payloads, unchanged, in one file (an array of the existing per-result export format). */
  exportPayload(): SessionResult[] { return this.listed.map(entry => entry.result); }
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
