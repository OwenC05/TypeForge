import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHistory, appendHistory, selectPracticeFocus, selectDrillPrompts, resolveRetest, compatibleSettings, compatible, supportedManualPairs } from '../src/profile.ts';
import { assessmentPrompts, practicePrompts, shufflePrompts } from '../src/corpus.ts';
import { parseModelArtifact, predictSentence } from '../src/model.ts';
import { TypingEngine, type SentenceSummary } from '../src/engine.ts';
const sentence: SentenceSummary={promptId:'s',promptText:'aa',response:'aa',submitted:true,eligible:true,diagnosticsAvailable:true,qualityFlags:[],keys:{},pairs:{aa:{count:8,logSum:48},bb:{count:8,logSum:32}}};
test('history copies eligible summaries and rolls to ten',()=>{
 const list=appendHistory(Array(10).fill(sentence),sentence); assert.equal(list.length,10);
 const h=buildHistory(list); assert.equal(h.count,160); list[0].pairs.aa.count=99; assert.equal(h.pairs.aa.count,80);
 assert.equal(buildHistory([{...sentence,eligible:false}]).count,0);
});
test('baseline-only focus requires evidence and bank support, with two target then general cadence',()=>{
 const bank=[{id:'a',text:'aa'},{id:'b',text:'aa aa'},{id:'c',text:'aa bb'},{id:'d',text:'bb'}];
 const history={count:16,logSum:80,pairs:{aa:{count:8,logSum:48},bb:{count:8,logSum:32}}};
 // Observed-user fallback cannot invent a positive pair-specific effect.
 assert.equal(selectPracticeFocus(history,bank,null),null);
 const focus={pair:'aa',evidenceCount:8,source:'baseline' as const,baselineVersion:'v1',score:1};
 const prompts=selectDrillPrompts(focus,bank); assert.ok(prompts[0].text.includes('aa'));assert.ok(prompts[1].text.includes('aa'));assert.equal(prompts[2].text,'bb');
 for(let i=1;i<prompts.length;i++)assert.notEqual(prompts[i].id,prompts[i-1].id);
});
test('missing origin is explicitly a new assessment',()=>assert.equal(resolveRetest(null,{durationMs:60000,language:'en',qwerty:true,corpusVersion:'1'},[]).kind,'new-assessment'));

import {selectHistory} from '../src/profile.ts';
import type {SessionResult} from '../src/engine.ts';
import {readFileSync} from 'node:fs';
function result():SessionResult{return JSON.parse(readFileSync(new URL('./fixtures/legacy-v1.json',import.meta.url),'utf8'));}
test('history excludes practice and incompatible runs but keeps earlier eligible evidence in interrupted assessment',()=>{
 const r=result();r.settings.qwerty=true;r.sentences=Array.from({length:12},(_,i)=>({...structuredClone(sentence),promptId:`s${i}`}));
 const practice={...r,mode:'practice' as const};const incompatible={...r,settings:{...r.settings,corpusVersion:'other'}};
 r.qualityFlags=['interrupted'];r.eligibleForProgress=false;r.sentences[11].eligible=false;
 const selected=selectHistory([practice,incompatible,r],r.settings);assert.equal(selected.length,10);assert.equal(selected[0].promptId,'s1');assert.equal(selected[9].promptId,'s10');
 r.sentences[10].pairs.aa.count=99;assert.notEqual(selected[9].pairs.aa.count,99);
});
test('retest resolves exact origin, excludes partial prompts, fails on deleted/incompatible/exhausted origin',()=>{
 const r=result();r.settings.qwerty=true;r.sentences=[{...structuredClone(sentence),promptId:'used'},{...structuredClone(sentence),promptId:'partial',submitted:false,eligible:false}];
 const bank=[{id:'used',text:'aa'},{id:'partial',text:'bb'},{id:'fresh',text:'cc'}];
 assert.deepEqual(resolveRetest(r,r.settings,bank),{kind:'retest',sourceAssessmentId:r.id,excludedPromptIds:['used','partial']});
 assert.equal(resolveRetest(r,r.settings,bank.slice(0,2)).kind,'new-assessment');
 assert.equal(resolveRetest(r,{...r.settings,corpusVersion:'other'},bank).kind,'new-assessment');
 r.eligibleForProgress=false;assert.equal(resolveRetest(r,r.settings,bank).kind,'new-assessment');
});
test('selected smoothed baseline score, evidence threshold and alphabetical tie are exact',()=>{
 const h={count:32,logSum:160,pairs:{aa:{count:8,logSum:48},bb:{count:8,logSum:48},cc:{count:16,logSum:64}}};
 const bank=['aa bb','aa bb','aa bb'].map((text,i)=>({id:String(i),text}));
 const artifact={baseline:{kind:'smoothed-pair',version:'b1',k:1},populationMeanLogMs:5} as import('../src/model.ts').ModelArtifact;
 const focus=selectPracticeFocus(h,bank,artifact);assert.equal(focus?.pair,'aa');assert.equal(focus?.score,((48+5)/9-5)*3);assert.equal(focus?.source,'baseline');
 assert.equal(selectPracticeFocus(h,bank.slice(0,2),artifact),null);h.pairs.aa.count=7;assert.equal(selectPracticeFocus(h,bank,artifact)?.pair,'bb');
});

test('completion ties use stable IDs and within-run order, deletion changes only new snapshots',()=>{
 const first=result();first.settings.qwerty=true;first.id='00000000-0000-4000-8000-000000000001';first.sentences=[{...structuredClone(sentence),promptId:'first'}];
 const second=structuredClone(first);second.id='00000000-0000-4000-8000-000000000002';second.sentences=[{...structuredClone(sentence),promptId:'second-1'},{...structuredClone(sentence),promptId:'second-2'}];
 const snapshot=selectHistory([second,first],first.settings);assert.deepEqual(snapshot.map(s=>s.promptId),['first','second-1','second-2']);
 assert.deepEqual(selectHistory([first],first.settings).map(s=>s.promptId),['first']);assert.equal(snapshot.length,3);
});

test('settings compatibility isolates every duration and flow from unchanged legacy records',()=>{
 const legacy=result();const before=structuredClone(legacy);
 assert.equal(compatibleSettings(legacy.settings,{...legacy.settings}),true);
 for(const durationMs of [15000,30000,60000,120000] as const){
  const settings={...legacy.settings,inputMode:'flow-v1' as const,durationMs};
  assert.equal(compatibleSettings(legacy.settings,settings),false);
  assert.equal(compatibleSettings(settings,legacy.settings),false);
  for(const other of [15000,30000,60000,120000] as const){
   assert.equal(compatibleSettings(settings,{...settings,durationMs:other}),durationMs===other);
  }
  for(const changed of [{qwerty:false},{corpusVersion:'other'},{language:'fr'}]){
   assert.equal(compatibleSettings(settings,{...settings,...changed} as SessionResult['settings']),false);
  }
 }
 assert.deepEqual(legacy,before);assert.equal(Object.hasOwn(legacy.settings,'inputMode'),false);
});

test('history and retest share mode, duration, layout, corpus and version compatibility',()=>{
 const origin=result();origin.settings.inputMode='flow-v1';origin.sentences=[structuredClone(sentence)];
 const bank=[{id:'s',text:'aa'},{id:'fresh',text:'bb'}];
 assert.equal(compatible(origin,origin.settings),true);
 const incompatibleRuns=[
  {...origin,settings:{...origin.settings,inputMode:undefined}},
  {...origin,settings:{...origin.settings,durationMs:30000 as const}},
  {...origin,settings:{...origin.settings,qwerty:false}},
  {...origin,settings:{...origin.settings,corpusVersion:'other'}},
  {...origin,schemaVersion:2} as unknown as SessionResult,
  {...origin,metricVersion:2} as unknown as SessionResult,
  {...origin,mode:'practice' as const},
 ];
 for(const run of incompatibleRuns){
  assert.equal(selectHistory([run],origin.settings).length,0);
  const fallback=resolveRetest(run,origin.settings,bank);
  assert.equal(fallback.kind,'new-assessment');
  if(fallback.kind==='new-assessment')assert.ok(fallback.reason);
 }
 assert.equal(selectHistory([origin],origin.settings).length,1);
 assert.equal(resolveRetest(origin,origin.settings,bank).kind,'retest');
 assert.equal(selectHistory([origin],{...origin.settings,qwerty:false}).length,0);
});

test('flow history retains only eligible submitted sentences after later interruption',()=>{
 const origin=result();origin.settings.inputMode='flow-v1';origin.settings.durationMs=30000;
 origin.eligibleForProgress=false;origin.qualityFlags=['interrupted'];
 origin.sentences=[structuredClone(sentence),{...structuredClone(sentence),promptId:'bad',eligible:false},
  {...structuredClone(sentence),promptId:'partial',submitted:false,eligible:false}];
 assert.deepEqual(selectHistory([origin],origin.settings).map(s=>s.promptId),['s']);
 assert.equal(resolveRetest(origin,origin.settings,[{id:'fresh',text:'bb'}]).kind,'new-assessment');
});

test('legacy origin falls back for flow retest, while flow excludes every active partial ID',()=>{
 const origin=result();const settings={...origin.settings,inputMode:'flow-v1' as const};
 const bank=[{id:'legacy-cat',text:'cat'},{id:'partial',text:'aa'},{id:'fresh',text:'bb'}];
 assert.equal(resolveRetest(origin,settings,bank).kind,'new-assessment');
 origin.settings=settings;
 origin.sentences.push({...structuredClone(sentence),promptId:'partial',submitted:false,eligible:false});
 assert.deepEqual(resolveRetest(origin,settings,bank),{kind:'retest',sourceAssessmentId:origin.id,excludedPromptIds:['legacy-cat','partial']});
 assert.equal(resolveRetest(origin,settings,bank.slice(0,2)).kind,'new-assessment');
});

test('manual catalogue requires three distinct passages, not occurrences or cross-word pairs',()=>{
 const bank=[{id:'a',text:'aa aa bb'},{id:'a',text:'aa bb'},{id:'b',text:'aa bb'},{id:'c',text:'aa bb'},{id:'d',text:'cc cc cc'}];
 assert.deepEqual(supportedManualPairs(bank),['aa','bb']);
 assert.deepEqual(supportedManualPairs(bank.slice(0,3)),[]);
 const counts=new Map<string,Set<string>>();
 for(const prompt of practicePrompts){
  for(const word of prompt.text.split(' '))for(let i=1;i<word.length;i++){
   const pair=word.slice(i-1,i+1);if(!counts.has(pair))counts.set(pair,new Set());counts.get(pair)!.add(prompt.id);
  }
 }
 const expected=[...counts].filter(([,ids])=>ids.size>=3).map(([pair])=>pair).sort();
 assert.ok(expected.length>0);assert.deepEqual(supportedManualPairs(practicePrompts),expected);
});

test('manual and recommended drills share finite cadence and adjacent-repeat avoidance',()=>{
 const bank=[{id:'a',text:'aa'},{id:'b',text:'aa aa'},{id:'c',text:'aa bb'},{id:'d',text:'bb'}];
 const recommended={pair:'aa',evidenceCount:8,source:'baseline' as const,baselineVersion:'v1',score:1};
 for(const focus of [{pair:'aa'},recommended]){
  const prompts=selectDrillPrompts(focus,bank);assert.equal(prompts.length,120);
  for(let i=0;i<prompts.length;i++){
   assert.equal(prompts[i].text.includes('aa'),i%3!==2);
   if(i>0)assert.notEqual(prompts[i].id,prompts[i-1].id);
  }
  const onlyTargets=selectDrillPrompts(focus,bank.slice(0,3));assert.equal(onlyTargets.length,120);
  for(let i=1;i<onlyTargets.length;i++)assert.notEqual(onlyTargets[i].id,onlyTargets[i-1].id);
 }
 assert.equal(selectDrillPrompts({pair:'cc'},bank).length,bank.length);
 assert.equal(selectDrillPrompts(null,bank).length,bank.length);
});

test('warm no-artifact history supports baseline-only predictions, never a recommendation',()=>{
 const history=buildHistory([sentence]);
 const bank=[{id:'a',text:'aa'},{id:'b',text:'aa aa'},{id:'c',text:'aa bb'}];
 assert.equal(selectPracticeFocus(history,bank,null),null);
 const prediction=predictSentence('aa bb',history,null);
 assert.equal(prediction.status,'baseline-only');assert.equal(prediction.predictions?.candidate,undefined);
 assert.ok(prediction.predictions?.occurrences.length);
 for(const occurrence of prediction.predictions!.occurrences){
  assert.equal(occurrence.baselineLogMs,history.logSum/history.count);
  assert.equal(occurrence.candidateLogMs,undefined);
 }
 assert.equal(predictSentence('aa',buildHistory([]),null).status,'unavailable');
});

const focusArtifact = parseModelArtifact(JSON.parse(readFileSync(new URL('../src/generated/model.json', import.meta.url), 'utf8')));
const focusBank = [0, 1, 2].map(i => ({id:String(i),text:'aa bb'}));

function uniformSummary(prompt: {id:string; text:string}, interval: number, multiply = false): SentenceSummary {
 const pairs: SentenceSummary['pairs'] = {};
 for (const word of prompt.text.split(' ')) for (let i = 1; i < word.length; i++) {
  const pair = word.slice(i - 1, i + 1);
  const stats = pairs[pair] ??= {count:0,logSum:0};
  stats.count++; stats.logSum += Math.log(interval);
 }
 if (multiply) for (const stats of Object.values(pairs)) stats.logSum = stats.count * Math.log(interval);
 return {...structuredClone(sentence),promptId:prompt.id,promptText:prompt.text,response:prompt.text,pairs};
}

test('actual engine ten-sentence constant-200-ms history abstains in original and permuted orders',()=>{
 const engine = new TypingEngine({id:'synthetic-uniform',qwerty:true,inputMode:'flow-v1',durationMs:120000,prompts:assessmentPrompts});
 let time = 0;
 for (const prompt of assessmentPrompts.slice(0,10)) for (const text of prompt.text + ' ') {
  time += 200;
  assert.equal(engine.edit({start:engine.value.length,end:engine.value.length,text,pressTime:time},time),true);
 }
 const summaries = engine.submittedSummaries;
 assert.equal(summaries.length,10); assert.ok(summaries.every(s=>s.eligible && s.submitted));
 assert.equal(buildHistory(summaries).count,284);
 for (const list of [summaries,[...summaries].reverse(),[...summaries.slice(3),...summaries.slice(0,3)]]) {
  assert.equal(selectPracticeFocus(buildHistory(list),practicePrompts,focusArtifact),null);
 }
});

test('seeded uniform histories abstain across sentence, pair-entry and summation orders',()=>{
 for (const initialSeed of [1,20261115,0xdeadbeef]) {
  let seed = initialSeed;
  const random = () => ((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for (let sample=0; sample<64; sample++) for (const interval of [Number.MIN_VALUE,0.25,1,200,5000]) {
   const summaries = shufflePrompts(assessmentPrompts,random).slice(0,10).map(p=>uniformSummary(p,interval,sample%2===0));
   const reversed = [...summaries].reverse().map(s=>({...s,pairs:Object.fromEntries(Object.entries(s.pairs).reverse())}));
   const randomOrder = shufflePrompts(summaries.map(s=>({id:s.promptId,text:s.promptText})),random)
    .map(p=>summaries.find(s=>s.promptId===p.id)!);
   for (const list of [summaries,reversed,randomOrder]) {
    assert.equal(selectPracticeFocus(buildHistory(list),practicePrompts,focusArtifact),null,`seed=${initialSeed}, sample=${sample}, interval=${interval}`);
   }
  }
 }
});

test('maximum supported ten-sentence accumulation abstains at both log bounds',()=>{
 for (const interval of [Number.MIN_VALUE,200,5000]) {
  const summaries = Array.from({length:10},(_,i)=>uniformSummary({id:String(i),text:'a'.repeat(300)},interval));
  const history = buildHistory(summaries);
  assert.equal(history.count,2990); assert.equal(history.pairs.aa.count,2990);
  for (const k of [1,5,20]) {
   const artifact = {...focusArtifact,baseline:{...focusArtifact.baseline,k}};
   assert.equal(selectPracticeFocus(history,focusBank,artifact),null);
  }
 }
});

test('numerical boundary is inclusive before occurrence weighting and admits larger differences',()=>{
 // Independent evaluation of the documented 3308-operation, two-mean bound.
 const u = Number.EPSILON/2;
 const gamma = (300+2990+10+8)*u/(1-(300+2990+10+8)*u);
 const tolerance = 2*gamma*Math.abs(Math.log(Number.MIN_VALUE));
 const history = {count:16,logSum:0,pairs:{aa:{count:8,logSum:0},bb:{count:8,logSum:0}}};
 for (const multiplier of [0,0.5,1,2]) {
  const artifact = {...focusArtifact,populationMeanLogMs:tolerance*multiplier,baseline:{kind:'population' as const,version:'boundary',k:0}};
  for (const text of ['aa','aa '.repeat(100).trim()]) {
   const bank = [0,1,2].map(i=>({id:String(i),text}));
   const focus = selectPracticeFocus(history,bank,artifact);
   if (multiplier<=1) assert.equal(focus,null);
   else { assert.equal(focus?.pair,'aa'); assert.equal(focus?.score,tolerance*multiplier*3*(text==='aa'?1:100)); }
  }
 }
 const smallContrast = {count:16,logSum:80,pairs:{aa:{count:8,logSum:40+8e-8},bb:{count:8,logSum:40-8e-8}}};
 for (const k of [1,5,20]) {
  const artifact = {...focusArtifact,baseline:{...focusArtifact.baseline,k}};
  assert.equal(selectPracticeFocus(smallContrast,focusBank,artifact)?.pair,'aa');
 }
 assert.equal(selectPracticeFocus(smallContrast,focusBank,null),null);
 assert.equal(selectPracticeFocus(smallContrast,focusBank,{...focusArtifact,baseline:{kind:'user',version:'user',k:0}}),null);
 const malformed = structuredClone(focusArtifact); malformed.coefficients[0]=NaN;
 assert.throws(()=>parseModelArtifact(malformed));
});
