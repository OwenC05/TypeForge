import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHistory, appendHistory, resolveRetest, compatibleSettings, compatible } from '../src/profile.ts';
import { assessmentPrompts, practicePrompts, shufflePrompts } from '../src/corpus.ts';
import { parseModelArtifact, predictSentence } from '../src/model.ts';
import { TypingEngine, type SentenceSummary } from '../src/engine.ts';
const sentence: SentenceSummary={promptId:'s',promptText:'aa',response:'aa',submitted:true,eligible:true,diagnosticsAvailable:true,qualityFlags:[],keys:{},pairs:{aa:{count:8,logSum:48},bb:{count:8,logSum:32}}};
test('history copies eligible summaries and rolls to ten',()=>{
 const list=appendHistory(Array(10).fill(sentence),sentence); assert.equal(list.length,10);
 const h=buildHistory(list); assert.equal(h.count,160); list[0].pairs.aa.count=99; assert.equal(h.pairs.aa.count,80);
 assert.equal(buildHistory([{...sentence,eligible:false}]).count,0);
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

test('warm history supports baseline-only sentence predictions without an artifact',()=>{
 const history=buildHistory([sentence]);
 const prediction=predictSentence('aa bb',history,null);
 assert.equal(prediction.status,'baseline-only');assert.equal(prediction.predictions?.candidate,undefined);
 assert.ok(prediction.predictions?.occurrences.length);
 for(const occurrence of prediction.predictions!.occurrences){
  assert.equal(occurrence.baselineLogMs,history.logSum/history.count);
  assert.equal(occurrence.candidateLogMs,undefined);
 }
 assert.equal(predictSentence('aa',buildHistory([]),null).status,'unavailable');
});
