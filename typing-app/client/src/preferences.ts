import { SUPPORTED_DURATIONS } from './engine.ts';

// Remembered settings live in their own versioned localStorage record, never in the results
// database. Reused from prototype B (5e763aa) after review; fieldwise validation is unchanged.
export const PREFERENCES_KEY = 'typeforge-preferences';
export type RememberedKind = 'general' | 'recommended' | 'manual';
export type PreferenceBucket = { durationSeconds?: number; qwerty?: boolean; kind?: RememberedKind; pair?: string };
export type Preferences = { stored: boolean; practice: PreferenceBucket; assessment: PreferenceBucket };
type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const PRACTICE_DEFAULT_SECONDS = 30;

function browserStore(): KeyValueStore | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function bucket(value: unknown, practice: boolean): PreferenceBucket {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const valid: PreferenceBucket = {};
  if (SUPPORTED_DURATIONS.some(duration => duration / 1000 === source.durationSeconds)) valid.durationSeconds = source.durationSeconds as number;
  if (typeof source.qwerty === 'boolean') valid.qwerty = source.qwerty;
  if (practice && (source.kind === 'general' || source.kind === 'recommended' || source.kind === 'manual')) valid.kind = source.kind;
  if (practice && typeof source.pair === 'string' && /^[a-z]{2}$/.test(source.pair)) valid.pair = source.pair;
  return valid;
}

export function parsePreferences(text: string | null): Preferences {
  const empty: Preferences = {stored: false, practice: {}, assessment: {}};
  if (!text) return empty;
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return empty; }
  if (!raw || typeof raw !== 'object' || (raw as {version?: unknown}).version !== 1) return empty;
  const record = raw as {practice?: unknown; assessment?: unknown};
  return {stored: true, practice: bucket(record.practice, true), assessment: bucket(record.assessment, false)};
}

export function loadPreferences(store: KeyValueStore | null = browserStore()): Preferences {
  try { return parsePreferences(store?.getItem(PREFERENCES_KEY) ?? null); }
  catch { return parsePreferences(null); } // Blocked storage never blocks typing.
}

export function savePreferences(mode: 'practice' | 'assessment', next: PreferenceBucket, store: KeyValueStore | null = browserStore()): boolean {
  const current = loadPreferences(store);
  const record = {version: 1, practice: mode === 'practice' ? next : current.practice, assessment: mode === 'assessment' ? next : current.assessment};
  try { store?.setItem(PREFERENCES_KEY, JSON.stringify(record)); return Boolean(store); }
  catch { return false; }
}

export function clearPreferences(store: KeyValueStore | null = browserStore()) {
  try { store?.removeItem(PREFERENCES_KEY); } catch { /* nothing to clear */ }
}

// Explicit URL value, then lineage origin (from/retest links keep their inheritance untouched),
// then the remembered value, then the default. Practice defaults to 30 s; assessment keeps 60 s.
export function withRemembered(requested: URLSearchParams, mode: 'practice' | 'assessment', preferences: Preferences) {
  const effective = new URLSearchParams(requested);
  if (requested.has('from') || requested.has('retest')) return effective;
  const remembered = preferences[mode];
  if (!effective.has('duration')) {
    if (remembered.durationSeconds) effective.set('duration', String(remembered.durationSeconds));
    else if (mode === 'practice') effective.set('duration', String(PRACTICE_DEFAULT_SECONDS));
  }
  if (!effective.has('qwerty') && remembered.qwerty !== undefined) effective.set('qwerty', remembered.qwerty ? '1' : '0');
  if (mode === 'practice' && !effective.has('practice') && remembered.kind) {
    effective.set('practice', remembered.kind);
    if (remembered.kind === 'manual' && remembered.pair && !effective.has('pair')) effective.set('pair', remembered.pair);
  }
  return effective;
}
