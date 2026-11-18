// Independent, source-only D boundary probes. Proof fixtures below are NOT storage authority.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TypingEngine } from '../../../../../../typing-app/client/src/engine.ts';
import { assessmentPrompts as A, practicePrompts as P, CORPUS_VERSION } from '../../../../../../typing-app/client/src/corpus.ts';
import { validateResult } from '../../../../../../typing-app/client/src/storage.ts';
import { selectHistory } from '../../../../../../typing-app/client/src/profile.ts';
import { createFiniteAdapter } from '../../../../../../typing-app/client/src/finite-practice.ts';
import { validateFinitePracticeResult } from '../../../../../../typing-app/client/src/finite-practice-result.ts';
import { derivePolicy, admitPractice, qualifiesPolicySource } from '../../../../../../typing-app/client/src/coach-policy.ts';
import { COACH_CONFIG, CONFIG_ID, BANK_HASH, CATALOGUE_ID, canonicalJson, hashCanonical,
  resolveCertifiedPlan, validateCertifiedPlan, validateCoachConfig, resolveStoredFinitePlan } from '../../../../../../typing-app/client/src/coach-plan.ts';

const dir = fileURLToPath(new URL('.', import.meta.url));
const git = (...args) => execFileSync('git', args, { encoding:'utf8', windowsHide:true }).trim();
const pin = '2832ceef907a02ca7a9487bfe7eb6b398218d911';
const paths = [...new Set([...git('ls-files','typing-app/client/src').split('\n'),
  '.omx/specs/typeforge-practice-policy-v1.md',
  ...git('ls-files','docs/implementation/2026-11-16/baseline/policy').split('\n'),
  ...git('ls-files','docs/implementation/2026-11-16/baseline/policy-delta-review/r2').split('\n'),
  ...git('ls-files','docs/implementation/2026-11-16/baseline/implementation/policy').split('\n'),
  'typing-app/client/tests/coach-policy.test.ts','typing-app/client/tests/coach-plan.test.ts',
  'typing-app/client/package.json','typing-app/client/package-lock.json'].filter(Boolean))];
const digest = value => createHash('sha256').update(value).digest('hex');
const manifest = () => paths.map(path => ({path, sha256:digest(readFileSync(path)),
  blob:git('hash-object',path), frozenBlob:git('rev-parse',`${pin}:${path}`)}));
const before = manifest();
const checks=[], observations={};
function check(name, fn) { try { fn(); checks.push({name,pass:true}); }
  catch(e) { checks.push({name,pass:false,error:e.stack}); } }
const clone=structuredClone;
// A separately written JSON-domain oracle; no production canonical helper in this hash oracle.
const canon = x => x===null || typeof x!=='object' ? JSON.stringify(x) : Array.isArray(x)
  ? '['+x.map(canon).join(',')+']' : '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canon(x[k])).join(',')+'}';
const hash=x=>digest(canon(x));
const id=n=>`10203040-0000-4000-8000-${String(n).padStart(12,'0')}`;
const NOW='2026-11-18T12:00:00.000Z';
const time=n=>new Date(Date.parse(NOW)-86400000+n*60000).toISOString();
function queue(bank,seed) { // independent LCG/Fisher-Yates schedule, not the accepted xorshift recipe
  const q=[...bank]; let x=seed;
  for(let i=q.length-1;i>0;i--) {x=(Math.imul(1664525,x)+1013904223)>>>0;const j=x%(i+1);[q[i],q[j]]=[q[j],q[i]];}
  return q;
}
function run(n,{target=300,other=180,mode='assessment',one=false,bank,seed=n+711,slowPairs}={}) {
  const q=queue(bank??(mode==='assessment'?A:P),seed);
  // Three specified first passages guarantee the intended word-diversity fixture.
  // This is a selected producer schedule, not a corpus/seed search or a yield estimate.
  if(!bank&&mode==='assessment'&&n<=3) {const first=A[[6,7,28][n-1]],j=q.indexOf(first);[q[0],q[j]]=[q[j],q[0]];}
  const engine=new TypingEngine({id:id(n),prompts:q,
    inputMode:'flow-v1',durationMs:30000,qwerty:true,corpusVersion:'1',mode});
  let t=0;
  while(engine.state==='idle'||engine.state==='running') {
    const pos=engine.value.length, text=engine.prompt.text, char=pos===text.length?' ':text[pos];
    t+=slowPairs?.[text.slice(pos-1,pos+1)]??(text.slice(pos-1,pos+1)==='he'?target:other);
    if(t>30100) break;
    engine.edit({start:pos,end:pos,text:one?(text[0]==='x'?'z':'x'):char,pressTime:t},t);
    if(one)break;
  }
  engine.tick(t+30000);
  const source=engine.result(time(n)); assert.ok(source);validateResult(source);return source;
}
const authority={databaseId:'review-db',contextId:'review-context',epochId:'review-epoch',revision:17};
const capture={databaseId:authority.databaseId,contextId:authority.contextId,epochId:authority.epochId,
  capturedAt:'2026-11-17T00:00:00.000Z',purpose:'ordinary'};
function bind(i) { // explicit in-memory pure-contract stand-in only
  i.finalProof={authority:clone(i.authority),admittedAt:NOW,configId:CONFIG_ID,method:'coherent-range-and-sources',
    selection:clone({metadata:i.metadata,now:i.now,sourceBindings:i.sources.map(({ref,membership})=>({ref,membership})),
      participationRange:i.participationRange,summaryRange:i.summaryRange,coachRange:i.coachRange})};return i;
}
function input(sources) {
  const reads=sources.map(source=>{const ref={partition:'current',kind:'schemaId'in source?'finite-practice-v1':'timed-v1',
    id:source.id,completedAt:source.completedAt,sha256:hash(source)};
    return {source:clone(source),ref,membership:{...capture,schemaId:'typeforge-coach-membership-v2',
      sourceKind:ref.kind,resultId:ref.id,resultSha256:ref.sha256}};});
  const ids=[...new Map(reads.map(r=>[r.ref.id,r])).values()].sort((a,b)=>
    b.ref.completedAt.localeCompare(a.ref.completedAt)||b.ref.id.localeCompare(a.ref.id)).map(r=>r.ref.id);
  const range={complete:true,stop:'exhausted',orderedSourceIds:ids,authority:clone(authority)};
  return bind({now:NOW,metadata:{schemaId:'typeforge-coach-metadata-v3',databaseId:authority.databaseId,
    defaultContextId:authority.contextId,activeEpochId:authority.epochId,legacyEpochId:authority.epochId,
    legacyCutoffCompletedAt:NOW,sourceRevision:authority.revision},authority:clone(authority),sources:reads,
    participationRange:clone(range),summaryRange:clone(range),coachRange:clone(range),config:clone(COACH_CONFIG),
    configId:CONFIG_ID,generation:9,persistence:{state:'idle',pendingIds:[]},pendingSources:[],
    work:{examinedRows:123,examinedBytes:456789,slices:7,keyRequests:34,countRequests:2,maxOperationMs:1.75,
      oversizedSerializedBytes:null,oversizedByteLowerBound:0,unindexableLegacy:null,unindexableCurrent:0}});
}
const project=s=>derivePolicy(input(s));
const occurrences=text=>[...text.matchAll(/[a-z]+/g)].flatMap(m=>Array.from({length:m[0].length-1},(_,j)=>
  ({pair:m[0].slice(j,j+2),end:m.index+j+2,word:m[0],wordEnd:m.index+m[0].length})));
function oracle(sources,pair='he') {
  const latest=new Map();
  for(const r of [...sources].sort((a,b)=>a.completedAt.localeCompare(b.completedAt)||a.id.localeCompare(b.id)))
    r.sentences.forEach((s,ordinal)=>{if(s.submitted&&s.eligible)latest.set(s.promptText,{r,s,ordinal});});
  const rows=[...latest.values()].sort((a,b)=>a.r.completedAt.localeCompare(b.r.completedAt)||a.r.id.localeCompare(b.r.id)||a.ordinal-b.ordinal);
  const contributing=[...new Set(rows.filter(x=>Object.keys(x.s.pairs).length).map(x=>x.r.id))];
  function stats(rs){let targetCount=0,referenceCount=0,targetLogSum=0,referenceLogSum=0;const runs=new Set(),prompts=new Set(),words=new Set();
    for(const {r,s}of rs)for(const [p,v]of Object.entries(s.pairs))if(p===pair){targetCount+=v.count;targetLogSum+=v.logSum;
      runs.add(r.id);prompts.add(s.promptText);occurrences(s.promptText).filter(o=>o.pair===pair).forEach(o=>words.add(o.word));
    }else{referenceCount+=v.count;referenceLogSum+=v.logSum;}
    return {targetCount,referenceCount,targetLogSum,referenceLogSum,sourceRuns:runs.size,promptContexts:prompts.size,
      wordContexts:words.size,delta:targetLogSum/targetCount-referenceLogSum/referenceCount};}
  const older=new Set(contributing.slice(0,Math.floor(contributing.length/2)));
  return {full:stats(rows),halves:[stats(rows.filter(x=>older.has(x.r.id))),stats(rows.filter(x=>!older.has(x.r.id)))],contributing};
}

check('frozen source and accepted artifact bytes',()=>assert.ok(before.every(p=>p.blob===p.frozenBlob)));
for(const value of [null,false,0,-0,1e-300,'Ã©ðŸ™‚\u0000',{z:[1,{b:2,a:1}],a:true},'a'.repeat(55),'a'.repeat(56),'a'.repeat(64),'a'.repeat(65536)])
  check(`canonical SHA oracle ${checks.length}`,()=>assert.equal(hashCanonical(value),hash(value)));
for(const value of [NaN,Infinity,undefined,()=>0,new Date(),[,1],{x:undefined}])
  check(`canonical invalid domain ${checks.length}`,()=>assert.throws(()=>canonicalJson(value)));
check('config exact accepted identity',()=>{assert.equal(hash(COACH_CONFIG),CONFIG_ID);
  assert.deepEqual(COACH_CONFIG,JSON.parse(readFileSync('docs/implementation/2026-11-16/baseline/policy/coach-config.example.json','utf8')));});
check('catalogue exact accepted identity',()=>{const c=JSON.parse(readFileSync('typing-app/client/src/coach-catalogue.json','utf8'));
  assert.equal(hash(c),CATALOGUE_ID);assert.deepEqual(c,JSON.parse(readFileSync('docs/implementation/2026-11-16/baseline/policy/finite-catalogue.example.json','utf8')));});
check('complete corpus identity',()=>assert.equal(hash({corpusVersion:CORPUS_VERSION,assessmentPrompts:A,practicePrompts:P}),BANK_HASH));
for(const pair of ['he','in','le','th'])check(`independent complete prefix certificate ${pair}`,()=>{
  const p=resolveCertifiedPlan(pair);assert.ok(p);const all=p.prompts.flatMap((t,i)=>occurrences(t.text).filter(o=>o.pair===pair)
    .map(o=>({...o,end:o.end+p.prompts.slice(0,i).reduce((n,x)=>n+x.text.length,0),wordEnd:o.wordEnd+p.prompts.slice(0,i).reduce((n,x)=>n+x.text.length,0)})));
  const chars=P.reduce((n,t)=>n+t.text.length,0), total=P.flatMap(t=>occurrences(t.text)).filter(o=>o.pair===pair).length;
  for(let n=20;n<=p.characterCount;n++)assert.ok(4*all.filter(o=>o.end<=n).length*chars>=5*n*total,`${pair}/${n}`);
  assert.ok(all[0].end<=20);assert.ok(new Set(all.filter(o=>o.wordEnd<=240).map(o=>o.word)).size>=3);
  assert.ok(p.prompts.filter((_,i)=>p.prompts.slice(0,i+1).reduce((n,t)=>n+t.text.length,0)<=480).length>=4);
  assert.equal(p.planHash,hash({pair,bankHash:BANK_HASH,prompts:p.prompts}));
  assert.equal(p.certificateId,hash({configId:CONFIG_ID,catalogueId:CATALOGUE_ID,bankHash:BANK_HASH,pair,prompts:p.prompts}));
  observations[pair+'Plan']={characters:p.characterCount,prefixes:p.characterCount-19};
});
for(const patch of [c=>c.support.targetIntervals--,c=>c.releaseScope.automaticCoachingEnabled=false,c=>c.extra=1])
  check(`unknown config abstains ${checks.length}`,()=>{const c=clone(COACH_CONFIG);patch(c);assert.throws(()=>validateCoachConfig(c));
    const i=input([]);i.config=c;assert.equal(derivePolicy(i).status.coach.reason,'policy-invalid');});
for(const mutate of [p=>p.prompts.reverse(),p=>p.prompts[0].text+='x',p=>p.certificateId='0'.repeat(64),p=>p.characterCount--])
  check(`plan mutation rejects ${checks.length}`,()=>{const p=clone(resolveCertifiedPlan('he'));mutate(p);assert.throws(()=>validateCertifiedPlan(p));});
check('unknown pair and stored identity abstain',()=>assert.equal(resolveCertifiedPlan('zz'),null));
const stored={configId:CONFIG_ID,catalogueId:CATALOGUE_ID,planHash:resolveCertifiedPlan('he').planHash,pair:'he',sentenceCount:resolveCertifiedPlan('he').prompts.length};
const storedExact=await resolveStoredFinitePlan(stored);
check('stored exact identity resolves',()=>assert.deepEqual(storedExact,resolveCertifiedPlan('he')));
observations.storedUnknown=await resolveStoredFinitePlan({...stored,configId:'0'.repeat(64)});
check('unknown stored config refuses',()=>assert.equal(observations.storedUnknown,null));

const clean=Array.from({length:10},(_,j)=>run(j+1));
const ready=project(clean);observations.positive={state:ready.status.coach.state,reason:ready.status.coach.reason,
  focus:ready.candidate?.focus,oracle:oracle(clean)};
check('new LCG engine history reaches supported he',()=>assert.equal(ready.candidate?.focus.pair,'he'));
check('independent full and half count/context recomputation',()=>{const f=ready.candidate.focus,o=oracle(clean);
  for(const k of ['targetCount','referenceCount','sourceRuns','promptContexts','wordContexts'])assert.equal(f[k],o.full[k],k);
  for(let h=0;h<2;h++)for(const k of ['targetCount','referenceCount','sourceRuns'])assert.equal(f.halves[h][k],o.halves[h][k]);
  assert.ok(Math.abs(f.targetLogSum/f.targetCount-f.referenceLogSum/f.referenceCount-o.full.delta)<1e-12);});
const weak=Array.from({length:11},(_,j)=>run(101+j,{one:true}));
for(const n of [0,1,9,10,11])check(`genuine wrong-key participation cap ${n}`,()=>{const p=project(weak.slice(0,n));
  assert.equal(p.status.participation.counted,Math.min(n,10));assert.equal(p.status.participation.ordinal,n<10?n+1:null);
  assert.equal(p.candidate,null);});
check('no age expiry or accuracy floor',()=>{const old=clone(weak.slice(0,10));old.forEach(r=>r.completedAt='2020-01-01T00:00:00.000Z');
  const p=project(old);assert.equal(p.status.participation.counted,10);assert.equal(p.status.summary.value.medianAccuracy,0);
  assert.equal(p.status.coach.reason,'stale-evidence');});
check('independent newest-ten medians on varied real engine WPM',()=>{const sources=Array.from({length:11},(_,j)=>run(201+j,{other:160+j*13,target:240+j*13}));
  const p=project(sources),chosen=sources.slice(1),median=k=>chosen.map(r=>r.metrics[k]).sort((a,b)=>a-b).slice(4,6).reduce((a,b)=>a+b)/2;
  assert.equal(p.status.summary.value.medianWpm,median('wpm'));assert.equal(p.status.summary.value.medianAccuracy,median('accuracy'));
  assert.deepEqual(p.status.summary.value.sources.map(r=>r.id),chosen.reverse().map(r=>r.id));});
check('nullable accuracy is all-ten or null (strict-valid aggregate mutation)',()=>{const sources=clone(weak.slice(0,10));sources[0].metrics.accuracy=null;
  sources.forEach(validateResult);const p=project(sources);assert.equal(p.status.summary.value.medianAccuracy,null);
  assert.equal(p.status.summary.value.validAccuracySources,9);});
check('deletion recomputes rather than sticky milestone',()=>{const p=project(clean.slice(1));assert.equal(p.status.participation.counted,9);assert.equal(p.status.summary.state,'not-complete');});
check('reset rejects previous membership bucket',()=>{const i=input(clean);i.authority.epochId='new';i.metadata.activeEpochId='new';
  for(const r of [i.participationRange,i.summaryRange,i.coachRange])r.authority.epochId='new';bind(i);
  assert.equal(derivePolicy(i).status.participation.counted,0);});
check('eligible pending original capture gives null ordinal at nine',()=>{const i=input(weak.slice(0,9));i.pendingSources=[{source:weak[9],capture:clone(capture),state:'pending',retryable:true,durablySaved:false}];
  const p=derivePolicy(i);assert.equal(p.status.pendingSave,1);assert.equal(p.status.participation.counted,9);assert.equal(p.status.participation.ordinal,null);
  i.pendingSources[0].capture.epochId='old';assert.equal(derivePolicy(i).status.participation.ordinal,10);});
check('classifier positive cannot publish without final proof',()=>{const i=input(clean);i.finalProof=null;assert.equal(qualifiesPolicySource(i.sources[0],i,true),true);
  const p=derivePolicy(i);assert.equal(p.status.participation.counted,0);assert.equal(p.status.participation.proof,null);assert.equal(p.status.summary.value,null);assert.equal(p.candidate,null);assert.equal(p.status.work,i.work);});
for(const changes of ['summary','coach'])check(`component independence ${changes}`,()=>{const i=input(clean);
  i[changes+'Range']={complete:false,stop:'row-budget'};bind(i);const p=derivePolicy(i);
  assert.equal(p.status.participation.state,'complete');assert.equal(p.status[changes].state,'pending');
  if(changes==='summary')assert.ok(p.candidate);else assert.equal(p.status.summary.state,'available');});
check('exact inclusive 30-day endpoint',()=>{const at=clone(clean);at.forEach(r=>r.completedAt=new Date(Date.parse(NOW)-30*86400000).toISOString());
  assert.ok(project(at).candidate);at.forEach(r=>r.completedAt=new Date(Date.parse(r.completedAt)-1).toISOString());assert.equal(project(at).status.coach.reason,'stale-evidence');});
const practice=Array.from({length:20},(_,j)=>run(301+j,{mode:'practice',one:true}));
check('newest20 before clean filters and ordinary timed practice next-choice feedback',()=>{const p=project([...clean,...practice]);
  assert.equal(p.status.participation.counted,10);assert.deepEqual(p.status.summary.value,ready.status.summary.value);
  assert.equal(p.candidate,null);assert.equal(p.status.coach.sources.length,20);assert.ok(p.status.coach.sources.every(r=>practice.some(s=>s.id===r.id)));});
check('delivery and pair insertion permutation preserve deterministic focus',()=>{const sources=clone(clean).reverse();sources.forEach(r=>r.sentences.forEach(s=>s.pairs=Object.fromEntries(Object.entries(s.pairs).reverse())));
  assert.deepEqual(project(sources).candidate.focus,ready.candidate.focus);});
for(const ms of [224.999999,225,225.000001,180])check(`real engine 25-percent boundary ${ms}`,()=>{const sources=Array.from({length:10},(_,j)=>run(j+1,{target:ms}));const p=project(sources);
  observations['effect'+ms]={ready:!!p.candidate,reason:p.status.coach.reason,he:oracle(sources)};
  assert.equal(!!p.candidate,ms>=225);});
for(const [name,mutate]of Object.entries({absentPair:s=>s.pairs.zz={count:1,logSum:Math.log(180)},
  excessiveCount:s=>Object.values(s.pairs)[0].count=299,impossibleLog:s=>Object.values(s.pairs)[0].logSum=-Number.MAX_SAFE_INTEGER,
  missingKey:s=>delete s.keys[Object.keys(s.keys)[0]]}))check(`fabricated strict-valid ${name} whole-sentence exclusion`,()=>{
    const sources=clone(clean);sources.forEach(r=>r.sentences.filter(s=>s.eligible).forEach(mutate));sources.forEach(validateResult);
    const p=project(sources);assert.equal(p.status.participation.counted,10);assert.equal(p.candidate,null);});
check('fabricated run count contradiction excludes coach only',()=>{const sources=clone(clean);sources.forEach(r=>{r.metrics.attemptedCharacters=1;r.metrics.correctAttempts=1;r.metrics.accuracy=100;validateResult(r);});
  const p=project(sources);assert.equal(p.status.participation.counted,10);assert.equal(p.candidate,null);});
for(const kind of ['partial','identity'])check(`latest text before ${kind} exclusion has no older backfill`,()=>{const newer=clone(clean);newer.forEach((r,j)=>{r.id=id(401+j);r.completedAt=time(401+j);
  r.sentences.filter(s=>s.eligible&&s.pairs.he).forEach(s=>{if(kind==='partial')delete s.pairs.he;else {s.promptText+='x';s.response=s.promptText;}});});
  newer.forEach(validateResult);assert.equal(project([...clean,...newer]).candidate,null);});
check('real uniform newer half defeats pooled effect',()=>{const sources=Array.from({length:10},(_,j)=>run(j+1,{target:j<5?420:180}));
  const p=project(sources);observations.uniformHalf={oracle:oracle(sources),reason:p.status.coach.reason};assert.equal(p.candidate,null);});
check('reference-only producer runs enter whole-run split',()=>{const reference=run(501,{bank:A.filter(p=>!p.text.includes('he'))});reference.completedAt=time(0);
  const sources=[reference,...clean],p=project(sources),o=oracle(sources);observations.referenceOnly={oracle:o,focus:p.candidate?.focus,reason:p.status.coach.reason};
  assert.ok(o.contributing.includes(reference.id));if(p.candidate)assert.deepEqual(p.candidate.focus.halves.map(h=>h.targetCount),o.halves.map(h=>h.targetCount));});

check('new genuine lagged-clock trace exceeds aggregate elapsed yet remains usable',()=>{
  const prompt=A.find(p=>occurrences(p.text).length>10), positions=occurrences(prompt.text), step=30000.03/positions.length;
  const e=new TypingEngine({id:id(600),prompts:[prompt],inputMode:'flow-v1',durationMs:30000,qwerty:true,corpusVersion:'1',mode:'assessment'});
  let press=0;
  for(let pos=0;pos<prompt.text.length;pos++) {if(pos&&/[a-z]/.test(prompt.text[pos-1])&&/[a-z]/.test(prompt.text[pos]))press+=step;
    e.edit({start:pos,end:pos,text:prompt.text[pos],pressTime:press},pos===0?1:Math.max(1,press));}
  e.edit({start:prompt.text.length,end:prompt.text.length,text:' ',pressTime:press},press+0.01);e.tick(30001);
  const r=e.result(time(600));validateResult(r);const s=r.sentences.find(s=>s.eligible&&s.submitted);assert.ok(s);
  const necessary=Object.values(s.pairs).reduce((n,x)=>n+x.count*Math.exp(x.logSum/x.count),0);
  assert.ok(necessary>r.metrics.elapsedMs);const history=[...clean,r];
  const p=project(history),o=oracle(history);assert.equal(p.candidate.focus.pair,'he');assert.equal(p.candidate.sources.length,11);
  assert.ok(Math.abs(p.candidate.focus.referenceLogSum-o.full.referenceLogSum)<1e-9);
  assert.ok(Math.abs(p.candidate.focus.targetLogSum-o.full.targetLogSum)<1e-9);
  assert.notEqual(p.candidate.focus.referenceLogSum,ready.candidate.focus.referenceLogSum);
  observations.lagged={necessary,elapsed:r.metrics.elapsedMs,hash:hash(r),sentenceEligible:s.eligible,reason:p.status.coach.reason,oracle:oracle(history)};
});
check('greatest ordinal before exclusion (strict-valid constructed aggregate)',()=>{
  const latest=new Map();for(const r of clean)for(const s of r.sentences)if(s.eligible&&s.submitted&&s.pairs.he)latest.set(s.promptText,s);
  const r=clone(clean[0]);r.id=id(650);r.completedAt=time(650);
  r.sentences=[...latest.values()].flatMap(s=>{const partial=clone(s);delete partial.pairs.he;return [clone(s),partial];});
  const chars=r.sentences.reduce((n,s)=>n+s.promptText.length,0);
  r.metrics={...r.metrics,correctCharacters:chars,attemptedCharacters:chars,correctAttempts:chars,accuracy:100,wpm:chars*12000/30000};
  validateResult(r);assert.equal(project([...clean,r]).candidate,null);
});
for(const endpoint of [0.25,5000,5000.001])check(`real filtered interval endpoint ${endpoint}`,()=>{
  const prompt=A.find(p=>!p.text.includes('he')),e=new TypingEngine({id:id(660),prompts:[prompt],inputMode:'flow-v1',
    durationMs:30000,qwerty:true,corpusVersion:'1',mode:'assessment'});let t=1,used=false;
  for(let pos=0;pos<prompt.text.length;pos++){if(pos>0){const within=/[a-z]/.test(prompt.text[pos-1])&&/[a-z]/.test(prompt.text[pos]);
    t+=within&&!used?(used=true,endpoint):0.25;}
    e.edit({start:pos,end:pos,text:prompt.text[pos],pressTime:t},t);}
  e.edit({start:prompt.text.length,end:prompt.text.length,text:' ',pressTime:t},t+0.25);e.tick(30001);
  const r=e.result(time(660));validateResult(r);const s=r.sentences.find(s=>s.submitted&&s.eligible);assert.ok(s);
  assert.equal(Object.values(s.pairs).reduce((n,x)=>n+x.count,0),occurrences(prompt.text).length-Number(endpoint>5000));
  const history=[...clean,r],p=project(history),o=oracle(history);assert.equal(p.candidate.focus.pair,'he');
  assert.equal(p.candidate.focus.referenceCount,o.full.referenceCount);
  assert.ok(Math.abs(p.candidate.focus.referenceLogSum-o.full.referenceLogSum)<1e-9);
});
check('highest independent full delta wins among two supported producer candidates',()=>{
  const sources=Array.from({length:10},(_,j)=>run(j+1,{slowPairs:{he:400,th:400}}));
  const p=project(sources),candidates=['he','th'].map(pair=>({pair,...oracle(sources,pair)})).filter(o=>
    o.full.targetCount>=20&&o.full.referenceCount>=80&&o.full.sourceRuns>=4&&o.full.promptContexts>=4&&o.full.wordContexts>=3&&
    o.full.delta+1e-10>=Math.log(1.25)&&o.halves.every(h=>h.targetCount>=8&&h.referenceCount>=20&&h.sourceRuns>=2&&h.delta+1e-10>=Math.log(1.1)));
  assert.equal(candidates.length,2);candidates.sort((a,b)=>b.full.delta-a.full.delta||a.pair.localeCompare(b.pair));
  assert.equal(p.candidate.focus.pair,candidates[0].pair);observations.twoCandidates={winner:p.candidate.focus.pair,
    candidates:candidates.map(o=>({pair:o.pair,delta:o.full.delta,target:o.full.targetCount,words:o.full.wordContexts}))};
});
if(!ready.candidate) { console.log(JSON.stringify({observations,checks},null,2)); throw new Error('Independent positive fixture did not qualify'); }
const snap=ready.candidate;
check('proof object and measured Work propagate unchanged',()=>{const i=input(clean),p=derivePolicy(i);assert.equal(p.candidate.proof,i.finalProof);
  assert.equal(p.status.participation.proof,i.finalProof);assert.equal(p.status.summary.proof,i.finalProof);assert.equal(p.status.work,i.work);});
check('issued candidate admission and immutable snapshot',()=>{assert.ok(Object.isFrozen(snap));assert.ok(Object.isFrozen(snap.plan.prompts[0]));
  assert.ok(admitPractice({candidate:snap,currentAuthority:authority,currentConfigId:CONFIG_ID,currentGeneration:9,runState:'idle',proof:snap.proof}).admitted);
  assert.equal(admitPractice({candidate:clone(snap),currentAuthority:authority,currentConfigId:CONFIG_ID,currentGeneration:9,runState:'idle',proof:snap.proof}).admitted,false);});
for(const patch of [{currentGeneration:10},{currentAuthority:{...authority,revision:18}},{runState:'running'},{proof:clone(snap.proof)}])
  check(`admission continuity rejects ${Object.keys(patch)[0]}`,()=>assert.equal(admitPractice({candidate:snap,currentAuthority:authority,currentConfigId:CONFIG_ID,currentGeneration:9,runState:'idle',proof:snap.proof,...patch}).admitted,false));
check('selection mutation fails binding without fabricating a proof',()=>{const i=input(clean);i.now='2026-11-18T12:00:00.001Z';assert.equal(derivePolicy(i).candidate,null);});
check('real early finite source stays outside all timed evidence domains',()=>{const adapter=createFiniteAdapter({id:id(700),snapshot:snap});let t=0;
  for(const prompt of snap.plan.prompts)for(let pos=0;pos<=prompt.text.length;pos++){t+=2;adapter.edit({start:pos,end:pos,text:pos===prompt.text.length?' ':prompt.text[pos],pressTime:t},t);}
  const source=adapter.result(time(700));validateFinitePracticeResult(source,snap.plan);assert.throws(()=>validateResult(source));
  assert.equal(source.termination,'plan-exhausted');assert.ok(source.metrics.elapsedMs<30000);
  const i=input([...clean,source]),p=derivePolicy(i);assert.equal(qualifiesPolicySource(i.sources.at(-1),i),false);
  assert.deepEqual(p.candidate.focus,snap.focus);assert.deepEqual(p.status.summary.value,ready.status.summary.value);
  assert.deepEqual(p.candidate.sources,snap.sources);assert.equal(p.status.participation.counted,10);
  for(const key of ['practiceFocus','manualDrill','sourceAssessmentId'])assert.equal(key in source,false);
  const timed=[...clean,...practice];assert.deepEqual(selectHistory(timed,clean[0].settings),selectHistory(clean,clean[0].settings));
  observations.finite={kind:source.schemaId,elapsed:source.metrics.elapsedMs,sentences:source.sentences.length,hash:hash(source)};
});
const after=manifest();check('source dependency hashes unchanged after all probes',()=>assert.deepEqual(after,before));
const output={pin,head:git('rev-parse','HEAD'),node:process.version,checks,independentChecks:checks.length,
  passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length,
  authorReplay:{command:'node --experimental-strip-types --test typing-app/client/tests/coach-policy.test.ts typing-app/client/tests/coach-plan.test.ts',tests:31,independent:false},
  observations,before,after};
writeFileSync(dir+'results.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({checks:output.independentChecks,passed:output.passed,failed:output.failed,
  failures:checks.filter(x=>!x.pass),observations},null,2));
process.exitCode=output.failed?1:0;
