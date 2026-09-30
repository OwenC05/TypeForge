export const DURATION_MS = 60_000;
export const MAX_PROMPT_LENGTH = 300;
export const MAX_RESPONSE_LENGTH = 600;
export const MAX_SENTENCES = 120;
export const MAX_ATTEMPTS = 4096;

export type RunState = 'idle' | 'running' | 'completed' | 'aborted';
export type RunFlag = 'interrupted' | 'invalid-input';
export type SentenceFlag = RunFlag | 'incorrect' | 'edited' | 'repeat' |
  'missing-timing' | 'malformed-timing' | 'unsupported-layout' | 'unfinished';
export interface Prompt { id: string; text: string }
export interface KeyCounts {
  attempts: number; correct: number; firstAttempts: number; firstErrors: number;
}
export interface PairCounts { count: number; logSum: number }
export interface Metrics {
  elapsedMs: number;
  correctCharacters: number;
  attemptedCharacters: number;
  correctAttempts: number;
  accuracy: number | null;
  deletedCharacters: number;
  wpm: number;
}
export interface ChartSample { elapsedMs: number; wpm: number; accuracy: number | null }
export interface SentenceSummary {
  promptId: string;
  promptText: string;
  response: string;
  submitted: boolean;
  eligible: boolean;
  diagnosticsAvailable: boolean;
  qualityFlags: SentenceFlag[];
  keys: Record<string, KeyCounts>;
  pairs: Record<string, PairCounts>;
}
export interface SessionResult {
  id: string;
  owner: string;
  schemaVersion: 1;
  metricVersion: 1;
  completedAt: string;
  mode: 'assessment' | 'practice';
  settings: { durationMs: 60000; language: 'en'; qwerty: boolean; corpusVersion: string };
  qualityFlags: RunFlag[];
  eligibleForProgress: boolean;
  metrics: Metrics;
  sentences: SentenceSummary[];
  chartSamples: ChartSample[];
}
export interface EngineOptions {
  id: string;
  prompts: readonly Prompt[];
  owner?: string;
  mode?: 'assessment' | 'practice';
  corpusVersion?: string;
  qwerty?: boolean;
}
export interface Edit {
  start: number;
  end: number;
  text: string;
  pressTime?: number;
  repeat?: boolean;
  tracked?: boolean;
  composing?: boolean;
}
export interface EngineSnapshot {
  state: RunState;
  prompt: Prompt;
  value: string;
  sentenceIndex: number;
  elapsedMs: number;
  remainingMs: number;
  metrics: Metrics;
  qualityFlags: RunFlag[];
}

const matches = (value: string, target: string): number =>
  [...value].reduce((total, char, index) => total + Number(char === target[index]), 0);

/** Pure session state. Every timestamp uses the caller's monotonic clock. */
export class TypingEngine {
  private options: EngineOptions;
  private prompts: Prompt[];
  private runState: RunState = 'idle';
  private startedAt: number | null = null;
  private lastNow = 0;
  private elapsed = 0;
  private response = '';
  private submitted: SentenceSummary[] = [];
  private retained = 0;
  private attempted = 0;
  private correct = 0;
  private deleted = 0;
  private diagnostics = true;
  private flags = new Set<RunFlag>();
  private sentenceFlags = new Set<SentenceFlag>();
  private sentenceDiagnostics = true;
  private sentenceAttempted = 0;
  private seenPositions = new Set<number>();
  private keys: Record<string, KeyCounts> = {};
  private pairs: Record<string, PairCounts> = {};
  private previousPress: { char: string; time: number; index: number } | null = null;
  private chart: ChartSample[] = [];
  private assembled: SessionResult | null = null;

  constructor(options: EngineOptions) {
    if (!options.id || options.prompts.length === 0 || options.prompts.some(prompt =>
      !prompt.id || !prompt.text.trim() || prompt.text.length > MAX_PROMPT_LENGTH ||
      !/^[a-z ]+$/.test(prompt.text))) {
      throw new RangeError('Provide an ID and nonempty lowercase English prompts within the length limit.');
    }
    this.options = { ...options };
    this.prompts = options.prompts.map(prompt => ({ ...prompt }));
  }

  get state(): RunState { return this.runState; }
  get value(): string { return this.response; }
  get prompt(): Prompt { return { ...this.currentPrompt() }; }

  private currentPrompt(): Prompt {
    return this.prompts[this.submitted.length % this.prompts.length]!;
  }

  private metrics(): Metrics {
    const correctCharacters = this.retained + matches(this.response, this.currentPrompt().text);
    return {
      elapsedMs: this.elapsed,
      correctCharacters,
      attemptedCharacters: this.attempted,
      correctAttempts: this.correct,
      accuracy: this.diagnostics && this.attempted > 0 ? this.correct / this.attempted * 100 : null,
      deletedCharacters: this.deleted,
      wpm: this.elapsed > 0 ? correctCharacters * 12_000 / this.elapsed : 0,
    };
  }

  private sample(final = false): void {
    const previous = this.chart.at(-1)?.elapsedMs ?? 0;
    if (this.elapsed === previous || (!final && this.elapsed - previous < 1000)) return;
    const { elapsedMs, wpm, accuracy } = this.metrics();
    // ponytail: sample actual observations; delayed callbacks never invent historical points.
    this.chart.push({ elapsedMs, wpm, accuracy });
  }

  private advance(now: number): boolean {
    if (!Number.isFinite(now) || now < 0 || now < this.lastNow) {
      throw new RangeError('Session clock must be finite and monotonic.');
    }
    this.lastNow = now;
    if (this.runState === 'running') {
      this.elapsed = Math.min(now - this.startedAt!, DURATION_MS);
      if (this.elapsed >= DURATION_MS) {
        this.runState = 'completed';
        this.sample(true);
      } else {
        this.sample();
      }
    }
    return this.runState === 'idle' || this.runState === 'running';
  }

  tick(now: number): EngineSnapshot {
    this.advance(now);
    return {
      state: this.runState,
      prompt: this.prompt,
      value: this.response,
      sentenceIndex: this.submitted.length,
      elapsedMs: this.elapsed,
      remainingMs: DURATION_MS - this.elapsed,
      metrics: this.metrics(),
      qualityFlags: [...this.flags],
    };
  }

  snapshot(now: number): EngineSnapshot { return this.tick(now); }

  private invalidInput(): void {
    this.flags.add('invalid-input');
    this.sentenceFlags.add('invalid-input');
    this.diagnostics = false;
    this.sentenceDiagnostics = false;
    this.previousPress = null;
  }

  edit(edit: Edit, now: number): boolean {
    if (!this.advance(now)) return false;
    const { start, end, text } = edit;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 ||
      end < start || end > this.response.length) {
      throw new RangeError('Edit range must address the current response.');
    }
    const next = this.response.slice(0, start) + text + this.response.slice(end);
    if (next.length > MAX_RESPONSE_LENGTH || this.attempted + text.length > MAX_ATTEMPTS) {
      this.invalidInput();
      return false;
    }
    if (start === end && text.length === 0) {
      if (edit.tracked === false || edit.composing) this.invalidInput();
      return true;
    }
    if (this.runState === 'idle' && text.length > 0) {
      this.runState = 'running';
      this.startedAt = now;
    }
    if (edit.tracked === false || edit.composing || text.length > 1) this.invalidInput();
    if (start !== this.response.length || end > start) this.sentenceFlags.add('edited');
    if (edit.repeat) this.sentenceFlags.add('repeat');
    this.deleted += end - start;
    this.attempted += text.length;
    this.sentenceAttempted += text.length;
    const target = this.currentPrompt().text;
    for (let offset = 0; offset < text.length; offset++) {
      const index = start + offset;
      const expected = target[index];
      const correct = text[offset] === expected;
      this.correct += Number(correct);
      if (!correct) this.sentenceFlags.add('incorrect');
      if (expected !== undefined) {
        const key = this.keys[expected] ??= { attempts: 0, correct: 0, firstAttempts: 0, firstErrors: 0 };
        key.attempts++;
        key.correct += Number(correct);
        if (!this.seenPositions.has(index)) {
          key.firstAttempts++;
          key.firstErrors += Number(!correct);
          this.seenPositions.add(index);
        }
      }
    }
    const singleAppend = start === this.response.length && end === start && text.length === 1;
    if (singleAppend && !edit.repeat && edit.tracked !== false && !edit.composing && /^[a-z]$/.test(text)) {
      if (edit.pressTime === undefined) {
        this.sentenceFlags.add('missing-timing');
        this.previousPress = null;
      } else if (!Number.isFinite(edit.pressTime) || edit.pressTime < 0 || edit.pressTime > now) {
        this.sentenceFlags.add('malformed-timing');
        this.previousPress = null;
      } else {
        const previous = this.previousPress;
        if (previous && previous.index === start - 1) {
          const interval = edit.pressTime - previous.time;
          if (interval <= 0) this.sentenceFlags.add('malformed-timing');
          else if (interval <= 5000) {
            const pair = this.pairs[previous.char + text] ??= { count: 0, logSum: 0 };
            pair.count++;
            pair.logSum += Math.log(interval);
          }
        }
        this.previousPress = { char: text, time: edit.pressTime, index: start };
      }
    } else {
      this.previousPress = null;
    }
    this.response = next;
    return true;
  }

  private sentenceSummary(submitted: boolean): SentenceSummary {
    const qualityFlags = new Set(this.sentenceFlags);
    if (!submitted) qualityFlags.add('unfinished');
    if (!this.options.qwerty) qualityFlags.add('unsupported-layout');
    if (submitted && this.response !== this.currentPrompt().text) qualityFlags.add('incorrect');
    const eligible = submitted && qualityFlags.size === 0;
    return {
      promptId: this.currentPrompt().id,
      promptText: this.currentPrompt().text,
      response: this.response,
      submitted,
      eligible,
      diagnosticsAvailable: this.sentenceDiagnostics,
      qualityFlags: [...qualityFlags],
      keys: structuredClone(this.keys),
      pairs: eligible ? structuredClone(this.pairs) : {},
    };
  }

  submit(now: number): boolean {
    if (!this.advance(now) || this.runState !== 'running' || !this.response) return false;
    // Reserve the final bounded summary for the active response until the timer expires.
    if (this.submitted.length >= MAX_SENTENCES - 1) return false;
    const summary = this.sentenceSummary(true);
    this.retained += matches(this.response, this.currentPrompt().text);
    this.submitted.push(summary);
    this.response = '';
    this.sentenceFlags.clear();
    this.sentenceDiagnostics = true;
    this.sentenceAttempted = 0;
    this.seenPositions.clear();
    this.keys = {};
    this.pairs = {};
    this.previousPress = null;
    return true;
  }

  interrupt(now: number): void {
    if (!this.advance(now) || this.runState !== 'running') return;
    this.flags.add('interrupted');
    this.sentenceFlags.add('interrupted');
    this.previousPress = null;
  }

  abort(now: number): void {
    if (this.advance(now)) this.runState = 'aborted';
  }

  restart(id: string): void {
    if (!id || id === this.options.id) throw new RangeError('Restart requires a fresh session ID.');
    this.options = { ...this.options, id };
    this.runState = 'idle';
    this.startedAt = null;
    this.elapsed = 0;
    this.response = '';
    this.submitted = [];
    this.retained = this.attempted = this.correct = this.deleted = 0;
    this.diagnostics = this.sentenceDiagnostics = true;
    this.flags.clear();
    this.sentenceFlags.clear();
    this.sentenceAttempted = 0;
    this.seenPositions.clear();
    this.keys = {};
    this.pairs = {};
    this.previousPress = null;
    this.chart = [];
    this.assembled = null;
  }

  result(completedAt: string): SessionResult | null {
    if (this.runState !== 'completed') return null;
    if (!this.assembled) {
      if (!Number.isFinite(Date.parse(completedAt))) throw new RangeError('Completion time must be an ISO date.');
      this.assembled = {
        id: this.options.id,
        owner: this.options.owner ?? 'guest',
        schemaVersion: 1,
        metricVersion: 1,
        completedAt: new Date(completedAt).toISOString(),
        mode: this.options.mode ?? 'assessment',
        settings: {
          durationMs: DURATION_MS,
          language: 'en',
          qwerty: this.options.qwerty ?? false,
          corpusVersion: this.options.corpusVersion ?? 'original-v1',
        },
        qualityFlags: [...this.flags],
        eligibleForProgress: this.flags.size === 0,
        metrics: this.metrics(),
        sentences: [...this.submitted, ...(this.response || this.sentenceAttempted > 0 ? [this.sentenceSummary(false)] : [])],
        chartSamples: this.chart,
      };
    }
    return structuredClone(this.assembled);
  }
}
