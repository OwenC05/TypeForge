// C2 exact-source r2 acceptance. Stdlib/Node24; all generated inputs stay in this directory.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const revision='c6a8a806ec98c6015e3e8819698ff5b19a97ad98';
const root=new URL('../../../../../../',import.meta.url),here=new URL('./',import.meta.url),input=new URL('input/',here);
const git=(...args)=>execFileSync('git',args,{cwd:root,windowsHide:true});
const sha=x=>createHash('sha256').update(x).digest('hex');
const clone=x=>structuredClone(x),canon=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?`[${x.map(canon)}]`:`{${Object.keys(x).sort().map(k=>`${JSON.stringify(k)}:${canon(x[k])}`).join(',')}}`;
mkdirSync(new URL('application/',input),{recursive:true});
const manifest={revision,rootImport:git('rev-parse','0c25a8b').toString().trim(),files:{}};
function snapshot(path,name){const bytes=git('show',`${revision}:${path}`);writeFileSync(new URL(name,input),bytes);manifest.files[path]={blob:git('rev-parse',`${revision}:${path}`).toString().trim(),sha256:sha(bytes)};return bytes.toString();}
for(const name of ['engine.ts','storage.ts','model.ts','profile.ts','corpus.ts','app.ts'])snapshot(`typing-app/client/src/${name}`,`application/${name}`);
const base='docs/implementation/2026-11-16/baseline/policy/';
for(const name of ['revision-check.mjs','r2-check.mjs','revision-check.json','r2-check.json','coach-config.example.json','coach-config.schema.json','finite-catalogue.example.json','metadata-membership.schema.json','interfaces-r2.ts','finite-adapter-r2.md','amendment-r2.md','implementation-dag-r2.md'])snapshot(base+name,name.endsWith('.mjs')?name.replace('.mjs','.original.mjs'):name);
snapshot('.omx/specs/typeforge-practice-policy-v1.md','spec.md');
const priorPath='docs/implementation/2026-11-16/baseline/policy-delta-review/review-results.json';
const priorBytes=git('show',`3c9342c:${priorPath}`),prior=JSON.parse(priorBytes);manifest.priorFixture={commit:'3c9342c2eb3758dfa9d3028f8adabf0ab470eeca',path:priorPath,sha256:sha(priorBytes)};
// Author branch predates the accepted reader merge; bridge only the timed-result
// validator through exact root source. This is not a repeat low-level reader audit.
const rootStoragePath='typing-app/client/src/storage.ts',rootStorage=git('show',`0c25a8b:${rootStoragePath}`);
writeFileSync(new URL('application/root-storage.ts',input),rootStorage);
manifest.rootTimedValidator={revision:manifest.rootImport,path:rootStoragePath,blob:git('rev-parse',`0c25a8b:${rootStoragePath}`).toString().trim(),sha256:sha(rootStorage)};
assert.equal(git('rev-parse','c6a8a80:typing-app/client/src/engine.ts').toString(),git('rev-parse','0c25a8b:typing-app/client/src/engine.ts').toString());
writeFileSync(new URL('input-manifest.json',here),JSON.stringify(manifest,null,2)+'\n');
for(const name of ['revision-check','r2-check']){
  let source=readFileSync(new URL(name+'.original.mjs',input),'utf8');
  for(const module of ['engine.ts','storage.ts','corpus.ts'])source=source.replace(`../../../../../typing-app/client/src/${module}`,`./application/${module}`);
  source=source.replace(`new URL('${name}.json', import.meta.url)`,`new URL('${name}.replayed.json', import.meta.url)`);
  writeFileSync(new URL(name+'.mjs',input),source);
}
await import(new URL('r2-check.mjs',input));
const a=await import(new URL('revision-check.mjs',input));
const {TypingEngine}=await import(new URL('application/engine.ts',input));
const {validateResult}=await import(new URL('application/storage.ts',input));
const {validateResult:rootValidateResult}=await import(new URL('application/root-storage.ts',input));
const {assessmentPrompts,practicePrompts}=await import(new URL('application/corpus.ts',input));
const {selectHistory}=await import(new URL('application/profile.ts',input));
let checks=0;const named=[];const check=(actual,expected,name)=>{assert.deepEqual(actual,expected,name);checks++;named.push(name);};
const detail={};
const r1Config=JSON.parse(git('show',`747d3e7:${base}coach-config.example.json`));
for(const field of ['baseline','context','window','support','effect','stability','exposure','limits'])check(a.config[field],r1Config[field],`unchanged ${field} gates`);
check(a.hash(a.config),'de43c1c2266364e8c859ac3abc61126590fbec2d10be9b7e0e14616770411995','exact enabled identity');
check(a.hash(a.catalogue),'17de69ffe905a28e8e00ad65d1494a003b080bcd2a894a81fea5c28351594a25','catalogue unchanged');
const schema=JSON.parse(readFileSync(new URL('coach-config.schema.json',input),'utf8'));
check([a.config.releaseScope.automaticCoachingEnabled,schema.properties.releaseScope.properties.automaticCoachingEnabled.const],[true,true],'enabled schema and config agree');
check(a.config.admission.aggregateElapsedRejection,false,'no replacement elapsed rejection');

// Replay the previously committed C2 trace, not an author-authored imitation of it.
detail.clock=[0,0.01,0.1,1].map(lag=>{
  const saved=prior.evidence.laggedTime,e=new TypingEngine({id:saved.result.id,prompts:[saved.prompt],inputMode:'flow-v1',durationMs:30000,qwerty:true,corpusVersion:'1'});
  for(const [i,event] of saved.eventTrace.entries())e.edit({start:event.position,end:event.position,text:event.char,pressTime:event.keydownTime},i===0?lag:event.inputTime);
  const end=Math.max(saved.eventTrace.at(-1).inputTime,lag+30000);e.tick(end);
  const result=e.result(saved.result.completedAt);assert.ok(result);validateResult(result);
  return {lag,clean:result.sentences.filter(s=>s.eligible).length,issue:a.runIssue(result),sourceHash:a.hash(result),...(lag===1?{result,trace:saved.eventTrace}:{} )};
});
check(detail.clock.map(x=>x.clean),[0,0,1,1],'frozen first-keydown/input deadline controls');
check(detail.clock.map(x=>x.issue),[null,null,null,null],'r2 admits all genuine clock controls');
check(detail.clock[3].sourceHash,a.hash(prior.evidence.laggedTime.result),'exact original valid counterexample bytes');
check(a.sentenceIssue(detail.clock[3].result,detail.clock[3].result.sentences[0]),null,'clock fix retains sentence guard');

const source=clone(a.at.sources[0]),clean=source.sentences.find(s=>s.eligible);
detail.guardNegatives=[];
for(const [name,mutate,expected] of [
  ['absent pair',s=>{s.pairs.zz={count:1,logSum:Math.log(200)};},'coach-pair-count'],
  ['excess count',s=>{s.pairs[Object.keys(s.pairs)[0]].count=299;},'coach-pair-count'],
  ['impossible lower log',s=>{s.pairs[Object.keys(s.pairs)[0]].logSum=-Number.MAX_SAFE_INTEGER;},'coach-log-domain'],
  ['nonfinite log',s=>{s.pairs[Object.keys(s.pairs)[0]].logSum=Infinity;},'coach-log-domain'],
  ['missing key',s=>{delete s.keys[Object.keys(s.keys)[0]];},'coach-sentence-envelope'],
]){const s=clone(clean);mutate(s);const issue=a.sentenceIssue(source,s);check(issue,expected,name+' remains rejected');detail.guardNegatives.push({name,issue});}
const forged=clone(a.at.sources);for(const r of forged)for(const s of r.sentences.filter(s=>s.eligible))s.pairs.zz={count:299,logSum:-Number.MAX_SAFE_INTEGER};forged.forEach(validateResult);
check(a.inspect(forged,a.membersFor(forged),'he').timing,false,'old fabricated complement exploit remains closed');
check(a.baseline(forged,a.membersFor(forged)).counted,10,'coach exclusions preserve participation');
const wrongAttempts=clone(source);wrongAttempts.metrics.attemptedCharacters=0;
check(a.runIssue(wrongAttempts),'coach-run-envelope','run count envelope retained');
check(a.inspect(a.uniform,a.uniformMembers,'he').timing,false,'meaningful uniform history abstains');
check([a.at.baseline.counted,a.at.profile.full.target,a.at.profile.full.reference,a.at.profile.timing],[10,28,543,true],'connected enabled qualification remains supported');
check(a.at.profile.halves.map(h=>[h.target,h.reference,h.runs]),[[10,234,5],[18,309,5]],'connected all-contributing whole-run halves');
check(a.certificate('he',a.catalogue.templates.find(t=>t.pair==='he').promptIds).pass,true,'same connected certificate');
check(a.baseline(a.at.sources,a.at.memberships,{exhausted:false}).summary,null,'cached ten cannot supply newest median');
check(a.baseline(a.at.sources,a.at.memberships,{exhausted:false}).complete,true,'ordering gap does not revoke capped milestone');
check(a.baseline(a.at.sources,a.at.memberships,{exhausted:false,newestRangeProved:true}).summary.sourceIds,a.at.baseline.ids,'explicit coherent ordering proof permits summary');

// Independent forwarding oracle over the frozen current producer. Not the future
// production finite adapter/validator: terminal result is a proposed source fixture.
const he=a.catalogue.templates.find(t=>t.pair==='he'),plan=he.promptIds.map(id=>practicePrompts.find(p=>p.id===id));
function traversal(variant='clean'){
  const e=new TypingEngine({id:'00000000-0000-4000-8000-000000999501',prompts:plan,mode:'practice',durationMs:30000,inputMode:'flow-v1',qwerty:true,corpusVersion:'1'});
  let now=1,terminal=false,forwarded=0,snapshot=null;
  const send=(text,start=e.value.length,end=start,options={})=>{
    if(terminal)return false;
    const ok=e.edit({start,end,text,pressTime:now,...options},now);forwarded++;now++;
    if(e.state==='stopped'||e.state==='aborted'||e.state==='completed'){terminal=true;snapshot=e.snapshot(now-1);}
    else if(e.submittedSummaries.length===plan.length){terminal=true;snapshot=e.snapshot(now-1);}
    return ok;
  };
  for(const [i,p] of plan.entries()){
    if(variant==='interrupted'&&i===1)e.interrupt(now);
    if(variant==='edited'&&i===0){send('x');send('',0,1);}
    if(variant==='invalid'&&i===0){send('x',0,0,{tracked:false});send('',0,1);}
    for(const char of p.text+' ')send(char);
  }
  const frozen=canon(snapshot),before=forwarded,overrun=send('x');
  check([overrun,forwarded,canon(snapshot)],[false,before,frozen],`finite ${variant} guard freezes terminal output`);
  const result={schemaId:'typeforge-finite-practice-result-v1',id:'00000000-0000-4000-8000-000000999501',owner:'guest',mode:'practice',completedAt:'2026-11-16T11:30:00.000Z',metricVersion:1,termination:'plan-exhausted',eligibleForProgress:false,
    settings:{durationMs:30000,inputMode:'flow-v1',language:'en',qwerty:true,corpusVersion:'1'},metrics:snapshot.metrics,qualityFlags:snapshot.qualityFlags,sentences:e.submittedSummaries,chartSamples:[],
    plan:{configId:a.hash(a.config),catalogueId:a.hash(a.catalogue),planHash:he.planHash,pair:'he',sentenceCount:plan.length}};
  return {result,legacyResult:e.result(result.completedAt),before,forwarded,state:e.state};
}
detail.finite={};for(const variant of ['clean','edited','interrupted','invalid']){
  const out=traversal(variant),r=out.result,m=r.metrics;
  check(out.legacyResult,null,`finite ${variant} not an early timed result`);
  check(m.wpm,m.correctCharacters*12000/m.elapsedMs,`finite ${variant} existing actual-time pace formula`);
  check(a.qualifying(r,a.membersFor([r])),false,`finite ${variant} excluded from timed evidence`);
  assert.throws(()=>validateResult(r));named.push(`finite ${variant} rejected by timed validator`);checks++;
  if(variant==='clean'){
    check([r.sentences.length,m.correctCharacters,m.elapsedMs],[12,501,512],'finite source exact plan/actual duration');
    check(m.accuracy,m.correctAttempts/m.attemptedCharacters*100,'finite accuracy retains producer formula');
  }else if(variant==='edited')check([m.deletedCharacters,r.sentences[0].eligible],[1,false],'finite edits preserve deletions and sentence exclusion');
  else if(variant==='interrupted')check(r.qualityFlags.includes('interrupted'),true,'finite interruption flag retained');
  else check([r.qualityFlags.includes('invalid-input'),m.accuracy],[true,null],'finite invalid input retains flag and diagnostic null');
  check(['practiceFocus','manualDrill','sourceAssessmentId'].some(k=>Object.hasOwn(r,k)),false,`finite ${variant} does not spoof legacy provenance`);
  detail.finite[variant]=out;
}
const prompt=assessmentPrompts[0];
detail.deadline=[-0.001,0,0.001].map(offset=>{
  const e=new TypingEngine({id:'00000000-0000-4000-8000-000000999601',prompts:[prompt],inputMode:'flow-v1',durationMs:30000,qwerty:true,corpusVersion:'1'});
  for(let i=0;i<prompt.text.length;i++)e.edit({start:i,end:i,text:prompt.text[i],pressTime:10+i},10+i);
  const end=30010+offset;e.edit({start:prompt.text.length,end:prompt.text.length,text:' ',pressTime:end},end);
  return {offset,submitted:e.submittedSummaries.length,state:e.state};
});
check(detail.deadline.map(x=>[x.submitted,x.state]),[[1,'running'],[0,'completed'],[0,'completed']],'timeout-first exact boundary precedence');
const stopped=new TypingEngine({id:'stop-probe',prompts:plan,inputMode:'flow-v1',durationMs:30000,qwerty:true,corpusVersion:'1'});stopped.edit({start:0,end:0,text:'x'.repeat(601),pressTime:1},1);
check([stopped.state,stopped.stoppedSnapshot().stopReason,stopped.result('2026-11-16T11:00:00.000Z')],['stopped','response-limit',null],'safety stop remains distinct');
const aborted=new TypingEngine({id:'abort-probe',prompts:plan,inputMode:'flow-v1',durationMs:30000,qwerty:true,corpusVersion:'1'});aborted.edit({start:0,end:0,text:'p',pressTime:1},1);aborted.abort(2);
check([aborted.state,aborted.result('2026-11-16T11:00:00.000Z')],['aborted',null],'abort remains distinct');

const practices=Array.from({length:20},(_,i)=>a.engineRun(practicePrompts,200,i+30,{mode:'practice'}));
check([...a.at.sources,...practices,...forged,...detail.clock.map(x=>x.result).filter(Boolean)].every(r=>{rootValidateResult(r);return true;}),true,'root accepted timed validator admits the same source fixtures');
assert.throws(()=>rootValidateResult(detail.finite.clean.result));named.push('root timed validator also rejects separate finite envelope');checks++;
const next=[...a.at.sources,...practices],after=a.inspect(next,a.membersFor(next),'he');
check(after.windowIds,practices.map(r=>r.id),'ordinary timed practice enters next coach window');
check([a.at.profile.timing,after.timing],[true,false],'ordinary saved practice can retire prior target');
check(a.baseline(next,a.membersFor(next)).ids,a.at.baseline.ids,'ordinary practice never replaces assessment baseline/median');
check(selectHistory(next,a.at.sources[0].settings),selectHistory(a.at.sources,a.at.sources[0].settings),'ordinary practice never enters existing assessment calibration');
check(practices.every(r=>!['practiceFocus','manualDrill','sourceAssessmentId'].some(k=>Object.hasOwn(r,k))),true,'ordinary coach-compatible timed source needs no legacy spoof');
const early=[...a.at.sources,detail.finite.clean.result];
check(a.inspect(early,a.membersFor(early),'he').windowIds,a.at.profile.windowIds,'early finite source does not enter coach window');
check(a.baseline(early,a.membersFor(early)).ids,a.at.baseline.ids,'early finite source does not enter baseline/median');
detail.feedback={before:a.at.profile,after,assessmentWitnesses:a.at.baseline.ids,ordinaryTimedIds:practices.map(r=>r.id),earlyFiniteExcluded:true};
const outputs={revision,node:process.version,checks,named,authorR2Checks:JSON.parse(readFileSync(new URL('r2-check.replayed.json',input),'utf8')).checks,
  authorRelationalChecks:JSON.parse(readFileSync(new URL('revision-check.replayed.json',input),'utf8')).checks,
  detail,limits:['No production finite adapter or new source validator implemented','Author replay is reproduction, not independent coverage','No live database, UI or actual-dose/learning test','A2 separately owns reported interface/authority/overflow seams']};
writeFileSync(new URL('results.json',here),JSON.stringify(outputs,null,2)+'\n');
console.log(JSON.stringify({checks,authorR2Checks:outputs.authorR2Checks,authorRelationalChecks:outputs.authorRelationalChecks,clock:detail.clock.map(x=>({lag:x.lag,issue:x.issue,clean:x.clean})),feedback:{beforeTarget:detail.feedback.before.full.target,afterTarget:after.full.target,beforeTiming:true,afterTiming:after.timing}},null,2));
