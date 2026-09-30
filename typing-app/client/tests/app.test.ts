import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { resolveRetest, selectHistory } from '../src/profile.ts';
import type { SessionResult, SentenceSummary } from '../src/engine.ts';

// Exercise the actual app functions without bootstrapping CSS, DOM routes or IndexedDB.
const source = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
const settings = (qwerty: boolean) => ({durationMs:60000 as const,language:'en' as const,qwerty,corpusVersion:'original-v1'});
function calibration(load: (cursor: unknown)=>Promise<SessionResult[]>) {
 const code=source.slice(source.indexOf('async function calibration('),source.indexOf('function storageNotice('));
 return runInNewContext(`${stripTypeScriptTypes(code)}; calibration`,{selectHistory,settings,listResultsPage:load,getStorageDiagnostics:()=>['read-warning']}) as (qwerty:boolean)=>Promise<{sentences:SentenceSummary[];diagnostics:string[]}>;
}
function fixture():SessionResult{return JSON.parse(readFileSync(new URL('./fixtures/legacy-v1.json',import.meta.url),'utf8'));}

test('unsupported calibration never reads history; supported sparse pages retain newest ten chronologically',async()=>{
 let reads=0;const unsupported=await calibration(async()=>{reads++;return [];})(false);
 assert.equal(reads,0);assert.equal(unsupported.sentences.length,0);
 const base=fixture();base.settings=settings(true);
 const page=(day:number,eligible:number)=>Array.from({length:100},(_,i)=>({...structuredClone(base),id:`00000000-0000-4000-8000-${String(day*1000+i).padStart(12,'0')}`,completedAt:`2026-09-${String(day).padStart(2,'0')}T12:00:00.000Z`,mode:i<eligible?'assessment' as const:'practice' as const,sentences:[{...structuredClone(base.sentences[0]),promptId:`${day}-${i}`}]}));
 const pages=[page(30,2),page(29,0),page(28,9)];reads=0;
 const supported=await calibration(async()=>pages[reads++]??[])(true);
 assert.equal(reads,3);assert.equal(supported.sentences.length,10);
 assert.deepEqual(Array.from(supported.sentences,s=>s.promptId),selectHistory(pages.flat(),settings(true)).map(s=>s.promptId));
 assert.ok(supported.diagnostics.length>0);
});

test('Restart waits for fresh calibration and focus before enabling replacement input',async()=>{
 const begin=source.indexOf("$('#restart').onclick = ")+"$('#restart').onclick = ".length;
 const end=source.indexOf('\n  prepare();\n  const initialEngine',begin);
 const handler=source.slice(begin,end).trim().replace(/;$/,'');
 let release!:(value:unknown)=>void;const pending=new Promise(resolve=>{release=resolve;});
 const old=[{promptId:'deleted'}],fresh=[{promptId:'retained'}];const log:string[]=[];
 const restart={disabled:false},input={disabled:false,value:'old',focus:()=>log.push('focus')},qwerty={checked:true,disabled:false};
 const context:any={performance:{now:()=>10},paint:()=>({state:'running'}),engine:{abort:()=>log.push('abort')},input,qwerty,
  params:new URLSearchParams(), calibration:()=>{log.push('load');return pending;},history:old,focus:{pair:'aa'},mode:'practice',sourceAssessmentId:'origin',
  buildHistory:(h:unknown)=>h,selectPracticeFocus:(h:unknown)=>{assert.equal(h,fresh);log.push('focus-selection');return null;},practicePrompts:[],artifact:null,
  choosePrompts:()=>[],makeEngine:()=>{log.push('new-engine');return {};},prepare:()=>{assert.equal(context.history,fresh);assert.equal(input.disabled,true);log.push('prepare');},
  storageNotice:()=>{},clearInterval:()=>log.push('clear-timer'),setInterval:()=>123,timer:1,restarting:false,disposed:false,restartGeneration:0,
  lastPromptKey:'old',lastState:'running',before:{},key:{},composing:true,finished:false,prompts:[],
  $:(selector:string)=>selector==='#restart'?restart:{hidden:false,textContent:''},
 };
 const run=runInNewContext(stripTypeScriptTypes(`(${handler})`),context);
 const completion=run();assert.equal(input.disabled,true);assert.equal(restart.disabled,true);assert.equal(log.includes('load'),true);
 assert.equal(context.history,old);release({sentences:fresh,diagnostics:[]});await completion;
 assert.equal(context.history,fresh);assert.equal(context.focus,null);assert.equal(input.disabled,false);assert.equal(restart.disabled,false);
 assert.ok(log.indexOf('prepare')>log.indexOf('focus-selection'));assert.equal(input.value,'');
 // A pagehide during the next load invalidates its continuation; it must never re-enable input.
 context.engine={abort:()=>log.push('abort')};let releaseNext!:(value:unknown)=>void;
 context.calibration=()=>new Promise(resolve=>{releaseNext=resolve;});
 const abandoned=run();context.disposed=true;context.restartGeneration++;
 const prepared=log.filter(item=>item==='prepare').length;
 releaseNext({sentences:[],diagnostics:[]});await abandoned;
 assert.equal(input.disabled,true);assert.equal(log.filter(item=>item==='prepare').length,prepared);
});

test('comparison rendering never exposes overflow, underflow or grouped nonfinite milliseconds',()=>{
 const code=source.slice(source.indexOf('function renderPredictionComparison('),source.indexOf('function addListRow('));
 const rows:string[]=[];const render=runInNewContext(`${stripTypeScriptTypes(code)}; renderPredictionComparison`,{
  Map,Math,Number,format:(n:number)=>String(n),$:()=>({}),addListRow:(_:unknown,_label:string,value:string)=>rows.push(value),
 });
 const result=fixture();const sentence=result.sentences[0];
 sentence.prediction={featureVersion:1,baseline:{kind:'user',version:'v1'},candidate:{modelVersion:'m1',status:'experimental'},pairs:{th:{count:1,observedLogSum:1,baselinePredictedLogSum:Number.MAX_VALUE,candidatePredictedLogSum:-Number.MAX_VALUE}}};
 result.sentences=[sentence,structuredClone(sentence)];render(result);
 assert.ok(rows[0].includes('unavailable'));assert.ok(!/Infinity|NaN|candidate 0 ms|baseline 0 ms/.test(rows[0]));
});

test('restarted retest re-resolves exact origin; deleted, incompatible or unreadable origin becomes ordinary assessment',async()=>{
 const begin=source.indexOf("$('#restart').onclick = ")+"$('#restart').onclick = ".length;
 const end=source.indexOf('\n  prepare();\n  const initialEngine',begin);
 const handler=source.slice(begin,end).trim().replace(/;$/,'');
 const oldOrigin=fixture();oldOrigin.settings=settings(true);
 for(const scenario of ['deleted','incompatible','unreadable','abandoned'] as const){
  const restart={disabled:false},intro={textContent:'English · lowercase · fresh assessment passages'};
  let readId:string|undefined;let release!:(origin:SessionResult)=>void;let announce!:()=>void;
  const readStarted=new Promise<void>(resolve=>{announce=resolve;});let newRuns=0;
  const context:any={performance:{now:()=>10},paint:()=>({state:'running'}),engine:{abort:()=>{}},input:{disabled:false,value:'typed',focus:()=>{}},qwerty:{checked:true,disabled:false},
   params:new URLSearchParams(`retest=${oldOrigin.id}`),origin:oldOrigin,originId:oldOrigin.id,sourceAssessmentId:oldOrigin.id,excluded:['old-prompt'],lineageMessage:'',mode:'assessment',
   settings,resolveRetest,assessmentPrompts:[{id:'fresh',text:'cat'}],
   getResult:async(id:string)=>{readId=id;announce();if(scenario==='unreadable')throw Error('storage blocked');if(scenario==='abandoned')return new Promise(resolve=>{release=resolve;});return scenario==='deleted'?undefined:{...oldOrigin,settings:{...oldOrigin.settings,corpusVersion:'different'}};},
   calibration:async()=>({sentences:[],diagnostics:[]}),history:[],focus:null,choosePrompts:()=>[],makeEngine:()=>{newRuns++;assert.equal(context.sourceAssessmentId,undefined);return {};},prepare:()=>{},
   storageNotice:()=>{},clearInterval:()=>{},setInterval:()=>1,timer:1,restarting:false,disposed:false,restartGeneration:0,lastPromptKey:'old',lastState:'running',before:null,key:null,composing:false,prompts:[],
   $:(selector:string)=>selector==='#restart'?restart:selector==='#exercise-intro'?intro:{hidden:false,textContent:''},
  };
  const run=runInNewContext(stripTypeScriptTypes(`(${handler})`),context);
  const completion=run();
  if(scenario==='abandoned'){
   await readStarted;context.disposed=true;context.restartGeneration++;release(oldOrigin);await completion;
   assert.equal(newRuns,0);assert.equal(context.input.disabled,true);assert.equal(context.origin,oldOrigin);
  }else{
   await completion;assert.equal(readId,oldOrigin.id,scenario);assert.equal(context.sourceAssessmentId,undefined,scenario);assert.equal(context.excluded.length,0,scenario);
   assert.match(context.lineageMessage,/New assessment:/);assert.ok(!intro.textContent.includes('fresh assessment'));assert.equal(newRuns,1);
  }
 }
});
