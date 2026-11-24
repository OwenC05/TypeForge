import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assessmentPrompts, practicePrompts } from '../src/corpus.ts';
import { TypingEngine, type Prompt, type SessionResult } from '../src/engine.ts';
import { validateResult } from '../src/storage.ts';
import { createFiniteAdapter } from '../src/finite-practice.ts';
import { validateFinitePracticeResult } from '../src/finite-practice-result.ts';
import { COACH_CONFIG, CONFIG_ID } from '../src/coach-plan.ts';
import { derivePolicy, admitPractice, qualifiesPolicySource, validateMetadata, validateMembership } from '../src/coach-policy.ts';
import type { Capture, PendingSource, ProjectionInput, SavedSource, SourceRead, SourceRef, VerifiedProof } from '../src/coach-types.ts';

const NOW = '2026-11-16T12:00:00.000Z', AGE = 30 * 86400000;
const canonical = (v: unknown): string => v === null || typeof v !== 'object' ? JSON.stringify(v)
  : Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
    : `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
const hash = (v: unknown) => createHash('sha256').update(canonical(v)).digest('hex');
const id = (i: number) => `00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`;
function shuffled(seed: number): Prompt[] {
  const prompts = [...assessmentPrompts]; let state = seed >>> 0;
  for (let i=prompts.length-1;i>0;i--) {
    state ^= state<<13; state ^= state>>>17; state ^= state<<5;
    const j = (state>>>0)%(i+1); [prompts[i],prompts[j]]=[prompts[j],prompts[i]];
  }
  return prompts;
}
function run(index: number, targetMs = 250, options: { prompts?: Prompt[]; oneKey?: boolean; mode?: 'assessment'|'practice'; otherMs?: number } = {}): SessionResult {
  const other = options.otherMs ?? 200;
  const engine = new TypingEngine({ id: id(index), prompts: options.prompts ?? shuffled(1001+index),
    inputMode: 'flow-v1', durationMs: 30000, qwerty: true, corpusVersion: '1', mode: options.mode ?? 'assessment' });
  let time = 0;
  do {
    const pos = engine.value.length, text = engine.prompt.text;
    const char = pos === text.length ? ' ' : text[pos];
    const pair = pos > 0 && pos < text.length ? text.slice(pos-1,pos+1) : '';
    const delay = pair === 'he' ? targetMs : other;
    if (time+delay >= 30000 && engine.state !== 'idle') break;
    time += delay; engine.edit({ start: pos, end: pos, text: options.oneKey ? 'x' : char, pressTime: time },time);
    if (options.oneKey) break;
  } while (engine.state === 'running');
  engine.tick(30000+other);
  const result = engine.result(new Date(Date.UTC(2026,10,16,10,index)).toISOString())!;
  assert.ok(result); validateResult(result); return result;
}
const connected = (ms = 250) => Array.from({length:10},(_,i)=>run(i,ms));
const oneKeys = (n = 10) => Array.from({length:n},(_,i)=>run(i,250,{oneKey:true}));
function inputFor(sources: readonly SavedSource[]): ProjectionInput {
  const authority = { databaseId:'database', contextId:'context', epochId:'epoch', revision:3 };
  const capture: Capture = { databaseId:'database', contextId:'context', epochId:'epoch', capturedAt:'2026-11-16T09:00:00.000Z', purpose:'ordinary' };
  const reads: SourceRead[] = sources.map(source => {
    const ref: SourceRef = { partition:'current', kind:'schemaId' in source ? 'finite-practice-v1' : 'timed-v1',
      id:source.id, completedAt:source.completedAt, sha256:hash(source) };
    return { source:structuredClone(source), ref, membership:{ ...capture, schemaId:'typeforge-coach-membership-v2',
      sourceKind:ref.kind, resultId:ref.id, resultSha256:ref.sha256 } };
  });
  const ids = [...new Map(reads.map(r=>[r.ref.id,r])).values()].sort((a,b)=>
    a.ref.completedAt < b.ref.completedAt ? 1 : a.ref.completedAt > b.ref.completedAt ? -1 : a.ref.id < b.ref.id ? 1 : -1).map(r=>r.ref.id);
  const range = { complete:true as const, stop:'exhausted' as const, orderedSourceIds:ids, authority };
  const input: ProjectionInput = { now:NOW, metadata:{ schemaId:'typeforge-coach-metadata-v3', databaseId:'database',
    defaultContextId:'context', activeEpochId:'epoch', legacyEpochId:'epoch', legacyCutoffCompletedAt:NOW, sourceRevision:3 },
    authority, sources:reads, finalProof:null, participationRange:structuredClone(range), summaryRange:structuredClone(range),
    coachRange:structuredClone(range), config:structuredClone(COACH_CONFIG), configId:CONFIG_ID, generation:7,
    persistence:{state:'idle',pendingIds:[]}, pendingSources:[], work:{ examinedRows:29, examinedBytes:48123, slices:2,
      keyRequests:22, countRequests:4, maxOperationMs:2.5, oversizedSerializedBytes:null, oversizedByteLowerBound:0,
      unindexableLegacy:null, unindexableCurrent:0 } };
  return prove(input);
}
// Explicit in-memory stand-in for C's successful completion. This is never an IDB proof test.
function prove(input: ProjectionInput): ProjectionInput {
  input.finalProof = { authority:structuredClone(input.authority), admittedAt:NOW, configId:CONFIG_ID, method:'all-writer-revision',
    selection:structuredClone({ metadata:input.metadata, now:input.now,
      sourceBindings:input.sources.map(({ref,membership})=>({ref,membership})),
      participationRange:input.participationRange, summaryRange:input.summaryRange, coachRange:input.coachRange }) };
  return input;
}
function ready(sources: readonly SavedSource[] = connected()) {
  const input=inputFor(sources), output=derivePolicy(input);
  assert.equal(output.status.coach.state,'complete-ready'); assert.ok(output.candidate);
  return {input,output,snapshot:output.candidate};
}

test('shared source classification uses only metadata/now before proof without publishing authority',()=>{
  const input=inputFor(oneKeys(1));input.finalProof=null;
  const context:Pick<ProjectionInput,'metadata'|'now'>={metadata:input.metadata,now:input.now};
  const before=canonical(input);
  assert.equal(qualifiesPolicySource(input.sources[0],context),true);
  assert.equal(qualifiesPolicySource(input.sources[0],context,true),true);
  assert.equal(canonical(input),before);
  const projection=derivePolicy(input);
  assert.equal(projection.status.participation.state,'pending');
  assert.equal(projection.status.participation.counted,0);
  assert.equal(projection.status.summary.value,null);assert.equal(projection.candidate,null);
  const practice=inputFor([run(20,250,{oneKey:true,mode:'practice'})]);
  const practiceContext={metadata:practice.metadata,now:practice.now};
  assert.equal(qualifiesPolicySource(practice.sources[0],practiceContext),true);
  assert.equal(qualifiesPolicySource(practice.sources[0],practiceContext,false),true);
  assert.equal(qualifiesPolicySource(practice.sources[0],practiceContext,true),false);
});

test('shared classification retains physical legacy and current captured-context semantics',()=>{
  const input=inputFor(oneKeys(1)), read=input.sources[0];
  const context={metadata:input.metadata,now:input.now};
  const legacy:SourceRead={...read,ref:{...read.ref,partition:'legacy'},membership:null};
  assert.equal(qualifiesPolicySource(legacy,context,true),true);
  assert.equal(qualifiesPolicySource(legacy,{...context,metadata:{...context.metadata,legacyEpochId:'old'}},true),false);
  assert.equal(qualifiesPolicySource(legacy,{...context,metadata:{...context.metadata,
    legacyCutoffCompletedAt:'2026-11-16T09:59:59.999Z'}},true),false);
  assert.equal(qualifiesPolicySource({...read,membership:null},context,true),false);
  assert.ok(read.membership);
  for(const patch of [{databaseId:'other'},{contextId:'other'},{epochId:'old'},{purpose:'protected-probe' as const}])
    assert.equal(qualifiesPolicySource({...read,membership:{...read.membership,...patch}},context,true),false);
  assert.equal(qualifiesPolicySource(read,{...context,metadata:{...context.metadata,activeEpochId:'reset'}},true),false);
  assert.equal(qualifiesPolicySource(read,{...context,now:'2026-11-16T09:59:59.999Z'},true),false);
});

test('metadata strict shape/calendar/IDs/revision, with readable terminal MAX',()=>{
  const m=inputFor([]).metadata;
  assert.equal(validateMetadata(m),m);
  assert.equal(validateMetadata({...m,sourceRevision:Number.MAX_SAFE_INTEGER}).sourceRevision,Number.MAX_SAFE_INTEGER);
  for (const patch of [{extra:1},{sourceRevision:-1},{sourceRevision:1.1},{sourceRevision:Number.MAX_SAFE_INTEGER+1},
    {databaseId:''},{activeEpochId:'x'.repeat(129)},{legacyCutoffCompletedAt:'2026-02-30T12:00:00.000Z'},
    {legacyCutoffCompletedAt:'2026-11-16T12:00:00Z'},{schemaId:'v2'}]) assert.throws(()=>validateMetadata({...m,...patch}));
  const missing: Partial<typeof m>={...m}; delete missing.legacyEpochId; assert.throws(()=>validateMetadata(missing));
});

test('membership strict capture/ref/source kind/hash semantics, never legacy fallback',()=>{
  const {ref,membership:m}=inputFor(oneKeys(1)).sources[0]; assert.ok(m);
  const {schemaId:_,sourceKind:__,resultId:___,resultSha256:____,...capture}=m;
  assert.equal(validateMembership(m,ref,capture),m);
  for(const patch of [{extra:1},{resultId:id(99)},{resultSha256:'A'.repeat(64)}, {sourceKind:'finite-practice-v1'},
    {purpose:'protected-probe'},{databaseId:'different'},{contextId:'different'}, {epochId:'different'},
    {capturedAt:'2026-02-30T12:00:00.000Z'}]) assert.throws(()=>validateMembership({...m,...patch},ref,capture));
  assert.throws(()=>validateMembership(m,{...ref,partition:'legacy'},capture));
});

test('connected actual-engine he witness yields exact reviewed support, halves and certified snapshot',()=>{
  const {input,output,snapshot}=ready();
  assert.deepEqual([snapshot.focus.targetCount,snapshot.focus.referenceCount,snapshot.focus.sourceRuns,
    snapshot.focus.promptContexts,snapshot.focus.wordContexts],[28,543,10,19,4]);
  assert.deepEqual(snapshot.focus.halves.map(h=>[h.targetCount,h.referenceCount,h.sourceRuns]),[[10,234,5],[18,309,5]]);
  assert.equal(snapshot.plan.characterCount,501); assert.equal(snapshot.focus.certificateId,snapshot.plan.certificateId);
  assert.equal(snapshot.proof,input.finalProof); assert.equal(output.status.participation.proof,input.finalProof);
  assert.equal(output.status.summary.state,'available');
  if(output.status.summary.state==='available') assert.equal(output.status.summary.proof,input.finalProof);
  assert.equal(output.status.work,input.work); assert.equal(output.status.work.examinedRows,29);
  assert.ok(Object.isFrozen(snapshot.proof.selection.sourceBindings[0].membership));
  assert.throws(()=>{snapshot.focus.halves[0].targetCount++;});
  assert.equal(snapshot.actualExposure,null);
});

test('full contrast exact boundary below/at/above and uniform no-target use whole engine histories',()=>{
  for(const [ms,supported] of [[249.999999,false],[250,true],[250.000001,true]] as const)
    assert.equal(derivePolicy(inputFor(connected(ms))).candidate!==null,supported,`${ms}`);
  const uniform=derivePolicy(inputFor(connected(200)));
  assert.equal(uniform.candidate,null); assert.equal(uniform.status.coach.reason,'no-effect');
});

test('permuted delivery and pair insertion ordering cannot change deterministic selected evidence',()=>{
  const sources=connected();
  const a=ready(sources).snapshot;
  sources.reverse().forEach(r=>r.sentences.forEach(s=>{s.pairs=Object.fromEntries(Object.entries(s.pairs).reverse());}));
  const b=ready(sources).snapshot;
  assert.deepEqual(b.focus,a.focus); assert.deepEqual(b.sources,a.sources); assert.deepEqual(b.witnesses,a.witnesses);
});

test('null final proof cannot fabricate a current count, median or focus; coach null differs from false',()=>{
  for(const requested of [false,true]) {
    const input=inputFor(connected()); input.finalProof=null; if(!requested)input.coachRange=null;
    const p=derivePolicy(input); assert.equal(p.candidate,null);
    assert.deepEqual(p.status.participation,{state:'pending',reason:'scan-incomplete',counted:0,ordinal:null,proof:null});
    assert.equal(p.status.summary.value,null); assert.equal(p.status.evidenceScanComplete,requested?false:null);
    assert.equal(p.status.baselineProofComplete,false); assert.equal(p.status.work,input.work);
  }
});

test('all immutable proof-selection and source bindings reject substitution',()=>{
  const patches: ((i:ProjectionInput)=>void)[]=[
    i=>{i.finalProof!.method='bogus' as VerifiedProof['method'];},
    i=>{i.finalProof!.authority.revision++;}, i=>{i.finalProof!.admittedAt='2026-02-30T12:00:00.000Z';},
    i=>{i.finalProof!.selection.sourceBindings[0].ref.sha256='0'.repeat(64);},
    i=>{i.finalProof!.selection.sourceBindings[0].membership!.purpose='protected-probe';},
    i=>{i.finalProof!.selection.metadata.legacyCutoffCompletedAt='2026-11-15T12:00:00.000Z';},
    i=>{i.finalProof!.selection.now='2026-11-16T11:59:00.000Z';},
    i=>{i.finalProof!.selection.coachRange=null;},
    i=>{i.summaryRange={complete:false,stop:'row-budget'};},
    i=>{i.sources[0].source.metrics.wpm=999;},
    i=>{i.sources[0].ref.id=id(999);}, i=>{i.sources[0].ref.kind='finite-practice-v1';},
    i=>{i.sources[0].ref.completedAt='2026-11-16T11:59:00.000Z';},
  ];
  for(const patch of patches) {const i=inputFor(connected());patch(i);const p=derivePolicy(i);
    assert.equal(p.candidate,null);assert.equal(p.status.participation.state,'unavailable');assert.equal(p.status.summary.value,null);}
  const wrongRange=inputFor(connected());
  if(wrongRange.summaryRange.complete)wrongRange.summaryRange.authority.revision++;
  prove(wrongRange);assert.equal(derivePolicy(wrongRange).status.participation.state,'unavailable');
});

test('physical legacy initial epoch and cutoff are required; missing current membership never becomes legacy',()=>{
  for(const [epoch,cutoff,expected] of [['epoch',NOW,10],['older',NOW,0],['epoch','2026-11-16T09:00:00.000Z',0]] as const) {
    const i=inputFor(oneKeys());i.sources=i.sources.map(r=>({...r,ref:{...r.ref,partition:'legacy'},membership:null}));
    i.metadata.legacyEpochId=epoch;i.metadata.legacyCutoffCompletedAt=cutoff;prove(i);
    assert.equal(derivePolicy(i).status.participation.counted,expected);
  }
  const current=inputFor(oneKeys()); current.sources=current.sources.map(r=>({...r,membership:null}));prove(current);
  assert.equal(derivePolicy(current).status.participation.counted,0);
  const reset=inputFor(oneKeys());reset.metadata.activeEpochId='new';reset.authority.epochId='new';
  for(const range of [reset.participationRange,reset.summaryRange,reset.coachRange])if(range?.complete)range.authority.epochId='new';
  prove(reset);assert.equal(derivePolicy(reset).status.participation.counted,0);
});

test('capped participation 0/1/9/10/11 and rolling newest-ten summary have independent proofs',()=>{
  for(const n of [0,1,9,10,11]) {
    const p=derivePolicy(inputFor(oneKeys(n)));
    assert.equal(p.status.participation.counted,Math.min(n,10));assert.equal(p.status.baselineProofComplete,true);
    assert.equal(p.status.summary.state,n>=10?'available':'not-complete');
    assert.equal(p.status.participation.ordinal,n<10?n+1:null);
  }
  const i=inputFor(oneKeys(11));i.summaryRange={complete:false,stop:'byte-budget'};prove(i);
  const p=derivePolicy(i);assert.equal(p.status.participation.state,'complete');assert.equal(p.status.summary.state,'pending');
  assert.equal(p.status.summarySelectionProofComplete,false);
  const newest=derivePolicy(inputFor(oneKeys(11))).status.summary;
  assert.equal(newest.state,'available');if(newest.state==='available')assert.deepEqual(newest.value.sources.map(r=>r.id),oneKeys(11).slice(1).reverse().map(r=>r.id));
  const partial=inputFor(oneKeys(9));partial.participationRange={complete:false,stop:'record-limit'};partial.summaryRange={complete:false,stop:'record-limit'};prove(partial);
  const below=derivePolicy(partial);assert.equal(below.status.participation.state,'pending');assert.equal(below.status.participation.ordinal,null);
  assert.equal(below.status.participation.counted,9);
});

test('participation cap accepts coherent ten witnesses while newest range rejects a known omitted newer source',()=>{
  const i=inputFor(oneKeys(11));
  i.participationRange={complete:true,stop:'ten-witnesses',orderedSourceIds:oneKeys(10).reverse().map(r=>r.id),authority:i.authority};
  i.summaryRange={complete:false,stop:'row-budget'};i.coachRange=null;prove(i);
  assert.equal(derivePolicy(i).status.participation.state,'complete');
  const wrong=inputFor(oneKeys(11));wrong.summaryRange={complete:true,stop:'tenth-assessment',
    orderedSourceIds:oneKeys(10).reverse().map(r=>r.id),authority:wrong.authority};prove(wrong);
  assert.equal(derivePolicy(wrong).status.summary.state,'unavailable');
});

test('all-ten median arithmetic, null accuracy, deletion and timestamp/ID tie ordering',()=>{
  const sources=connected();
  const expected=[...sources].map(r=>r.metrics.wpm).sort((a,b)=>a-b);
  const p=derivePolicy(inputFor(sources)).status.summary;
  assert.equal(p.state,'available');if(p.state==='available')assert.equal(p.value.medianWpm,(expected[4]+expected[5])/2);
  sources[0].metrics.accuracy=null;validateResult(sources[0]);
  const nullAccuracy=derivePolicy(inputFor(sources)).status.summary;
  assert.equal(nullAccuracy.state,'available');if(nullAccuracy.state==='available') {
    assert.equal(nullAccuracy.value.medianAccuracy,null);assert.equal(nullAccuracy.value.validAccuracySources,9);
    assert.equal(nullAccuracy.value.medianWpm,(expected[4]+expected[5])/2);
  }
  assert.equal(derivePolicy(inputFor(sources.slice(1))).status.summary.state,'not-complete');
  const ties=oneKeys(11);ties.forEach(r=>{r.completedAt='2026-11-16T10:00:00.000Z';});
  const tied=derivePolicy(inputFor(ties.reverse())).status.summary;
  assert.equal(tied.state,'available');if(tied.state==='available')assert.deepEqual(tied.value.sources.map(r=>r.id),oneKeys(11).slice(1).reverse().map(r=>r.id));
});

test('epoch/source conflicts and terminal revision never manufacture authority',()=>{
  for(const revision of [Number.MAX_SAFE_INTEGER-1,Number.MAX_SAFE_INTEGER]) {
    const i=inputFor(oneKeys());i.authority.revision=revision;i.metadata.sourceRevision=revision;
    for(const r of [i.participationRange,i.summaryRange,i.coachRange])if(r?.complete)r.authority.revision=revision;
    prove(i);assert.equal(derivePolicy(i).status.participation.state,revision<Number.MAX_SAFE_INTEGER?'complete':'unavailable');
  }
  const duplicate=inputFor(oneKeys());duplicate.sources=[...duplicate.sources,structuredClone(duplicate.sources[0])];prove(duplicate);
  assert.equal(derivePolicy(duplicate).status.participation.counted,10);
  const conflict=inputFor(oneKeys());conflict.sources=[...conflict.sources,{...structuredClone(conflict.sources[0]),ref:{...conflict.sources[0].ref,partition:'legacy'},membership:null}];prove(conflict);
  assert.equal(derivePolicy(conflict).status.participation.state,'unavailable');
});

test('pending original-capture assessments influence only the ordinal, never witnesses or summary',()=>{
  const i=inputFor(oneKeys(9)), pending=run(100,250,{oneKey:true});
  const capture:Capture={databaseId:'database',contextId:'context',epochId:'epoch',capturedAt:NOW,purpose:'ordinary'};
  const item:PendingSource={source:pending,capture,state:'failed',retryable:true,durablySaved:false};
  i.pendingSources=[item,item,{...item,source:oneKeys(1)[0]}, {...item,capture:null},
    {...item,capture:{...capture,epochId:'old'}},{...item,retryable:false},{...item,state:'rejected'},
    {...item,source:run(101,250,{oneKey:true,mode:'practice'})}];
  const p=derivePolicy(i);assert.equal(p.status.pendingSave,1);assert.equal(p.status.participation.counted,9);
  assert.equal(p.status.participation.ordinal,null);assert.equal(p.status.summary.state,'not-complete');
  const next=inputFor(oneKeys(8));next.pendingSources=[item];
  assert.equal(derivePolicy(next).status.participation.ordinal,10);
});

test('recent window uses inclusive exact30-day cutoff and newest20 before clean-sentence inspection',()=>{
  const old=oneKeys();old.forEach(r=>{r.completedAt='2026-09-01T10:00:00.000Z';});
  for(const [age,include] of [[AGE-1,true],[AGE,true],[AGE+1,false],[-1,false]] as const) {
    const extra=run(100,250,{oneKey:true,mode:'practice'});extra.completedAt=new Date(Date.parse(NOW)-age).toISOString();
    const coach=derivePolicy(inputFor([...old,extra])).status.coach;
    assert.equal(coach.state,'complete-insufficient');if(coach.state==='complete-insufficient')assert.equal(coach.sources.length,include?1:0);
  }
  const clean=connected(), recent=Array.from({length:20},(_,i)=>run(i+20,250,{oneKey:true,mode:'practice'}));
  const p=derivePolicy(inputFor([...clean,...recent]));assert.equal(p.candidate,null);assert.equal(p.status.participation.counted,10);
  assert.equal(p.status.coach.reason,'too-few-observations-for-any-pair');
  if(p.status.coach.state==='complete-insufficient')assert.deepEqual(p.status.coach.sources.map(r=>r.id),recent.reverse().map(r=>r.id));
  const before=derivePolicy(inputFor(clean)).status.summary;
  assert.equal(before.state,'available');assert.equal(p.status.summary.state,'available');
  if(before.state==='available' && p.status.summary.state==='available')assert.deepEqual(p.status.summary.value,before.value);
});

test('malformed complement/count/log/key/run envelopes cannot promote targets or invalidate participation',()=>{
  for(const mutate of [
    (r:SessionResult)=>{for(const s of r.sentences)if(s.eligible)s.pairs.zz={count:1,logSum:Math.log(200)};},
    (r:SessionResult)=>{for(const s of r.sentences)if(s.eligible) {const p=Object.values(s.pairs)[0];if(p)p.count=299;}},
    (r:SessionResult)=>{for(const s of r.sentences)if(s.eligible) {const p=Object.values(s.pairs)[0];if(p)p.logSum=-Number.MAX_SAFE_INTEGER;}},
    (r:SessionResult)=>{for(const s of r.sentences)if(s.eligible)delete s.keys[Object.keys(s.keys)[0]];},
    (r:SessionResult)=>{r.metrics.attemptedCharacters=1;r.metrics.correctAttempts=1;r.metrics.accuracy=100;},
  ]) {
    const sources=connected(200);sources.forEach(mutate);sources.forEach(validateResult);
    const p=derivePolicy(inputFor(sources));assert.equal(p.status.participation.counted,10);assert.equal(p.candidate,null);
    assert.equal(p.status.coach.reason,'too-few-observations-for-any-pair');
  }
});

test('all-contributing-run halves include reference-only runs and cannot borrow target support or effect',()=>{
  const reference=run(30,250,{prompts:assessmentPrompts.filter(p=>!p.text.includes('he'))});reference.completedAt='2026-11-16T09:59:00.000Z';
  // Reviewed exact split becomes 7/217 and 21/354: the reference-only run moves the
  // whole-run midpoint, so dropping it would incorrectly preserve the ready focus.
  const p=derivePolicy(inputFor([reference,...connected()]));
  assert.equal(p.candidate,null);assert.equal(p.status.coach.evidenceScanComplete,true);
  const split=connected(), excluded=new Set(['assessment-015','assessment-022','assessment-007','assessment-021','assessment-023']);
  for(const r of split)for(const s of r.sentences)if(excluded.has(s.promptId)) {
    s.eligible=false;s.qualityFlags=[...new Set([...s.qualityFlags,'edited' as const])];s.pairs={};delete s.prediction;
  }
  split.forEach(validateResult);const seven=derivePolicy(inputFor(split));assert.equal(seven.candidate,null);
  const pooled=Array.from({length:10},(_,i)=>run(i,i<5?400:200));
  const uniformHalf=derivePolicy(inputFor(pooled));assert.equal(uniformHalf.candidate,null);assert.equal(uniformHalf.status.coach.reason,'unstable-evidence');
});

test('final admission requires the exact issued immutable candidate/proof and current pre-insertion authority',()=>{
  const {input,snapshot}=ready();
  const base={candidate:snapshot,currentAuthority:input.authority,currentConfigId:CONFIG_ID,currentGeneration:7,
    runState:'idle' as const,proof:input.finalProof!};
  assert.deepEqual(admitPractice(base),{admitted:true,snapshot});
  assert.deepEqual(admitPractice({...base,proof:structuredClone(base.proof)}),{admitted:false,reason:'scan-incomplete'});
  assert.equal(admitPractice({...base,candidate:structuredClone(snapshot)}).admitted,false);
  for(const runState of ['running','disposed'] as const)assert.deepEqual(admitPractice({...base,runState}),{admitted:false,reason:'started'});
  for(const patch of [{revision:4},{epochId:'new'},{databaseId:'recreated'},{contextId:'new'},{revision:Number.MAX_SAFE_INTEGER}])
    assert.deepEqual(admitPractice({...base,currentAuthority:{...base.currentAuthority,...patch}}),{admitted:false,reason:'authority-changed'});
  assert.equal(admitPractice({...base,currentGeneration:8}).admitted,false);
  assert.equal(admitPractice({...base,currentConfigId:'0'.repeat(64)}).admitted,false);
  const before=canonical(snapshot);derivePolicy(inputFor([]));assert.equal(canonical(snapshot),before);
});

test('invalid runtime config cannot use a legacy selector or model fallback',()=>{
  for(const config of [null,{}, {...COACH_CONFIG,extra:true}, {...COACH_CONFIG,releaseScope:{...COACH_CONFIG.releaseScope,automaticCoachingEnabled:false}}]) {
    const p=derivePolicy({...inputFor(connected()),config});assert.equal(p.candidate,null);
    assert.equal(p.status.automaticCoaching,'unavailable');assert.equal(p.status.coach.reason,'policy-invalid');
  }
  const p=ready();assert.equal('model' in p.input,false);assert.equal(p.output.status.automaticCoaching,'enabled');
});

test('reviewed lagged keydown/input trace is admitted without an aggregate-to-elapsed rejection',()=>{
  // Reviewed trace from docs/implementation/2026-11-16/baseline/policy-delta-review/review-results.json on archive/process-receipts-2026-11 at 6ce7e02999c668454459da42ad5d832b5f13f9bf.
  const trace = JSON.parse(readFileSync(new URL('./fixtures/lagged-keydown-input.json', import.meta.url), 'utf8')) as {
    prompt: Prompt;
    eventTrace: { position: number; char: string; keydownTime: number; inputTime: number }[];
    result: SessionResult;
    necessaryTime: number;
  };
  const engine=new TypingEngine({id:trace.result.id,prompts:[trace.prompt],inputMode:'flow-v1',durationMs:30000,
    qwerty:true,corpusVersion:'1',mode:'assessment'});
  for(const e of trace.eventTrace)engine.edit({start:e.position,end:e.position,text:e.char,pressTime:e.keydownTime},e.inputTime);
  engine.tick(30001);
  const source=engine.result(trace.result.completedAt)!;validateResult(source);
  assert.equal(hash(source),hash(trace.result));assert.ok(trace.necessaryTime>source.metrics.elapsedMs);
  const baseline=ready().snapshot;
  const changed=derivePolicy(inputFor([...connected(),source]));
  assert.equal(changed.status.participation.counted,10);assert.equal(changed.status.evidenceScanComplete,true);
  // The newly retained very fast he intervals remove the prior contrast. Rejecting the
  // valid lagged run by the old envelope would wrongly retain baseline's ready focus.
  assert.equal(baseline.focus.pair,'he');assert.equal(changed.candidate,null);
});

test('newest immutable text wins before malformed identity and incomplete target exclusion',()=>{
  const base=connected();
  const latest=new Map<string,SessionResult['sentences'][number]>();
  for(const r of base)for(const s of r.sentences)if(s.eligible && s.submitted)latest.set(s.promptText,s);
  const targetRows=[...latest.values()].filter(s=>s.pairs.he);
  for(const variant of ['partial','identity','greatest-ordinal'] as const) {
    const newer=structuredClone(base[0]);newer.id=id(900);newer.completedAt='2026-11-16T11:30:00.000Z';
    newer.sentences=targetRows.map(s=>structuredClone(s));
    for(const s of newer.sentences) {
      if(variant==='identity') { s.promptText+=' he';s.response=s.promptText; }
      else { delete s.pairs.he; }
    }
    if(variant==='greatest-ordinal')newer.sentences=targetRows.flatMap((s,i)=>[structuredClone(s),newer.sentences[i]]);
    const chars=newer.sentences.reduce((n,s)=>n+s.promptText.length,0);
    newer.metrics={...newer.metrics,correctCharacters:chars,attemptedCharacters:chars,correctAttempts:chars,accuracy:100,wpm:chars*12000/30000};
    validateResult(newer);
    const p=derivePolicy(inputFor([...base,newer]));
    assert.equal(p.candidate,null,variant);assert.equal(p.status.participation.counted,10);
    assert.equal(p.status.coach.evidenceScanComplete,true);
  }
});

test('component range completion and not-requested/null flags stay independent',()=>{
  for(const end of ['row-budget','byte-budget','record-limit','failure','aborted','authority-changed','proof-unavailable'] as const) {
    const i=inputFor(connected());i.summaryRange={complete:false,stop:end};i.coachRange={complete:false,stop:end};prove(i);
    const p=derivePolicy(i);assert.equal(p.status.baselineProofComplete,true);assert.equal(p.status.participation.counted,10);
    assert.equal(p.status.summary.state,'pending');assert.equal(p.status.coach.state,'pending');assert.equal(p.status.evidenceScanComplete,false);
  }
  const deferred=inputFor(connected());deferred.coachRange=null;prove(deferred);
  const p=derivePolicy(deferred);assert.equal(p.status.coach.state,'not-requested');assert.equal(p.status.evidenceScanComplete,null);
  const below=inputFor(oneKeys(9));prove(below);const b=derivePolicy(below);
  assert.equal(b.status.coach.state,'not-ready');assert.equal(b.status.evidenceScanComplete,null);
  const summaryPending=inputFor(connected());summaryPending.summaryRange={complete:false,stop:'record-limit'};prove(summaryPending);
  const independent=derivePolicy(summaryPending);assert.ok(independent.candidate);assert.equal(independent.status.summary.state,'pending');
});

test('complete summary and recent range boundaries require actual matching prefix witnesses',()=>{
  const i=inputFor(oneKeys(9));i.summaryRange={complete:true,stop:'tenth-assessment',
    orderedSourceIds:i.sources.map(r=>r.ref.id).reverse(),authority:i.authority};prove(i);
  assert.equal(derivePolicy(i).status.summary.state,'unavailable');
  for(const stop of ['twentieth-run','older-than-cutoff'] as const) {
    const wrong=inputFor(oneKeys());wrong.coachRange={complete:true,stop,orderedSourceIds:wrong.sources.map(r=>r.ref.id).reverse(),authority:wrong.authority};prove(wrong);
    assert.equal(derivePolicy(wrong).status.coach.state,'unavailable');
  }
  const complete=inputFor(Array.from({length:20},(_,i)=>run(i,250,{oneKey:true})));
  if(complete.coachRange?.complete)complete.coachRange.stop='twentieth-run';prove(complete);
  assert.equal(derivePolicy(complete).status.coach.evidenceScanComplete,true);
  const old=oneKeys();old.forEach(r=>{r.completedAt='2026-09-01T10:00:00.000Z';});
  const cutoff=inputFor(old);if(cutoff.coachRange?.complete)cutoff.coachRange.stop='older-than-cutoff';prove(cutoff);
  assert.equal(derivePolicy(cutoff).status.coach.reason,'stale-evidence');
});

test('real finite result never enters assessment or next coach window; ordinary timed practice does',()=>{
  const {snapshot}=ready(), adapter=createFiniteAdapter({id:id(500),snapshot});
  let time=100;
  for(const p of snapshot.plan.prompts) {
    for(const char of p.text) {const start=adapter.tick(time).engine.value.length;adapter.edit({start,end:start,text:char,pressTime:time},time);time++;}
    const start=adapter.tick(time).engine.value.length;adapter.edit({start,end:start,text:' ',pressTime:time},time);time++;
  }
  const source=adapter.result('2026-11-16T11:30:00.000Z');assert.ok(source && 'schemaId' in source);
  assert.deepEqual(validateFinitePracticeResult(source,snapshot.plan),source);assert.throws(()=>validateResult(source));
  const finite=inputFor([source]), context={metadata:finite.metadata,now:finite.now};
  assert.equal(qualifiesPolicySource(finite.sources[0],context),false);
  assert.equal(qualifiesPolicySource(finite.sources[0],context,true),false);
  const original=ready().snapshot, next=ready([...connected(),source]).snapshot;
  assert.deepEqual(next.focus,original.focus);assert.deepEqual(next.sources,original.sources);assert.deepEqual(next.witnesses,original.witnesses);
  const history=[...connected(),...Array.from({length:20},(_,i)=>run(i+20,250,{prompts:practicePrompts,mode:'practice'}))];
  const changed=derivePolicy(inputFor(history));assert.equal(changed.candidate,null);assert.equal(changed.status.participation.counted,10);
  if(changed.status.summary.state==='available')assert.deepEqual(changed.status.summary.value.sources.map(r=>r.id),original.witnesses.map(r=>r.id));
});

test('exact cohort, ordinary purpose and run integrity precede weak participation counting',()=>{
  const original=oneKeys(1)[0];
  assert.equal(original.metrics.correctCharacters,0);assert.equal(original.metrics.attemptedCharacters,1);
  assert.equal(derivePolicy(inputFor([original])).status.participation.counted,1);
  for(const change of [
    (r:SessionResult)=>{r.settings.qwerty=false;},
    (r:SessionResult)=>{delete r.settings.inputMode;r.settings.durationMs=60000;r.metrics.elapsedMs=60000;r.chartSamples.at(-1)!.elapsedMs=60000;},
    (r:SessionResult)=>{r.settings.corpusVersion='2';},
    (r:SessionResult)=>{r.qualityFlags=['interrupted'];r.eligibleForProgress=false;},
    (r:SessionResult)=>{r.metrics.attemptedCharacters=0;r.metrics.accuracy=null;},
    (r:SessionResult)=>{r.completedAt='2026-11-16T12:00:00.001Z';},
  ]) {
    const source=structuredClone(original);change(source);validateResult(source);
    const p=derivePolicy(inputFor([source]));assert.equal(p.status.participation.counted,0);assert.equal(p.candidate,null);
  }
  const protectedInput=inputFor(oneKeys());
  protectedInput.sources=protectedInput.sources.map(r=>({...r,membership:r.membership?{...r.membership,purpose:'protected-probe'}:null}));prove(protectedInput);
  assert.equal(derivePolicy(protectedInput).status.participation.counted,0);
});
