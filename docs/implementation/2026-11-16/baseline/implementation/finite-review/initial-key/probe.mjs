// Narrow independent reacceptance of the initial-key guard. Read-only root argument.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
if(!process.argv[2])throw new Error('Pass read-only root checkout');
const sourceRoot=resolve(process.argv[2]),revision='ca94e23667d80de2a5a4c939cbc03559662cf5a6';
const git=(...args)=>execFileSync('git',args,{cwd:sourceRoot,windowsHide:true}),sha=x=>createHash('sha256').update(x).digest('hex');
const oldPath='docs/implementation/2026-11-16/baseline/implementation/finite-review/results.json';
const oldBytes=git('show',`560dc6b:${oldPath}`),old=JSON.parse(oldBytes),paths=Object.keys(old.sourceBefore);
const validatorPath='typing-app/client/src/finite-practice-result.ts';
function proof(){return Object.fromEntries(paths.map(path=>{
  const actual=readFileSync(join(sourceRoot,path)),expected=git('show',`${revision}:${path}`),blob=git('rev-parse',`${revision}:${path}`).toString().trim();
  assert.equal(actual.toString().replace(/\r\n/g,'\n'),expected.toString().replace(/\r\n/g,'\n'),'source drift '+path);
  assert.equal(blob,path===validatorPath?'a1ea3f4c3d359ad3973ec8f6ba1b03111e88b9c7':old.sourceBefore[path].blob,'unexpected dependency change '+path);
  return[path,{blob,rawSha256:sha(actual),lfSha256:sha(actual.toString().replace(/\r\n/g,'\n'))}];
}));}
const before=proof(),headBefore=git('rev-parse','HEAD').toString().trim();
const load=n=>import(pathToFileURL(join(sourceRoot,'typing-app/client/src',n)));
const {createFiniteAdapter}=await load('finite-practice.ts');
const {validateFinitePracticeResult}=await load('finite-practice-result.ts');
const {resolveCertifiedPlan,CONFIG_ID}=await load('coach-plan.ts');
let checks=0;const named=[],detail={};const check=(name,actual,expected)=>{assert.deepEqual(actual,expected,name);checks++;named.push(name);};
const clone=x=>structuredClone(x),when='2026-11-18T12:00:00.000Z';
const oldSource=old.observations.emptyKeyEnvelope.source;
let originalError;
try{validateFinitePracticeResult(oldSource,resolveCertifiedPlan('he'));}catch(e){originalError=e.message;}
check('exact frozen original payload rejects at initial key',/sentences\[0\]\.initial key/.test(originalError??''),true);
detail.original={payloadSha256:sha(JSON.stringify(oldSource)),fixtureSha256:sha(oldBytes),fixtureCommit:'560dc6bec407d52d6cc5a908292849b8b06772ed',error:originalError};
function finish(pair,variant){
  const plan=resolveCertifiedPlan(pair),snapshot={schemaId:'typeforge-practice-snapshot-v2',policyId:'clean-pair-contrast-v1-r2-enabled',configId:CONFIG_ID,actualExposure:null,focus:{pair},plan};
  const adapter=createFiniteAdapter({id:'00000000-0000-4000-8000-000000001002',snapshot});let now=100;
  for(const [index,p]of plan.prompts.entries()){
    if(index===0&&variant==='reverse')for(const text of [...p.text].reverse())adapter.edit({start:0,end:0,text,pressTime:now},now++);
    else for(const [i,text]of [...p.text].entries()){
      let start=adapter.tick(now).engine.value.length;
      if(index===0&&i===0&&variant==='edited'){
        adapter.edit({start,end:start,text:'x',pressTime:now},now++);
        adapter.edit({start,end:start+1,text:'',pressTime:now},now++);
      }
      start=adapter.tick(now).engine.value.length;
      adapter.edit({start,end:start,text,pressTime:now,...(index===0&&i===0?{repeat:variant==='repeat',tracked:variant!=='invalid'}:{})},now++);
    }
    const start=adapter.tick(now).engine.value.length;adapter.edit({start,end:start,text:' ',pressTime:now},now++);
  }
  return{plan,source:adapter.result(when)};
}
detail.plans=[];
for(const pair of ['he','in','le','th']){
  const record={pair,traces:[],missingFirst:null};
  for(const variant of ['reverse','edited','invalid','repeat']){
    const {source,plan}=finish(pair,variant),first=source.sentences[0];
    check(`${pair} genuine ${variant} producer validates`,validateFinitePracticeResult(source,plan),source);
    if(variant==='reverse')check(`${pair} reverse permits only first expected key`,Object.keys(first.keys),[first.promptText[0]]);
    record.traces.push({variant,firstKey:first.promptText[0],recordedKeys:Object.keys(first.keys),flags:first.qualityFlags,sourceHash:sha(JSON.stringify(source))});
    if(variant==='repeat'){
      const corrupt=clone(source),initial=corrupt.sentences[0].promptText[0];
      corrupt.metrics.correctAttempts-=corrupt.sentences[0].keys[initial].correct;
      delete corrupt.sentences[0].keys[initial];
      corrupt.metrics.accuracy=corrupt.metrics.correctAttempts/corrupt.metrics.attemptedCharacters*100;
      corrupt.chartSamples.at(-1).accuracy=corrupt.metrics.accuracy;
      check(`${pair} coherent corruption retains other key accounting`,Object.keys(corrupt.sentences[0].keys).length>0,true);
      let error;try{validateFinitePracticeResult(corrupt,plan);}catch(e){error=e.message;}
      check(`${pair} coherent missing-first key rejects at guard`,/sentences\[0\]\.initial key/.test(error??''),true);
      record.missingFirst={removedKey:initial,error,remainingKeys:Object.keys(corrupt.sentences[0].keys),sourceHash:sha(JSON.stringify(corrupt)),...(pair==='he'?{source:corrupt}:{})};
    }
  }
  detail.plans.push(record);
}
const after=proof();check('all reviewed blobs/raw bytes stable before and after',after,before);
const output={verdict:'APPROVE',scope:'narrow initial-key finding reacceptance',revision,sourceRoot,headBefore,headAfter:git('rev-parse','HEAD').toString().trim(),node:process.version,checks,named,detail,sourceBefore:before,sourceAfter:after,limits:['Synthetic already-admitted adapter fixtures, not admission proof','No browser/build/full matrix rerun','Original REVISE remains frozen','C/D/F and actual-Claude integration remain outside this reacceptance']};
writeFileSync(new URL('results.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({checks,originalError,plans:detail.plans.map(p=>({pair:p.pair,initial:p.missingFirst.removedKey,error:p.missingFirst.error,realTraces:p.traces.length})),revision},null,2));
