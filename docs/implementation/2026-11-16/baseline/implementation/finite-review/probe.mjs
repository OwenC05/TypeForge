// Independent finite implementation review. Read-only source root is required.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const sourceRoot=resolve(process.argv[2]??'');
if(!process.argv[2])throw new Error('Pass the read-only root checkout path');
const revision='1d80934',git=(...args)=>execFileSync('git',args,{cwd:sourceRoot,windowsHide:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const files=['engine.ts','finite-practice.ts','finite-practice-result.ts','coach-plan.ts','coach-types.ts','model.ts','profile.ts','corpus.ts','storage.ts','coach-config.json','coach-catalogue.json'].map(n=>'typing-app/client/src/'+n);
const lf=b=>b.toString('utf8').replace(/\r\n/g,'\n');
function sourceProof(){return Object.fromEntries(files.map(path=>{const actual=readFileSync(join(sourceRoot,path)),frozen=git('show',`${revision}:${path}`);assert.equal(lf(actual),lf(frozen),'source drift '+path);return[path,{blob:git('rev-parse',`${revision}:${path}`).toString().trim(),rawSha256:sha(actual),lfSha256:sha(lf(actual))}];}));}
const before=sourceProof(),sourceHeadBefore=git('rev-parse','HEAD').toString().trim();
const load=name=>import(pathToFileURL(join(sourceRoot,'typing-app/client/src',name)));
const {TypingEngine}=await load('engine.ts');
const {createFiniteAdapter}=await load('finite-practice.ts');
const {validateFinitePracticeResult}=await load('finite-practice-result.ts');
const {resolveCertifiedPlan,CONFIG_ID,deepFreeze}=await load('coach-plan.ts');
const {validateResult}=await load('storage.ts');
const {selectHistory}=await load('profile.ts');
let checks=0;const named=[],observations={},failures=[];
function check(name,actual,expected){assert.deepEqual(actual,expected,name);named.push(name);checks++;}
function rejects(name,fn){assert.throws(fn,undefined,name);named.push(name);checks++;}
const clone=x=>structuredClone(x),when='2026-11-18T12:00:00.000Z',id='00000000-0000-4000-8000-000000001001';
// Adapter seam input only: synthetic prior admission, no fabricated storage-proof claim.
function snapshot(pair){const plan=clone(resolveCertifiedPlan(pair));return{schemaId:'typeforge-practice-snapshot-v2',policyId:'clean-pair-contrast-v1-r2-enabled',configId:CONFIG_ID,actualExposure:null,focus:{pair},plan};}
function finish(pair,variant='clean',finalAt){
  const input=snapshot(pair),adapter=createFiniteAdapter({id,snapshot:input});let time=100;
  for(const [s,p] of input.plan.prompts.entries()){
    if(s===0&&variant==='reverse'){
      for(const text of [...p.text].reverse())adapter.edit({start:0,end:0,text,pressTime:time},time++);
      const pos=adapter.tick(time).engine.value.length;adapter.edit({start:pos,end:pos,text:' ',pressTime:time},time++);continue;
    }
    for(const [i,char] of [...p.text].entries()){
      let pos=adapter.tick(time).engine.value.length;
      if(s===0&&i===p.text.length-1&&variant==='outside-edit'){
        adapter.edit({start:pos,end:pos,text:'x',pressTime:time},time++);
        adapter.edit({start:pos,end:pos+1,text:'',pressTime:time},time++);pos=adapter.tick(time).engine.value.length;
      }
      const extra=s===0&&i===0?variant==='missing'?{pressTime:undefined}:variant==='invalid'?{tracked:false}:variant==='malformed'?{pressTime:-1}:variant==='repeat'?{repeat:true}:{}:{};
      adapter.edit({start:pos,end:pos,text:char,pressTime:time,...extra},time++);
      if(s===0&&i===0&&variant==='interrupted')adapter.interrupt(time++);
    }
    const pos=adapter.tick(time).engine.value.length,last=s===input.plan.prompts.length-1;
    if(last&&finalAt!==undefined)time=finalAt;
    adapter.edit({start:pos,end:pos,text:' ',pressTime:time},time++);
  }
  return{adapter,input,time,source:adapter.result(when)};
}
const cleanSources={};
for(const pair of ['he','in','le','th']){
  const r=finish(pair),s=r.source,terminal=r.adapter.tick(r.time);
  check(`${pair} finite terminal/count/last context`,[terminal.terminal,terminal.completedSentences,terminal.next,terminal.engine.prompt.id],['plan-exhausted',12,null,r.input.plan.prompts.at(-1).id]);
  check(`${pair} exact plan`,s.sentences.map(x=>[x.promptId,x.promptText]),r.input.plan.prompts.map(p=>[p.id,p.text]));
  check(`${pair} actual formulas`,[s.metrics.wpm,s.metrics.accuracy],[s.metrics.correctCharacters*12000/s.metrics.elapsedMs,s.metrics.correctAttempts/s.metrics.attemptedCharacters*100]);
  check(`${pair} producer validates`,validateFinitePracticeResult(s,r.input.plan),s);
  rejects(`${pair} excluded by timed validator`,()=>validateResult(s));
  const copy=clone(s);s.metrics.wpm=-1;s.sentences[0].response='mutation';
  check(`${pair} returned source defensive`,r.adapter.result(when),copy);
  r.adapter.edit({start:0,end:0,text:'x',pressTime:100000},100000);r.adapter.abort(100001);r.adapter.interrupt(100002);
  check(`${pair} terminal after edit/abort/interrupt/tick immutable`,r.adapter.tick(100003),terminal);
  cleanSources[pair]=copy;
}
for(const offset of [-0.0001,0,0.0001]){
  const r=finish('he','clean',30100+offset),state=r.adapter.tick(r.time);
  check(`deadline ${offset} terminal/completed count`,[state.terminal,state.completedSentences],[offset<0?'plan-exhausted':'timeout',offset<0?12:11]);
  if(offset>=0){validateResult(r.source);check(`deadline ${offset} unfinished timed source`,[r.source.metrics.elapsedMs,r.source.sentences.at(-1).submitted],[30000,false]);}
}
for(const variant of ['outside-edit','reverse','missing','invalid','malformed','repeat','interrupted']){
  const r=finish('he',variant);try{validateFinitePracticeResult(r.source,r.input.plan);check(`real ${variant} output accepted`,true,true);}catch(e){failures.push({name:'real producer '+variant,error:e.message,source:r.source});}
}
// Declared terminal counts are submitted sentences, not active/unfinished summaries.
for(const kind of ['aborted','stopped']){
  const a=createFiniteAdapter({id,snapshot:snapshot('he')});a.edit({start:0,end:0,text:'t',pressTime:100},100);
  if(kind==='aborted')a.abort(101);else a.edit({start:1,end:1,text:'x'.repeat(601),pressTime:101},101);
  const terminal=a.tick(102);check(`${kind} state and completed count`,[terminal.terminal,terminal.completedSentences,a.result(when)],[kind,0,null]);
  a.edit({start:0,end:0,text:'x',pressTime:103},103);a.interrupt(104);a.abort(105);check(`${kind} frozen terminal`,a.tick(106),terminal);
}
const input=snapshot('he'),ad=createFiniteAdapter({id,snapshot:input});input.plan.prompts[0].text='mutated';
check('adapter owns copied plan',ad.tick(0).engine.prompt.text,resolveCertifiedPlan('he').prompts[0].text);
const already=Object.freeze({child:{nested:{x:1}}});deepFreeze(already);check('shared deepFreeze descends through frozen parent',Object.isFrozen(already.child.nested),true);
// Minimal shape/domain/relational negatives; do not recreate the full author suite.
const plan=resolveCertifiedPlan('he'),base=cleanSources.he;
for(const [name,mutate] of [
  ['extra legacy provenance',r=>{r.manualDrill={pair:'he',source:'manual'};}],
  ['future wrong plan hash',r=>{r.plan.planHash='0'.repeat(64);}],
  ['wrong actual arithmetic',r=>{r.metrics.wpm+=1;}],
  ['bad calendar UTC',r=>{r.completedAt='2026-02-30T12:00:00.000Z';}],
  ['zero elapsed',r=>{r.metrics.elapsedMs=0;}],
  ['fractional attempts',r=>{r.metrics.attemptedCharacters+=0.1;}],
  ['excess pair count',r=>{Object.values(r.sentences[0].pairs)[0].count=299;}],
  ['missing clean key',r=>{delete r.sentences[0].keys[Object.keys(r.sentences[0].keys)[0]];}],
  ['chart final mismatch',r=>{r.chartSamples.at(-1).wpm+=1;}],
  ['sparse sentence array',r=>{delete r.sentences[0];}],
]){const r=clone(base);mutate(r);rejects(name,()=>validateFinitePracticeResult(r,plan));}
// An ineligible sentence must still have producer key accounting. Check the
// necessary nonempty key case independently rather than trusting shape-only flags.
const corrupt=clone(finish('he','repeat').source);
corrupt.metrics.correctAttempts-=Object.values(corrupt.sentences[0].keys).reduce((n,k)=>n+k.correct,0);
corrupt.sentences[0].keys={};
corrupt.metrics.accuracy=corrupt.metrics.correctAttempts/corrupt.metrics.attemptedCharacters*100;
corrupt.chartSamples.at(-1).accuracy=corrupt.metrics.accuracy;
try{const accepted=validateFinitePracticeResult(corrupt,plan);observations.emptyKeyEnvelope={accepted:true,source:accepted};}
catch(e){observations.emptyKeyEnvelope={accepted:false,error:e.message};}
check('reproduce impossible missing first-position key acceptance',observations.emptyKeyEnvelope.accepted,true);
const reverse=finish('he','reverse').source;
observations.validReverse={firstPrompt:reverse.sentences[0].promptText,recordedKeys:Object.keys(reverse.sentences[0].keys),flags:reverse.sentences[0].qualityFlags};
check('source discrimination excludes finite calibration',selectHistory([base].filter(x=>!('schemaId'in x)),base.settings),[]);
const timed=new TypingEngine({id,prompts:[{id:'a',text:'a'},{id:'b',text:'b'}],inputMode:'flow-v1',durationMs:30000});
for(const [i,text]of [...'a b a '].entries())timed.edit({start:timed.value.length,end:timed.value.length,text,pressTime:i+1},i+1);
check('ordinary timed engine still wraps',[timed.state,timed.submittedSummaries.length,timed.prompt.id],['running',3,'b']);
const after=sourceProof();check('read-only relevant source before/after',after,before);
const result={revision:git('rev-parse',revision).toString().trim(),sourceRoot,sourceHeadBefore,sourceHeadAfter:git('rev-parse','HEAD').toString().trim(),otherSourceChangesSincePin:git('diff','--name-only',revision,'HEAD','--','typing-app/client/src').toString().trim().split('\n').filter(Boolean),node:process.version,checks,named,failures,observations,sourceBefore:before,sourceAfter:after,limits:['No storage/UI/full-policy acceptance','Adapter snapshots are synthetic already-admitted fixtures','No author assertion counts treated as independent','No root file writes/build/server']};
writeFileSync(new URL('results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({checks,failures:failures.map(x=>({name:x.name,error:x.error})),emptyKeysAccepted:observations.emptyKeyEnvelope.accepted,revision:result.revision},null,2));
