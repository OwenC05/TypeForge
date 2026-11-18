// Exact frozen author replay + independent engine/adversarial delta review. Node24, stdlib only.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { assessmentPrompts, practicePrompts } from '../../../../../typing-app/client/src/corpus.ts';
import { TypingEngine } from '../../../../../typing-app/client/src/engine.ts';
import { validateResult } from '../../../../../typing-app/client/src/storage.ts';

const root=new URL('../../../../../',import.meta.url), here=new URL('./',import.meta.url);
const revision='747d3e7bc22965eaf8ea2b22df0f0070f01be43c';
const policy='docs/implementation/2026-11-16/baseline/policy/';
const git=(...args)=>execFileSync('git',args,{cwd:root,windowsHide:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const snapshots=new URL('input/',here); mkdirSync(snapshots,{recursive:true});
const names=['amendment-r1.md','revision-check.mjs','revision-check.json','coach-config.example.json',
  'coach-config.schema.json','coach-sidecar.schema.json','finite-catalogue.example.json','sidecar-examples.json'];
const manifest={revision,rootImport:git('rev-parse','03abfdb').toString().trim(),files:{}};
for(const name of names){
  const bytes=git('show',`${revision}:${policy}${name}`);
  const target=name==='revision-check.json'?'revision-check.original.json':name==='revision-check.mjs'?'revision-check.original.mjs':name;
  writeFileSync(new URL(target,snapshots),bytes);
  manifest.files[policy+name]={gitBlob:git('rev-parse',`${revision}:${policy}${name}`).toString().trim(),sha256:sha(bytes)};
}
const specPath='.omx/specs/typeforge-practice-policy-v1.md';
const spec=git('show',`${revision}:${specPath}`); writeFileSync(new URL('spec.md',snapshots),spec);
manifest.files[specPath]={gitBlob:git('rev-parse',`${revision}:${specPath}`).toString().trim(),sha256:sha(spec)};
// Replay imports checked-out core only after proving exact Git text identity with frozen input.
for(const name of ['engine.ts','corpus.ts','storage.ts','model.ts','profile.ts','app.ts']){
  const path=`typing-app/client/src/${name}`;
  const frozen=git('show',`${revision}:${path}`),local=readFileSync(new URL(path,root));
  assert.equal(frozen.toString().replace(/\r\n/g,'\n'),local.toString().replace(/\r\n/g,'\n'),path);
  manifest.files[path]={gitBlob:git('rev-parse',`${revision}:${path}`).toString().trim(),sha256:sha(frozen)};
}
writeFileSync(new URL('input-manifest.json',here),JSON.stringify(manifest,null,2)+'\n');
let replay=readFileSync(new URL('revision-check.original.mjs',snapshots),'utf8');
for(const name of ['corpus.ts','engine.ts','storage.ts']) replay=replay.replace(`../../../../../typing-app/client/src/${name}`,new URL(`typing-app/client/src/${name}`,root).href);
replay=replay.replace("new URL('revision-check.json', import.meta.url)","new URL('author-replay-results.json', import.meta.url)");
replay+='\nexport {sentenceIssue,runIssue,retained,inspect,baseline,membersFor,certificate,catalogueValid,engineRun,at,config,catalogue};\n';
writeFileSync(new URL('author-replay.mjs',snapshots),replay);
const author=await import(new URL('author-replay.mjs',snapshots));
let checks=0;const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const evidence={};
const clone=x=>structuredClone(x);
const occurrences=(text,pair)=>{let total=0;for(const word of text.split(' '))for(let i=0;i<word.length-1;i++)if(!pair||word.slice(i,i+2)===pair)total++;return total;};

// Independently construct a valid event stream with first keydown->input latency.
// Six unique pair intervals are5000ms; all other actions are0.001ms. The engine
// starts on first input, while pair timing starts on its earlier keydown.
const prompt=assessmentPrompts.find(p=>p.text[1]!==' '&&occurrences(p.text,p.text.slice(0,2))===1&&
  new Set([...p.text.matchAll(/(?=([a-z]{2}))/g)].map(m=>m[1]).filter(pair=>occurrences(p.text,pair)===1)).size>=6);
assert.ok(prompt);
const uniquePairs=[...new Set([...prompt.text.matchAll(/(?=([a-z]{2}))/g)].map(m=>m[1]))].filter(p=>occurrences(prompt.text,p)===1);
const slow=new Set([prompt.text.slice(0,2),...uniquePairs.filter(p=>p!==prompt.text.slice(0,2)).slice(0,5)]);
function laggedRun(firstLag,trace=[]){
  const engine=new TypingEngine({id:'00000000-0000-4000-8000-000000999001',prompts:[prompt],durationMs:30000,inputMode:'flow-v1',qwerty:true,corpusVersion:'1'});
  let press=0;
  for(let i=0;i<prompt.text.length;i++){
    if(i)press+=slow.has(prompt.text.slice(i-1,i+1))?5000:0.001;
    const inputTime=i===0?firstLag:press;
    trace.push({position:i,char:prompt.text[i],keydownTime:press,inputTime});
    engine.edit({start:i,end:i,text:prompt.text[i],pressTime:press},inputTime);
  }
  press+=0.001;trace.push({position:prompt.text.length,char:' ',keydownTime:press,inputTime:press,submission:true});engine.edit({start:prompt.text.length,end:prompt.text.length,text:' ',pressTime:press},press);
  engine.tick(Math.max(press,firstLag+30000));
  const result=engine.result('2026-11-16T11:00:00.000Z');assert.ok(result);validateResult(result);
  return result;
}
const eventTrace=[],lagged=laggedRun(1,eventTrace);
check(lagged.sentences[0].eligible,true,'lagged real-engine sentence clean');
check(lagged.metrics.elapsedMs,30000,'lagged real-engine completion');
check(author.sentenceIssue(lagged,lagged.sentences[0]),null,'lagged sentence meets revised all-pair/key domains');
check(author.runIssue(lagged),'coach-run-envelope','revised elapsed-time bound rejects valid engine result');
evidence.laggedTime={prompt,slowPairs:[...slow],firstKeydown:0,firstInput:1,eventTrace,result:lagged,issue:author.runIssue(lagged),
  necessaryTime:lagged.sentences.flatMap(s=>Object.values(s.pairs)).reduce((n,p)=>n+p.count*Math.exp(p.logSum/p.count),0)};
evidence.deadlineControls=[0,0.01,0.1,1].map(firstLag=>{
  const r=laggedRun(firstLag);return {firstLag,eligibleSentences:r.sentences.filter(s=>s.eligible).length,issue:author.runIssue(r),elapsedMs:r.metrics.elapsedMs};
});
check(evidence.deadlineControls.map(x=>x.eligibleSentences),[0,0,1,1],'deadline controls distinguish incomplete text from valid late-clock completion');
check(evidence.deadlineControls.map(x=>x.issue),[null,null,'coach-run-envelope','coach-run-envelope'],'time false rejection appears only after genuine complete-sentence admission');

// Genuine fractional-ms whole histories at independent 0.25 and4999ms endpoints.
const subEngine=new TypingEngine({id:'00000000-0000-4000-8000-000000999002',prompts:assessmentPrompts,durationMs:30000,inputMode:'flow-v1',qwerty:true,corpusVersion:'1'});
let subTime=1;
for(const char of assessmentPrompts[0].text+' '){const pos=subEngine.value.length;subEngine.edit({start:pos,end:pos,text:char,pressTime:subTime},subTime);subTime+=0.25;}
subEngine.tick(30001);const sub=subEngine.result('2026-11-16T11:00:00.000Z');assert.ok(sub);validateResult(sub);
check(author.runIssue(sub),null,'fully sub-ms engine path admitted');
check(sub.sentences.filter(s=>s.eligible).every(s=>author.sentenceIssue(sub,s)===null),true,'fully sub-ms sentence/key admission');
const uniform=Array.from({length:10},(_,i)=>author.engineRun(assessmentPrompts,200,i));
check(author.inspect(uniform,author.membersFor(uniform),'he').timing,false,'new independent repeated uniform stream abstains');

// Previously exploited absent-pair and impossible-domain mutations must now exclude.
const original=clone(author.at.sources),forged=clone(original);
for(const r of forged)for(const s of r.sentences.filter(s=>s.eligible))s.pairs.zz={count:299,logSum:-Number.MAX_SAFE_INTEGER};
forged.forEach(validateResult);
check(author.inspect(forged,author.membersFor(forged),'he').timing,false,'original exploit no longer creates timing focus');
check(author.baseline(forged,author.membersFor(forged)).counted,10,'coach rejection keeps milestone independent');
for(const value of [-Number.MAX_SAFE_INTEGER,Number.POSITIVE_INFINITY]){
  const r=clone(original[0]),s=r.sentences.find(s=>s.eligible),p=Object.keys(s.pairs)[0];s.pairs[p].logSum=value;
  check(author.sentenceIssue(r,s),'coach-log-domain',`bad domain ${value}`);
}

// Independent connected certificate, checked at every character without author certificate().
const certs=author.catalogue.templates.map(t=>{
  const plan=t.promptIds.map(id=>practicePrompts.find(p=>p.id===id));let length=0,events=[],wordEvents=[],passageEnds=[];
  for(const p of plan){for(const w of [...p.text.matchAll(/[a-z]+/g)]){
    if(w[0].includes(t.pair))wordEvents.push({word:w[0],end:length+w.index+w[0].length});
    for(let i=0;i<w[0].length-1;i++)if(w[0].slice(i,i+2)===t.pair)events.push(length+w.index+i+2);
  }length+=p.text.length;passageEnds.push(length);}
  const bankCount=practicePrompts.reduce((n,p)=>n+occurrences(p.text,t.pair),0),bankChars=practicePrompts.reduce((n,p)=>n+p.text.length,0);
  const failures=[];for(let n=20;n<=length;n++)if(4*events.filter(e=>e<=n).length*bankChars<5*n*bankCount)failures.push(n);
  const summary={pair:t.pair,length,first:events[0],words240:new Set(wordEvents.filter(e=>e.end<=240).map(e=>e.word)).size,passages480:passageEnds.filter(e=>e<=480).length,failures};
  check(length>=480&&length<=600&&events[0]<=20&&summary.words240>=3&&summary.passages480>=4&&failures.length===0&&new Set(t.promptIds).size===plan.length,true,`independent finite certificate ${t.pair}`);
  return summary;
});evidence.certificates=certs;

// Mathematically qualified sources do not pass the revised delivery scope.
check(author.at.profile.timing,true,'connected author history still qualifies timing');
check(author.at.baseline.counted,10,'connected author history milestone complete');
check(author.config.releaseScope.automaticCoachingEnabled,false,'r1 config prevents full objective');
evidence.deliveryGate={milestone:author.at.baseline.counted,timing:author.at.profile.timing,certificate:true,
  automaticCoachingEnabled:author.config.releaseScope.automaticCoachingEnabled,effectiveSuggested:false};
const heTemplate=author.catalogue.templates.find(t=>t.pair==='he').promptIds.map(id=>practicePrompts.find(p=>p.id===id));
const exhaustEngine=new TypingEngine({id:'00000000-0000-4000-8000-000000999003',prompts:heTemplate,durationMs:30000,inputMode:'flow-v1',qwerty:true,corpusVersion:'1',mode:'practice'});
let exhaustTime=1;for(const p of heTemplate)for(const char of p.text+' '){const pos=exhaustEngine.value.length;exhaustEngine.edit({start:pos,end:pos,text:char,pressTime:exhaustTime},exhaustTime);exhaustTime++;}
check(exhaustEngine.submittedSummaries.length,heTemplate.length,'all finite-template sentences submitted');
check(exhaustEngine.prompt.id,heTemplate[0].id,'legacy engine wraps to uncertified repeated first prompt');
check(exhaustEngine.state,'running','finite-template exhaustion does not itself stop the engine');
evidence.exhaustion={elapsedBeforeDeadline:exhaustTime,planCharacters:heTemplate.reduce((n,p)=>n+p.text.length,0),submitted:exhaustEngine.submittedSummaries.length,nextPrompt:exhaustEngine.prompt.id,state:exhaustEngine.state};

// Summary median values come from validated source metrics, not pair timing.
const newest=Array.from({length:11},(_,i)=>author.engineRun(assessmentPrompts,250,i,{oneKey:true}));
const ordered=author.baseline([...newest].reverse(),author.membersFor(newest));
check(ordered.ids,newest.slice(1).map(r=>r.id),'newest ten summary independent page order');
check(ordered.summary.medianWpm,0,'one-key wrong baseline median WPM zero');
check(ordered.summary.medianAccuracy,0,'one-key wrong baseline accuracy zero');
const missing=clone(newest);missing[5].metrics.accuracy=null;
const missingSummary=author.baseline(missing,author.membersFor(missing)).summary;
check(missingSummary.medianAccuracy,null,'all-ten-or-unavailable accuracy');
check(missingSummary.validAccuracySources,9,'accuracy unavailable count retained');
check(missingSummary.medianWpm,0,'WPM remains separate from accuracy');
evidence.summary={ordered:ordered.summary,missingAccuracy:missingSummary,
  cachedTenIncompleteRange:author.baseline(newest.slice(0,10),author.membersFor(newest),{exhausted:false})};

// Nonzero summary medians from real engine metrics; these do not rely on a scalar
// median helper or constant-zero participation witnesses.
function scoreRun(correct,index,mode='assessment'){
  const e=new TypingEngine({id:`00000000-0000-4000-8000-${String(800000+index).padStart(12,'0')}`,prompts:assessmentPrompts,durationMs:30000,inputMode:'flow-v1',qwerty:true,corpusVersion:'1',mode});
  for(let i=0;i<10;i++){const expected=e.prompt.text[i],text=i<correct?expected:(expected==='x'?'q':'x');e.edit({start:i,end:i,text,pressTime:10+i*10},10+i*10);}
  e.tick(30010);const r=e.result(new Date(Date.UTC(2026,10,16,11,index)).toISOString());assert.ok(r);validateResult(r);return r;
}
const scores=Array.from({length:10},(_,i)=>scoreRun(i,i));
const numericSummary=author.baseline(scores,author.membersFor(scores)).summary;
check(numericSummary.medianWpm,1.8,'true engine median pace averages middle 1.6 and2.0');
check(numericSummary.medianAccuracy,45,'true engine median accuracy averages40 and50');
const elevenScores=[...scores,scoreRun(10,10)];
const replaced=author.baseline(elevenScores,author.membersFor(elevenScores)).summary;
check(replaced.medianWpm,2.2,'eleventh saved assessment changes newest-ten median pace');
check(replaced.medianAccuracy,55,'eleventh saved assessment changes newest-ten accuracy');
const withPractice=[...scores,scoreRun(10,11,'practice')];
check(author.baseline(withPractice,author.membersFor(withPractice)).summary,numericSummary,'practice never replaces assessment summary source');
evidence.summary.nonzero={ten:numericSummary,eleventh:replaced};

// Independently derive retained texts and whole-run halves, including a reference-only
// source. No author stats/partition helpers are used for expected counts or log sums.
const refPrompts=assessmentPrompts.filter(p=>!occurrences(p.text,'he'));
const referenceOnly=author.engineRun(refPrompts,250,40);referenceOnly.completedAt='2026-11-16T09:59:00.000Z';
const augmented=[...original,referenceOnly];
const compare=(a,b)=>a<b?-1:a>b?1:0;
const sorted=[...augmented].sort((a,b)=>compare(a.completedAt,b.completedAt)||compare(a.id,b.id));
const latest=new Map();for(const r of sorted)for(const s of r.sentences)if(s.eligible&&s.submitted)latest.set(s.promptText,{r,s});
const contributing=[...latest.values()].filter(({s})=>Object.keys(s.pairs).length&&(!occurrences(s.promptText,'he')||s.pairs.he?.count===occurrences(s.promptText,'he')));
const ids=[...new Set(contributing.map(x=>x.r.id))].sort((a,b)=>{const x=sorted.find(r=>r.id===a),y=sorted.find(r=>r.id===b);return compare(x.completedAt,y.completedAt)||compare(a,b);});
const older=new Set(ids.slice(0,Math.floor(ids.length/2)));
function independentHalf(isOlder){
  let target=0,reference=0,tl=0,rl=0;const targetRuns=new Set();
  for(const {r,s} of contributing.filter(x=>older.has(x.r.id)===isOlder))for(const [p,x] of Object.entries(s.pairs)){
    if(p==='he'){target+=x.count;tl+=x.logSum;targetRuns.add(r.id);}else{reference+=x.count;rl+=x.logSum;}
  }return {target,reference,runs:targetRuns.size,targetLogSum:tl,referenceLogSum:rl};
}
const expectedHalves=[independentHalf(true),independentHalf(false)],actual=author.inspect(augmented,author.membersFor(augmented),'he');
check(actual.contributingRunIds,ids,'reference-only source retained in canonical all-contributing IDs');
check(actual.halves.map(h=>[h.target,h.reference,h.runs]),expectedHalves.map(h=>[h.target,h.reference,h.runs]),'independent relational whole-run halves');
check(actual.halves.every((h,i)=>Math.abs(h.targetLogSum-expectedHalves[i].targetLogSum)<1e-10&&Math.abs(h.referenceLogSum-expectedHalves[i].referenceLogSum)<1e-10),true,'independent half log composition');
evidence.relationalHalves={independent:expectedHalves,actual:actual.halves,contributingIds:ids};

const replacedRow=[...author.retained(original,author.membersFor(original)).rows].reverse().find(x=>x.sentence.pairs.he?.count>0);
assert.ok(replacedRow);
const unknown=clone(replacedRow.result);unknown.id='00000000-0000-4000-8000-000000999090';unknown.completedAt='2026-11-16T11:50:00.000Z';
unknown.sentences=[clone(replacedRow.sentence)];unknown.sentences[0].promptId='unknown-same-text';validateResult(unknown);
const unknownSources=[...original,unknown],unknownRetained=author.retained(unknownSources,author.membersFor(unknownSources));
check(unknownRetained.rows.some(x=>x.sentence.promptText===replacedRow.sentence.promptText),false,'unknown newer ID with same exact text does not backfill older source');
check(unknownRetained.excluded.some(x=>x.id===unknown.id&&x.reason==='coach-prompt-identity'),true,'unknown immutable identity diagnosed');
evidence.dedup={supersededText:replacedRow.sentence.promptText,newestUnknownId:unknown.id,excluded:unknownRetained.excluded};

function filterEndpoint(ms,index){
  const e=new TypingEngine({id:`00000000-0000-4000-8000-${String(999100+index).padStart(12,'0')}`,prompts:[prompt],durationMs:30000,inputMode:'flow-v1',qwerty:true,corpusVersion:'1'});
  let time=1;for(let i=0;i<prompt.text.length;i++){if(i)time+=i===1?ms:0.25;e.edit({start:i,end:i,text:prompt.text[i],pressTime:time},time);}
  time+=0.25;e.edit({start:prompt.text.length,end:prompt.text.length,text:' ',pressTime:time},time);e.tick(30001);
  const r=e.result('2026-11-16T11:00:00.000Z');assert.ok(r);validateResult(r);return r;
}
evidence.filterEndpoints=[4999.999,5000,5000.001].map((ms,i)=>{
  const r=filterEndpoint(ms,i),s=r.sentences[0],count=Object.values(s.pairs).reduce((n,x)=>n+x.count,0);
  check(s.eligible,true,`endpoint ${ms} sentence clean`);
  check(count,occurrences(prompt.text)-(ms>5000?1:0),`endpoint ${ms} actual filter count`);
  check(author.runIssue(r),null,`endpoint ${ms} revised admission`);
  return {ms,count,issue:author.runIssue(r),sentence:s};
});

const replayResults=JSON.parse(readFileSync(new URL('author-replay-results.json',snapshots),'utf8'));
const report={revision,head:git('rev-parse','HEAD').toString().trim(),node:process.version,checks,authorReplayChecks:replayResults.checks,
  inputManifestSha256:sha(readFileSync(new URL('input-manifest.json',here))),evidence,
  limits:['Frozen author replay functions are not independent implementation coverage','New fixture generation and expected outcomes are independent',
    'No UI, browser latency frequency, IndexedDB race or human benefit tested','No enabling identity or finite exhaustion adapter implemented']};
writeFileSync(new URL('review-results.json',here),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checks,authorReplayChecks:replayResults.checks,laggedTime:{necessaryTime:evidence.laggedTime.necessaryTime,issue:evidence.laggedTime.issue},deliveryGate:evidence.deliveryGate,certificates:certs},null,2));
