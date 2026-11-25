import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { resolveRetest, selectHistory, compatible } from '../src/profile.ts';
import type { SessionResult, SentenceSummary } from '../src/engine.ts';
import { newSaveRecord, applyOutcome } from '../src/unsaved.ts';
import { isFiniteSource } from '../src/finite-practice-result.ts';
import { TypingEngine } from '../src/engine.ts';
import { CORPUS_VERSION, practicePrompts, selectPrompts } from '../src/corpus.ts';
import { manualPairs, selectAssessmentPrompts, selectPairPrompts } from '../src/corpus-v2.ts';

// Exercise the actual app functions without bootstrapping CSS, DOM routes or IndexedDB.
const source = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function restartHandler(text: string = source) {
 const normalized = text.replace(/\r\n/g, '\n');
 const startMarker = "$('#restart').onclick = ";
 const endMarker = '\n  // Saved timing history arrives';
 const start = normalized.indexOf(startMarker);
 const end = normalized.indexOf(endMarker);
 assert.ok(start >= 0, 'Missing restart start boundary');
 assert.ok(end >= 0, 'Missing restart end boundary');
 const begin = start + startMarker.length;
 assert.ok(end > begin, 'Restart boundaries must be ordered with a nonempty body');
 const handler = normalized.slice(begin, end).trim().replace(/;$/, '').trim();
 assert.ok(handler.length > 0, 'Restart handler must be nonempty after normalization');
 return handler;
}

for (const [encoding, newline] of [['LF', '\n'], ['CRLF', '\r\n']]) {
 for (const [kind, body] of [['whitespace-only', ' \t '], ['semicolon-only', ' \t ; \t ']]) {
  test(`restart extraction rejects normalized-empty ${kind} ${encoding} body before evaluation`, () => {
   const text = ["$('#restart').onclick = " + body, ' \t ', '  // Saved timing history arrives after the stage is ready.'].join(newline);
   assert.throws(() => restartHandler(text), /Restart handler must be nonempty after normalization/);
  });
 }
 test(`restart extraction preserves and executes a multiline ${encoding} handler`, async () => {
  const text = ["$('#restart').onclick = async () => {", '  await ready();', '  restarted();', '};', '  // Saved timing history arrives after the stage is ready.'].join(newline);
  const calls: string[] = [];
  const restart = runInNewContext(stripTypeScriptTypes(`(${restartHandler(text)})`), {
   ready: async () => {calls.push('ready');}, restarted: () => {calls.push('restart');},
  });
  await restart();
  assert.deepEqual(calls, ['ready', 'restart']);
 });
}
test('restart extraction rejects a missing start boundary before evaluation', () => {
 assert.throws(() => restartHandler('body\n  // Saved timing history arrives'), /Missing restart start boundary/);
});
test('restart extraction rejects a missing end boundary before evaluation', () => {
 assert.throws(() => restartHandler("$('#restart').onclick = async () => {};"), /Missing restart end boundary/);
});
test('restart extraction rejects reversed or empty boundaries before evaluation', () => {
 assert.throws(() => restartHandler("\n  // Saved timing history arrives\n$('#restart').onclick = async () => {};"), /boundaries must be ordered/);
 assert.throws(() => restartHandler("$('#restart').onclick = \n  // Saved timing history arrives"), /boundaries must be ordered/);
});
const settings = (qwerty: boolean) => ({durationMs:60000 as const,language:'en' as const,qwerty,corpusVersion:'original-v1'});
function calibration(load: (cursor: unknown)=>Promise<SessionResult[]>) {
 const code=source.slice(source.indexOf('async function calibration('),source.indexOf('function storageNotice('));
 return runInNewContext(`${stripTypeScriptTypes(code)}; calibration`,{selectHistory,settings,listResultsPage:load,getStorageDiagnostics:()=>['read-warning']}) as (actualSettings:SessionResult['settings'])=>Promise<{sentences:SentenceSummary[];diagnostics:string[]}>;
}
function practiceContext() {
 const code=source.slice(source.indexOf('function parsePracticeChoice('),source.indexOf('async function calibration('));
 const parsePracticeChoice=runInNewContext(`${stripTypeScriptTypes(code)}; parsePracticeChoice`,{});
 return {practiceKind:null,manualPair:null,manualPairs:['at','th'],practiceChoice:{kind:'general'},parsePracticeChoice,originId:undefined,mayFocusInput:()=>true,settingsPending:false,carryUnsaved:()=>{}};
}
const ended=runInNewContext(`${stripTypeScriptTypes(source.slice(source.indexOf('const ended = '),source.indexOf('\n',source.indexOf('const ended = '))))}; ended`,{});
function fixture():SessionResult{return JSON.parse(readFileSync(new URL('./fixtures/legacy-v1.json',import.meta.url),'utf8'));}

test('unsupported calibration never reads history; supported sparse pages retain newest ten chronologically',async()=>{
 let reads=0;const unsupported=await calibration(async()=>{reads++;return [];})(settings(false));
 assert.equal(reads,0);assert.equal(unsupported.sentences.length,0);
 const base=fixture();base.settings=settings(true);
 const page=(day:number,eligible:number)=>Array.from({length:100},(_,i)=>({...structuredClone(base),id:`00000000-0000-4000-8000-${String(day*1000+i).padStart(12,'0')}`,completedAt:`2026-09-${String(day).padStart(2,'0')}T12:00:00.000Z`,mode:i<eligible?'assessment' as const:'practice' as const,sentences:[{...structuredClone(base.sentences[0]),promptId:`${day}-${i}`}]}));
 const pages=[page(30,2),page(29,0),page(28,9)];reads=0;
 const supported=await calibration(async()=>pages[reads++]??[])(settings(true));
 assert.equal(reads,3);assert.equal(supported.sentences.length,10);
 assert.deepEqual(Array.from(supported.sentences,s=>s.promptId),selectHistory(pages.flat(),settings(true)).map(s=>s.promptId));
 assert.ok(supported.diagnostics.length>0);
});

// Restart host: every free name the actual handler reads, with neutral defaults a test overrides.
function restartContext(overrides: Record<string, unknown> = {}) {
 const context: any = {...practiceContext(),performance:{now:()=>10},paint:()=>({state:'running'}),engine:{abort:()=>{}},
  input:{disabled:false,readOnly:false,value:'old',focus:()=>{}},qwerty:{checked:true,disabled:false},duration:{disabled:false},durationMs:60000,
  settings,params:new URLSearchParams(),mode:'practice',origin:null,sourceAssessmentId:undefined,excluded:[],lineageMessage:'',history:[],historyKey:'true|60000',
  prepAbort:null, frozen:null, coach:null, coachFresh:true, suggestedPair:null, coachMessage:'', fallbackForBlock:false,
  refreshSuggestion:async()=>{}, showPair:()=>{}, choosePrompts:()=>[],prompts:[],makeEngine:()=>({abort:()=>{}}),clearSlot:()=>{},prepare:()=>{},startTimer:()=>{},loadEvidence:()=>{},
  changeSettings:()=>{},queueMicrotask,clearInterval:()=>{},timer:1,restarting:false,disposed:false,restartGeneration:0,lastPromptKey:'old',lastState:'running',
  before:{},key:{},composing:true,finished:false,repeatRequested:false,previousPromptText:'',previousResponse:'',undoUsed:true,
  $:()=>({hidden:false,disabled:false,textContent:''}),
 };
 return Object.assign(context,overrides);
}

// Old: "Restart waits for fresh calibration and focus before enabling replacement input". That encoded the superseded
// rule that General waited on optional calibration and the old selector's focus. New invariant (accepted contract):
// a General restart never reads calibration or a focus; replacement input returns after prepare() with cleared state;
// saved timing loads late through loadEvidence(); the status is read after the stage is ready; a stopped run clears its
// frozen UI; and a disposal during the one remaining awaited step (an origin read) never re-enables input.
test('General restart never waits on optional evidence: input returns after prepare, timing and status load late',async()=>{
 const handler=restartHandler();const log:string[]=[];
 const restart={disabled:false},completionPanel={hidden:false,innerHTML:'old'},input={disabled:false,readOnly:true,value:'old',focus:()=>log.push('focus')};
 const old=[{promptId:'kept'}];
 const context=restartContext({input,history:old,
  calibration:()=>{log.push('calibration');return new Promise(()=>{});},
  makeEngine:()=>{log.push('new-engine');return {abort:()=>log.push('abort')};},
  prepare:()=>{assert.equal(input.disabled,true);log.push('prepare');},
  refreshSuggestion:async()=>{assert.equal(input.disabled,false);log.push('status');},
  loadEvidence:()=>{assert.equal(input.disabled,false);log.push('evidence');},
  $:(selector:string)=>selector==='#restart'?restart:selector==='#completion'?completionPanel:{hidden:false,textContent:''},
 });
 const run=runInNewContext(stripTypeScriptTypes(`(${handler})`),context);
 await run();
 assert.equal(log.includes('calibration'),false,'optional calibration is never awaited by a restart');
 assert.deepEqual(log.filter(item=>item!=='abort'),['new-engine','prepare','focus','status','evidence']);
 assert.equal(input.disabled,false);assert.equal(restart.disabled,false);assert.equal(input.value,'');assert.equal(context.undoUsed,false);
 assert.equal(context.before,null);assert.equal(context.key,null);assert.equal(context.composing,false);assert.equal(context.frozen,null);
 assert.equal(context.history,old,'same keyboard and duration: earlier eligible sentences are kept');
 context.durationMs=30000;await run();
 assert.deepEqual(Array.from(context.history),[],'a different setting starts its own timing history');assert.equal(context.historyKey,'true|30000');
 // Stopped runs use this same restart path: clear their frozen UI state.
 context.paint=()=>({state:'stopped'});context.finished=true;input.readOnly=true;completionPanel.hidden=false;context.previousPromptText='stopped prompt';
 await run();assert.equal(context.finished,false);assert.equal(input.readOnly,false);assert.equal(completionPanel.hidden,true);assert.equal(context.previousPromptText,'');
 // A pagehide during an awaited origin read invalidates its continuation; it must never re-enable input.
 let releaseOrigin!:(value:unknown)=>void;context.originId='origin';context.getResult=()=>new Promise(resolve=>{releaseOrigin=resolve;});
 const engines=log.filter(item=>item==='new-engine').length;
 const abandoned=run();context.disposed=true;context.restartGeneration++;
 releaseOrigin(undefined);await abandoned;
 assert.equal(input.disabled,true);assert.equal(log.filter(item=>item==='new-engine').length,engines);
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
 const handler=restartHandler();
 const oldOrigin=fixture();oldOrigin.settings=settings(true);
 for(const scenario of ['deleted','incompatible','unreadable','abandoned'] as const){
  const restart={disabled:false},intro={textContent:'English · lowercase · fresh assessment passages'};
  let readId:string|undefined;let release!:(origin:SessionResult)=>void;let announce!:()=>void;
  const readStarted=new Promise<void>(resolve=>{announce=resolve;});let newRuns=0;
  const context:any=restartContext({input:{disabled:false,value:'typed',focus:()=>{}},
   params:new URLSearchParams(`retest=${oldOrigin.id}`),origin:oldOrigin,originId:oldOrigin.id,sourceAssessmentId:oldOrigin.id,excluded:['old-prompt'],lineageMessage:'',mode:'assessment',
   resolveRetest,assessmentPrompts:[{id:'fresh',text:'cat'}],
   getResult:async(id:string)=>{readId=id;announce();if(scenario==='unreadable')throw Error('storage blocked');if(scenario==='abandoned')return new Promise(resolve=>{release=resolve;});return scenario==='deleted'?undefined:{...oldOrigin,settings:{...oldOrigin.settings,corpusVersion:'different'}};},
   makeEngine:()=>{newRuns++;assert.equal(context.sourceAssessmentId,undefined);return {};},
   $:(selector:string)=>selector==='#restart'?restart:selector==='#exercise-intro'?intro:{hidden:false,textContent:''},
  });
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


test('flow input installs next predictions only after accepted value and eligible assessment history', () => {
 const begin = source.indexOf('  const acceptInput = ') + '  const acceptInput = '.length;
 const end = source.indexOf("\n  input.addEventListener('input', acceptInput);", begin);
 const handler = source.slice(begin, end).trim().replace(/;$/, '');
 for (const mode of ['assessment', 'practice']) {
  const log: string[] = [];
  const summary = { eligible: true, response: 'ab cd', promptText:'ab cd' };
  const snapshot = { state: 'running', sentenceIndex: 0, value: 'ab cd' };
  const input = { value: 'ab cd ' };
  let frozenAt = 0;
  const context: any = { restarting: false, disposed: false, input, performance: {now: () => 25}, ended, frozen: null, freezeRun: () => { frozenAt++; },
   before: {value:'ab cd',start:5,end:5,type:'insertText',data:' '}, key: {key:' ',time:25,repeat:false}, composing:false, mode, history:[],previousPromptText:'',
   reconstructEdit: () => ({start:5,end:5,text:' ',tracked:true}),
   engine: {tick: () => snapshot, edit: () => log.push('edit'), snapshot: () => ({...snapshot,sentenceIndex:1,value:''}),submittedSummaries:[summary]},
   appendHistory: (history: unknown[], value: unknown) => {assert.equal(value,summary);log.push('history');return [...history,value];},
   prepare: (now: number) => {assert.equal(now,25);log.push('prepare');},paint: (now: number) => {assert.equal(now,25);log.push('paint');},
  };
  runInNewContext(stripTypeScriptTypes(`(${handler})`), context)({isComposing:false});
  assert.equal(input.value,'');assert.equal(context.before,null);assert.equal(context.key,null);
  assert.deepEqual(log,mode==='assessment'?['edit','history','prepare','paint']:['edit','prepare','paint']);
  assert.equal(frozenAt,0,'a running block is already frozen');
 }
});

test('a run freezes its identity exactly once, at its first accepted insertion', () => {
 const begin = source.indexOf('  const acceptInput = ') + '  const acceptInput = '.length;
 const end = source.indexOf("\n  input.addEventListener('input', acceptInput);", begin);
 const handler = source.slice(begin, end).trim().replace(/;$/, '');
 for (const accepted of [true, false]) {
  let state = 'idle', freezes = 0;
  const input = { value: 't' };
  const context: any = { restarting: false, disposed: false, input, performance: {now: () => 5}, ended, frozen: null, suggestedPair: null, composing: false, mode: 'practice',
   before: {value:'',start:0,end:0,type:'insertText',data:'t'}, key: {key:'t',time:5,repeat:false}, reconstructEdit: () => ({start:0,end:0,text:'t',tracked:true}),
   engine: {get state() { return state; }, tick: () => ({state, sentenceIndex:0, value:''}), edit: () => { if (accepted) state = 'running'; }, snapshot: () => ({state, sentenceIndex:0, value: accepted ? 't' : ''}), submittedSummaries: []},
   freezeRun: () => { freezes++; context.frozen = {label:'General practice'}; }, prepare: () => {}, paint: () => {} };
  const run = runInNewContext(stripTypeScriptTypes(`(${handler})`), context);
  run({isComposing:false});
  assert.equal(freezes, accepted ? 1 : 0, accepted ? 'first accepted insertion' : 'a refused first edit freezes nothing');
  if (accepted) { input.value = 'tt'; context.before = {value:'t',start:1,end:1,type:'insertText',data:'t'}; run({isComposing:false}); assert.equal(freezes, 1, 'never again in the same run'); }
 }
});

test('late native input restores retained text without another engine edit or prediction', () => {
 const begin = source.indexOf('  const acceptInput = ') + '  const acceptInput = '.length;
 const end = source.indexOf("\n  input.addEventListener('input', acceptInput);", begin);
 const handler = source.slice(begin, end).trim().replace(/;$/, '');
 for (const state of ['completed','stopped','aborted']) {
  const input = {value:'late text'};let paints=0;
  const run = runInNewContext(stripTypeScriptTypes(`(${handler})`), {restarting:false,disposed:false,input,performance:{now:()=>60},ended,
   engine:{tick:()=>({state,value:'accepted'})},paint:()=>paints++});
  run({isComposing:false});assert.equal(input.value,'accepted');assert.equal(paints,1);
 }
});

test('stopped input permits Tab, selection and copying while terminal edit guards retain accepted text', () => {
 const keyBegin = source.indexOf("  input.addEventListener('keydown', ") + "  input.addEventListener('keydown', ".length;
 const keyEnd = source.indexOf("\n  input.addEventListener('beforeinput'", keyBegin);
 const keyHandler = source.slice(keyBegin,keyEnd).trim().replace(/\);$/, '');
 const editBegin = keyEnd + "\n  input.addEventListener('beforeinput', ".length;
 const editEnd = source.indexOf('\n  const acceptInput = ', editBegin);
 const editHandler = source.slice(editBegin,editEnd).trim().replace(/\);$/, '');
 const context:any={restarting:false,disposed:false,performance:{now:()=>5},paint:()=>({state:'stopped',value:'accepted'}),before:{},key:{},ended};
 const keydown=runInNewContext(stripTypeScriptTypes(`(${keyHandler})`),context);
 let prevented=0;
 // Native Tab/Shift+Tab default actions can now move focus to recovery controls.
 for(const event of [{key:'Tab',shiftKey:false},{key:'Tab',shiftKey:true},{key:'ArrowLeft'},{key:'c',ctrlKey:true}]) {
  keydown({...event,preventDefault:()=>prevented++});
 }
 assert.equal(prevented,0);assert.equal(context.before,null);assert.equal(context.key,null);
 const beforeinput=runInNewContext(stripTypeScriptTypes(`(${editHandler})`),context);
 for(const inputType of ['insertText','deleteContentBackward']) beforeinput({inputType,preventDefault:()=>prevented++});
 assert.equal(prevented,2);
});

test('flagged safety-stop warning remains truthful after repeated paint and keyboard interaction',()=>{
 const code=source.slice(source.indexOf('  function paint('),source.indexOf('  function installPair('));
 const nodes=new Map<string,any>();const node=(selector:string)=>{if(!nodes.has(selector))nodes.set(selector,{hidden:true,textContent:''});return nodes.get(selector);};
 const value='accepted';const snapshot={state:'stopped',value,sentenceIndex:0,remainingMs:1000,elapsedMs:500,
  metrics:{wpm:0,accuracy:0},qualityFlags:['interrupted']};
 const context:any={performance:{now:()=>500},engine:{tick:()=>snapshot,stoppedSnapshot:()=>({id:'diagnostic',stopReason:'result-limit'})},
  qwerty:{},duration:{},practiceKind:null,manualPair:null,restarting:false,disposed:false,
  input:{selectionStart:8,selectionEnd:8,selectionDirection:'none',value,readOnly:false},
  lastPromptKey:'0:accepted:8:8:8',lastState:'running',finished:false,before:{},key:{},timer:1,
  clearInterval:()=>{},format:String,accuracy:String,setRunState:()=>{},$:node,warning:(message:string)=>{node('#exercise-warning').textContent=message;},download:()=>{},ended};
 const paint=runInNewContext(`${stripTypeScriptTypes(code)}; paint`,context);context.paint=paint;
 paint();const stoppedWarning=node('#exercise-warning').textContent;
 assert.match(stoppedWarning,/Stopped safely: result-limit.*will not be saved/);assert.equal(context.input.readOnly,true);
 paint();assert.equal(node('#exercise-warning').textContent,stoppedWarning);
 const begin=source.indexOf("  input.addEventListener('keydown', ")+"  input.addEventListener('keydown', ".length;
 const end=source.indexOf("\n  input.addEventListener('beforeinput'",begin);
 const keydown=runInNewContext(stripTypeScriptTypes(`(${source.slice(begin,end).trim().replace(/\);$/, '')})`),context);
 keydown({key:'Tab',preventDefault:()=>assert.fail('Tab must remain available')});
 assert.equal(node('#exercise-warning').textContent,stoppedWarning);
});

test('Enter is a no-op and clears stale edit metadata without calling submit', () => {
 const begin = source.indexOf("  input.addEventListener('keydown', ") + "  input.addEventListener('keydown', ".length;
 const end = source.indexOf("\n  input.addEventListener('beforeinput'", begin);
 const handler = source.slice(begin,end).trim().replace(/\);$/, '');
 let prevented=0;let message='';
 const context:any={restarting:false,disposed:false,performance:{now:()=>5},paint:()=>({state:'running'}),before:{},key:{},warning:(value:string)=>message=value,ended};
 runInNewContext(stripTypeScriptTypes(`(${handler})`),context)({key:'Enter',isComposing:false,preventDefault:()=>prevented++});
 assert.equal(prevented,1);assert.equal(context.before,null);assert.equal(context.key,null);assert.match(message,/Space/);
});


test('correction hint exposes the first expected character without changing the response mirror',()=>{
 const code=source.slice(source.indexOf('function typingHelp('),source.indexOf('function parseDuration('));
 const help=runInNewContext(`${stripTypeScriptTypes(code)}; typingHelp`,{});
 assert.match(help('ab cd','ax'),/character 2: expected "b"/);
 assert.match(help('ab cd','abxcd'),/character 3: expected a space/);
 assert.match(help('ab','abx'),/character 3: remove the extra character/);
 assert.ok(!help('ab cd','ab').includes('Correction'));
 assert.match(help('ab cd','ax'),/Backspace corrects/);
 assert.ok(source.includes("$('#typing-help').textContent = typingHelp(snapshot.prompt.text, snapshot.value)"));
 assert.ok(source.includes('const displayed = snapshot.value + snapshot.prompt.text.slice(snapshot.value.length)'));
});

test('duration query accepts only supported seconds, defaults safely and inherits origin',()=>{
 const code=source.slice(source.indexOf('function parseDuration('),source.indexOf('async function calibration('));
 const parse=runInNewContext(`${stripTypeScriptTypes(code)}; parseDuration`,{SUPPORTED_DURATIONS:[15000,30000,60000,120000]});
 for(const seconds of ['15','30','60','120']) {const result=parse(seconds);assert.equal(result.durationMs,Number(seconds)*1000);assert.equal(result.reason,'');}
 assert.equal(parse(null).durationMs,60000);assert.equal(parse(null,30000).durationMs,30000);
 for(const value of ['','0','15.0',' 15','15000','61','NaN','-30']) {const result=parse(value,30000);assert.equal(result.durationMs,60000);assert.match(result.reason,/60/);}
});

test('calibration uses actual duration and mode while retaining earlier eligible sentences in flagged runs',async()=>{
 const base=fixture();base.settings={...settings(true),durationMs:15000,inputMode:'flow-v1'};base.eligibleForProgress=false;base.qualityFlags=['interrupted'];
 const wrong=structuredClone(base);wrong.settings.durationMs=60000;wrong.sentences[0].promptId='wrong-duration';
 const legacy=fixture();legacy.settings=settings(true);
 const result=await calibration(async()=>[base,wrong,legacy])(base.settings);
 assert.deepEqual(Array.from(result.sentences,s=>s.promptId),base.sentences.filter(s=>s.eligible&&s.submitted).map(s=>s.promptId));
});


// Save hosts. Migration: C's fenced saveSource reports a discriminated Persistence (saved, or failed with
// retryable true/false) instead of throwing ResultValidationError; the in-place retry stays single-flight and
// stale settlement still writes nothing. An unexpected throw is classified as a retryable failure.
const savedOutcome=(id:string)=>({state:'saved',sourceId:id});
const failedOutcome=(id:string,retryable:boolean)=>({state:'failed',sourceId:id,retryable});
const saveSlice=()=>{
 const begin=source.indexOf('    const generation = restartGeneration;',source.indexOf('async function finish()'));
 const end=source.indexOf("    $('#retry-save').onclick",begin);
 assert.ok(begin>0&&end>begin,'ordered nonempty save boundaries');
 return source.slice(begin,end);
};
const saveHost=(overrides:Record<string,unknown>)=>({restartGeneration:0,disposed:false,source:{id:'test',mode:'practice'},
 newSaveRecord,applyOutcome,isFiniteSource,currentSave:null,paintResultActions:()=>{},afterResultRendered:()=>{},refreshToday:()=>{},...overrides});

test('save retries are single-flight and late save success/failure cannot navigate or mutate disposed pages',async()=>{
 for(const outcome of ['success','failure','throw','generation'] as const){
  let settle!:(value:unknown)=>void;let fail!:(error:Error)=>void;let saves=0,navigations=0,domWrites=0,paints=0;
  const pending=new Promise((yes,no)=>{settle=yes;fail=no;});
  const context:any=saveHost({saveSource:()=>{saves++;return pending;},location:{assign:()=>navigations++},
   paintResultBaseline:()=>{paints++;},$:()=>{domWrites++;return {disabled:false,hidden:true,textContent:''};}});
  const save=runInNewContext(`${stripTypeScriptTypes(saveSlice())}; attemptSave`,context);
  const first=save();await save();assert.equal(saves,1);const before=domWrites,paintsBefore=paints;
  if(outcome==='generation')context.restartGeneration++;else context.disposed=true;
  if(outcome==='failure')settle(failedOutcome('test',true));else if(outcome==='throw')fail(Error('unavailable'));else settle(savedOutcome('test'));await first;
  assert.equal(navigations,0);assert.equal(domWrites,before);assert.equal(paints,paintsBefore,'no stale repaint');await save();assert.equal(saves,1);
  assert.equal(context.currentSave.state,outcome==='success'||outcome==='generation'?'saved':'failed','the outcome still reaches its own record');
 }
});

test('save failure distinguishes permanent validation rejection from retryable browser storage errors',async()=>{
 for(const kind of ['retryable','permanent','throw'] as const) {
  const retry={disabled:false,hidden:true},status={textContent:'',className:''};let saves=0,navigations=0;
  const context:any=saveHost({
   saveSource:async()=>{saves++;if(saves>1)return savedOutcome('test');if(kind==='throw')throw Error('storage unavailable');return failedOutcome('test',kind!=='permanent');},
   location:{assign:()=>navigations++},$:(selector:string)=>selector==='#retry-save'?retry:selector==='#save-state'?status:{hidden:true}});
  const save=runInNewContext(`${stripTypeScriptTypes(saveSlice())}; attemptSave`,context);
  await save();assert.equal(navigations,0);
  if(kind==='permanent'){assert.equal(retry.hidden,true);assert.match(status.textContent,/cannot be saved|validation/i);assert.equal(context.currentSave.state,'rejected');await save();assert.equal(saves,1);continue;}
  assert.equal(retry.hidden,false,kind);assert.equal(retry.disabled,false);assert.match(status.textContent,/retry/i);
  await save();assert.equal(saves,2);assert.equal(navigations,0);assert.match(status.textContent,/^Saved in this browser/);
 }
});

test('permanently rejected completion keeps export enabled and never navigates',async()=>{
 const code=source.slice(source.indexOf('  async function finish()'),source.indexOf("  input.addEventListener('keydown'"));
 const result={id:'retained',mode:'practice',settings:{durationMs:60000,qwerty:false}};
 const nodes=new Map<string,any>();const node=(selector:string)=>{if(!nodes.has(selector))nodes.set(selector,{disabled:false,hidden:true,textContent:''});return nodes.get(selector);};
 let saves=0,navigations=0,exported:unknown;let frozenBy='';
 const context:any=saveHost({finished:false,clearInterval:()=>{},timer:1,before:{},key:{},input:{value:'',disabled:false},
  performance:{now:()=>60},engine:{snapshot:()=>({value:'accepted'}),result:()=>result},$:node,resultPanel:(_:unknown,identity:{label:string})=>identity.label,history:[],
  frozen:null,freezeRun:()=>{frozenBy='finish';return {label:'General practice'};},
  saveSource:async()=>{saves++;return failedOutcome('retained',false);},
  download:(data:unknown)=>{exported=data;},location:{assign:()=>navigations++}});
 const finish=runInNewContext(`${stripTypeScriptTypes(code)}; finish`,context);
 await finish();assert.equal(saves,1);assert.equal(navigations,0);assert.equal(node('#retry-save').hidden,true);
 assert.equal(frozenBy,'finish','a run that ended without an insertion is still frozen once');assert.equal(node('#completion').innerHTML,'General practice');
 assert.equal(node('#export-current').disabled,false);node('#export-current').onclick();assert.equal(exported,result);
 node('#retry-save').onclick();await Promise.resolve();assert.equal(saves,1);
});

// Old: 'recommended' parsed as an evidence-backed recommendation carrying the selector's reason. New invariant:
// it carries no assumed pair before reading the saved evidence.
test('practice query supports general, a Suggested request and catalogue-only manual pairs',()=>{
 const code=source.slice(source.indexOf('function parsePracticeChoice('),source.indexOf('async function calibration('));
 const parse=runInNewContext(`${stripTypeScriptTypes(code)}; parsePracticeChoice`,{});
 const pairs=['at','th'];
 assert.equal(parse(null,null,pairs,null,'No history').kind,'general');
 assert.equal(parse('manual','th',pairs,null,'No history').pair,'th');
 for(const pair of ['xx','TH','','<script>']){const result=parse('manual',pair,pairs,null,'No history');assert.equal(result.kind,'general');assert.match(result.reason,/unsupported/i);}
 const request=parse('recommended','th',pairs);
 assert.equal(request.kind,'recommended');assert.equal(request.reason,'');assert.equal(request.pair,undefined,'a request never names a pair');
 assert.equal(parse('unknown',null,pairs,null,'').kind,'general');
});


test('the initial engine uses its selected bank and a Suggested request starts on General before the model decision', () => {
  const start = source.indexOf('  let practiceChoice = parsePracticeChoice(');
  const end = source.indexOf('  shell(', start);
  const makeStart = source.indexOf('  const makeEngine = ');
  const makeEnd = source.indexOf('  let engine = ', makeStart);
  const setup = stripTypeScriptTypes(source.slice(start, end) + source.slice(makeStart, makeEnd));
  for (const [mode, kind, expected] of [
    ['practice', 'general', practicePrompts],
    ['practice', 'recommended', practicePrompts],
    ['practice', 'manual', selectPairPrompts('at')],
    ['assessment', null, selectAssessmentPrompts([])],
  ] as const) {
    type Options = ConstructorParameters<typeof TypingEngine>[0];
    let configuration!: Options;
    const makeEngine = runInNewContext(`${setup}; makeEngine`, {
      ...practiceContext(), mode, params: new URLSearchParams(kind ? { practice: kind, pair: 'at' } : {}),
      manualPairs, selectAssessmentPrompts, selectPairPrompts, selectPrompts, excluded: [], sourceAssessmentId: undefined,
      crypto: { randomUUID: () => 'new-run' }, durationMs: 30000, CORPUS_VERSION,
      TypingEngine: class { constructor(options: Options) { configuration = options; } },
    });
    makeEngine(true);
    assert.equal(configuration.durationMs, 30000);
    assert.equal(configuration.inputMode, 'flow-v1');
    assert.equal(configuration.corpusVersion, CORPUS_VERSION);
    assert.equal(configuration.sourceAssessmentId, undefined);
    assert.equal(configuration.practiceFocus, undefined);
    assert.equal(configuration.manualDrill?.pair, kind === 'manual' ? 'at' : undefined);
    assert.equal(configuration.manualDrill?.source, kind === 'manual' ? 'manual' : undefined);
    assert.deepEqual(new Set(configuration.prompts.map(p => p.id)), new Set(expected.map(p => p.id)));
    const texts = new Map(expected.map(prompt => [prompt.id, prompt.text]));
    for (const prompt of configuration.prompts) assert.equal(texts.get(prompt.id), prompt.text);
  }
});


test('keyboard query is explicit, inherits only when absent and fails safely with feedback',()=>{
 const code=source.slice(source.indexOf('function parseQwerty('),source.indexOf('type PracticeKind'));
 const parse=runInNewContext(`${stripTypeScriptTypes(code)}; parseQwerty`,{});
 assert.equal(parse(null).qwerty,false);assert.equal(parse(null,true).qwerty,true);
 assert.equal(parse('1',false).qwerty,true);assert.equal(parse('0',true).qwerty,false);
 for(const value of ['','true','false','2',' 1']){assert.equal(parse(value,true).qwerty,false);assert.match(parse(value,true).reason,/undeclared/i);}
});

// Old: the results page also ran the old selector over calibration. New invariant: it reads the current record through the
// source union, never selects a focus, and opens a finite record as itself; lineage and export/delete are unchanged.
test('optional corrupt or deleted origins retain current results, export/delete and settings-preserving fallback links',async()=>{
 const code=source.slice(source.indexOf('async function results()'),source.indexOf('function finiteResultPage('));
 for(const mode of ['practice','assessment'] as const)for(const state of ['corrupt','deleted'] as const){
  const result=fixture();result.settings={...settings(true),durationMs:30000,inputMode:'flow-v1'};result.mode=mode;result.sourceAssessmentId='origin';
  if(mode==='practice')result.manualDrill={pair:'th',source:'manual'};
  const nodes=new Map<string,any>();let html='',exported:unknown,deleted='';
  const context:any={params:new URLSearchParams(`id=${result.id}`),getSavedSource:async(id:string)=>id===result.id?result:undefined,
   getResult:async(id:string)=>{assert.notEqual(id,result.id,'the current record comes from the source union');if(state==='corrupt')throw Error('corrupt origin');return undefined;},
   isFiniteSource,finiteResultPage:()=>assert.fail('a timed result is never shown as finite'),getStorageDiagnostics:()=>[],assessmentPrompts:[{id:'fresh',text:'cat'}],
   settings,resolveRetest,shell:(value:string)=>{html=value;},metricCards:(value:SessionResult)=>`metrics:${value.metrics.wpm}`,
   format:String,date:(value:string)=>value,accuracy:String,storageNotice:()=>{},renderPredictionComparison:()=>{},renderResultDetails:()=>{},encodeURIComponent,
   $:(selector:string)=>{if(!nodes.has(selector))nodes.set(selector,{});return nodes.get(selector);},download:(value:unknown)=>{exported=value;},
   window:{confirm:()=>true},deleteResult:async(id:string)=>{deleted=id;},location:{assign:()=>{}},
  };
  await runInNewContext(`${stripTypeScriptTypes(code)}; results`,context)();
  assert.ok(html.includes(`metrics:${result.metrics.wpm}`));nodes.get('#export-result').onclick();assert.equal(exported,result);
  await nodes.get('#delete-result').onclick();assert.equal(deleted,result.id);
  const fallback=new URL(nodes.get('#retest').href,'https://typeforge.example/');assert.equal(fallback.searchParams.get('duration'),'30');assert.equal(fallback.searchParams.get('qwerty'),'1');
  if(mode==='practice'){assert.match(nodes.get('#coach-explanation').textContent,/unavailable/i);assert.equal(fallback.searchParams.has('retest'),false);}
  else assert.match(nodes.get('#origin-comparison').textContent,/unavailable/i);
  assert.match(html,/practice=manual&pair=th&duration=30&qwerty=1|practice=general&duration=30&qwerty=1/);
 }
 // The current record is mandatory, unlike lineage evidence.
 const run=runInNewContext(`${stripTypeScriptTypes(code)}; results`,{params:new URLSearchParams('id=current'),getSavedSource:async()=>{throw Error('corrupt current result');}});
 await assert.rejects(run(),/corrupt current result/);
 // A finite Suggested record is readable as itself and never cast to a timed result.
 const finite={schemaId:'typeforge-finite-practice-v1',id:'finite'};let shown:unknown;let timed=0;
 await runInNewContext(`${stripTypeScriptTypes(code)}; results`,{params:new URLSearchParams('id=finite'),getSavedSource:async()=>finite,isFiniteSource,
  finiteResultPage:(value:unknown)=>{shown=value;},shell:()=>{timed++;},getResult:async()=>{timed++;}})();
 assert.equal(shown,finite);assert.equal(timed,0);
});


test('assessment from URLs never acquire retest lineage on restart; explicit practice/retest origins retain their contracts',async()=>{
 const handler=restartHandler();
 const makeStart=source.indexOf('  const makeEngine = '),makeEnd=source.indexOf('  let engine = ',makeStart);
 const origin=fixture();origin.settings={...settings(true),durationMs:15000,inputMode:'flow-v1'};
 for(const scenario of ['assessment-from','practice-from','retest'] as const){
  let configuration:any;const mode=scenario==='practice-from'?'practice':'assessment';
  const context:any=restartContext({paint:()=>({state:'idle'}),
   input:{disabled:false,readOnly:false,value:'',focus:()=>{}},durationMs:15000,historyKey:'true|15000',
   params:new URLSearchParams(`${scenario==='retest'?'retest':'from'}=${origin.id}&duration=15&qwerty=1`),originId:origin.id,origin,sourceAssessmentId:undefined,excluded:[],lineageMessage:'',mode,
   settings:(qwerty:boolean,durationMs:15000|30000=15000)=>({...settings(qwerty),durationMs,inputMode:'flow-v1'}),compatible,resolveRetest,assessmentPrompts:[{id:'fresh',text:'cat'}],
   getResult:async()=>origin,practicePrompts:[],
   choosePrompts:()=>[{id:'fresh',text:'cat'}],prompts:[{id:'fresh',text:'cat'}],
   crypto:{randomUUID:()=> 'new-run'},CORPUS_VERSION:'original-v1',TypingEngine:class{constructor(value:any){configuration=value;}abort(){}},
  });
  context.makeEngine=runInNewContext(`${stripTypeScriptTypes(source.slice(makeStart,makeEnd))}; makeEngine`,context);
  const restart=runInNewContext(stripTypeScriptTypes(`(${handler})`),context);
  for(const changed of [false,true,false]){
   context.qwerty.checked=!changed;context.durationMs=changed?30000:15000;await restart();
   const expectsOrigin=scenario!=='assessment-from'&&!changed;
   assert.equal(context.sourceAssessmentId,expectsOrigin?origin.id:undefined,`${scenario}, changed=${changed}`);
   assert.equal(configuration.sourceAssessmentId,expectsOrigin?origin.id:undefined);
   if(scenario!=='retest'||changed)assert.equal(context.excluded.length,0);
   else assert.deepEqual(Array.from(context.excluded),origin.sentences.map(sentence=>sentence.promptId));
  }
 }
});

const sliceBetween=(start:string,end:string)=>{const b=source.indexOf(start),e=source.indexOf(end,b+start.length);assert.ok(b>=0&&e>b,`ordered nonempty boundaries: ${start}`);return source.slice(b,e);};

test('timed result headings use only the mode and explicit stored practice metadata', () => {
  const template = sliceBetween('  shell(`<div class="page-heading"><div><p class="eyebrow">${result.settings.durationMs', "\n  $('#result-date')");
  const render = runInNewContext(`(result, metricCards, shell) => { const originId = null; ${template} }`);
  const focus = { pair: 'th', evidenceCount: 8, source: 'baseline', baselineVersion: 'v1', score: 1 } as const;
  const cases: [Partial<SessionResult>, string][] = [
    [{ mode: 'assessment' }, 'ASSESSMENT'],
    [{ mode: 'practice', manualDrill: { pair: 'th', source: 'manual' } }, 'MANUAL PAIR th'],
    [{ mode: 'practice', practiceFocus: focus }, 'RECOMMENDED PRACTICE'],
    [{ mode: 'practice', practiceFocus: { source: 'model', pair: 'th' } }, 'SUGGESTED PAIR th'],
    [{ mode: 'practice' }, 'PRACTICE'],
  ];
  for (const [metadata, expected] of cases) {
    let html = '';
    render({ ...fixture(), ...metadata }, () => '', (value: string) => { html = value; });
    assert.equal(html.match(/<span class="tag">([^<]+)<\/span>/)?.[1], expected);
  }
});
