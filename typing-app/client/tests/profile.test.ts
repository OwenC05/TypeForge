import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHistory, appendHistory, selectPracticeFocus, selectDrillPrompts, resolveRetest } from '../src/profile.ts';
import type { SentenceSummary } from '../src/engine.ts';
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
