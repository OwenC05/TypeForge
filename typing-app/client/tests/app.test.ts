import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { resolveRetest, selectHistory, compatible } from '../src/profile.ts';
import type { SessionResult, SentenceSummary } from '../src/engine.ts';

// Exercise the actual app functions without bootstrapping CSS, DOM routes or IndexedDB.
const source = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function restartHandler(text: string = source) {
 const normalized = text.replace(/\r\n/g, '\n');
 const startMarker = "$('#restart').onclick = ";
 const endMarker = '\n  prepare();\n  const initialEngine';
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
   const text = ["$('#restart').onclick = " + body, ' \t ', '  prepare();', '  const initialEngine = engine;'].join(newline);
   assert.throws(() => restartHandler(text), /Restart handler must be nonempty after normalization/);
  });
 }
 test(`restart extraction preserves and executes a multiline ${encoding} handler`, async () => {
  const text = ["$('#restart').onclick = async () => {", '  await ready();', '  restarted();', '};', '  prepare();', '  const initialEngine = engine;'].join(newline);
  const calls: string[] = [];
  const restart = runInNewContext(stripTypeScriptTypes(`(${restartHandler(text)})`), {
   ready: async () => {calls.push('ready');}, restarted: () => {calls.push('restart');},
  });
  await restart();
  assert.deepEqual(calls, ['ready', 'restart']);
 });
}
test('restart extraction rejects a missing start boundary before evaluation', () => {
 assert.throws(() => restartHandler('body\n  prepare();\n  const initialEngine'), /Missing restart start boundary/);
});
test('restart extraction rejects a missing end boundary before evaluation', () => {
 assert.throws(() => restartHandler("$('#restart').onclick = async () => {};"), /Missing restart end boundary/);
});
test('restart extraction rejects reversed or empty boundaries before evaluation', () => {
 assert.throws(() => restartHandler("\n  prepare();\n  const initialEngine\n$('#restart').onclick = async () => {};"), /boundaries must be ordered/);
 assert.throws(() => restartHandler("$('#restart').onclick = \n  prepare();\n  const initialEngine"), /boundaries must be ordered/);
});
const settings = (qwerty: boolean) => ({durationMs:60000 as const,language:'en' as const,qwerty,corpusVersion:'original-v1'});
function calibration(load: (cursor: unknown)=>Promise<SessionResult[]>) {
 const code=source.slice(source.indexOf('async function calibration('),source.indexOf('function storageNotice('));
 return runInNewContext(`${stripTypeScriptTypes(code)}; calibration`,{selectHistory,settings,listResultsPage:load,getStorageDiagnostics:()=>['read-warning']}) as (actualSettings:SessionResult['settings'])=>Promise<{sentences:SentenceSummary[];diagnostics:string[]}>;
}
function practiceContext() {
 const code=source.slice(source.indexOf('function parsePracticeChoice('),source.indexOf('async function calibration('));
 const parsePracticeChoice=runInNewContext(`${stripTypeScriptTypes(code)}; parsePracticeChoice`,{});
 return {practiceKind:null,manualPair:null,manualPairs:['at','th'],recommendedFocus:null,practiceChoice:{kind:'general'},parsePracticeChoice,recommendationReason:()=>'',originId:undefined};
}
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

test('Restart waits for fresh calibration and focus before enabling replacement input',async()=>{
 const handler=restartHandler();
 let release!:(value:unknown)=>void;const pending=new Promise(resolve=>{release=resolve;});
 const old=[{promptId:'deleted'}],fresh=[{promptId:'retained'}];const log:string[]=[];
 const restart={disabled:false},completionPanel={hidden:false},input={disabled:false,readOnly:true,value:'old',focus:()=>log.push('focus')},qwerty={checked:true,disabled:false};
 const context:any={...practiceContext(),performance:{now:()=>10},paint:()=>({state:'running'}),engine:{abort:()=>log.push('abort')},input,qwerty,
  settings,durationMs:60000,duration:{disabled:false},previousPromptText:"",params:new URLSearchParams(), calibration:()=>{log.push('load');return pending;},history:old,focus:{pair:'aa'},mode:'practice',sourceAssessmentId:'origin',
  buildHistory:(h:unknown)=>h,selectPracticeFocus:(h:unknown)=>{assert.equal(h,fresh);log.push('focus-selection');return null;},practicePrompts:[],artifact:null,
  choosePrompts:()=>[],makeEngine:()=>{log.push('new-engine');return {abort:()=>log.push('abort')};},prepare:()=>{assert.equal(context.history,fresh);assert.equal(input.disabled,true);log.push('prepare');},
  storageNotice:()=>{},clearInterval:()=>log.push('clear-timer'),setInterval:()=>123,timer:1,restarting:false,disposed:false,restartGeneration:0,
  lastPromptKey:'old',lastState:'running',before:{},key:{},composing:true,finished:false,prompts:[],
  $:(selector:string)=>selector==='#restart'?restart:selector==='#completion'?completionPanel:{hidden:false,textContent:''},
 };
 const run=runInNewContext(stripTypeScriptTypes(`(${handler})`),context);
 const completion=run();assert.equal(input.disabled,true);assert.equal(restart.disabled,true);assert.equal(log.includes('load'),true);
 assert.equal(context.history,old);release({sentences:fresh,diagnostics:[]});await completion;
 assert.equal(context.history,fresh);assert.equal(context.focus,null);assert.equal(input.disabled,false);assert.equal(restart.disabled,false);
 assert.ok(log.indexOf('prepare')>log.indexOf('focus-selection'));assert.equal(input.value,'');
 // Stopped runs use this same restart path: clear their frozen UI state.
 context.paint=()=>({state:'stopped'});context.finished=true;input.readOnly=true;completionPanel.hidden=false;context.previousPromptText='stopped prompt';
 await run();assert.equal(context.finished,false);assert.equal(input.readOnly,false);assert.equal(completionPanel.hidden,true);assert.equal(context.previousPromptText,'');
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
 const handler=restartHandler();
 const oldOrigin=fixture();oldOrigin.settings=settings(true);
 for(const scenario of ['deleted','incompatible','unreadable','abandoned'] as const){
  const restart={disabled:false},intro={textContent:'English · lowercase · fresh assessment passages'};
  let readId:string|undefined;let release!:(origin:SessionResult)=>void;let announce!:()=>void;
  const readStarted=new Promise<void>(resolve=>{announce=resolve;});let newRuns=0;
  const context:any={...practiceContext(),performance:{now:()=>10},paint:()=>({state:'running'}),engine:{abort:()=>{}},input:{disabled:false,value:'typed',focus:()=>{}},qwerty:{checked:true,disabled:false},
   params:new URLSearchParams(`retest=${oldOrigin.id}`),origin:oldOrigin,originId:oldOrigin.id,sourceAssessmentId:oldOrigin.id,excluded:['old-prompt'],lineageMessage:'',mode:'assessment',
   settings,durationMs:60000,duration:{disabled:false},previousPromptText:"",resolveRetest,assessmentPrompts:[{id:'fresh',text:'cat'}],
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


test('flow input installs next predictions only after accepted value and eligible assessment history', () => {
 const begin = source.indexOf('  const acceptInput = ') + '  const acceptInput = '.length;
 const end = source.indexOf("\n  input.addEventListener('input', acceptInput);", begin);
 const handler = source.slice(begin, end).trim().replace(/;$/, '');
 for (const mode of ['assessment', 'practice']) {
  const log: string[] = [];
  const summary = { eligible: true, response: 'ab cd', promptText:'ab cd' };
  const snapshot = { state: 'running', sentenceIndex: 0, value: 'ab cd' };
  const input = { value: 'ab cd ' };
  const context: any = { restarting: false, disposed: false, input, performance: {now: () => 25},
   before: {value:'ab cd',start:5,end:5,type:'insertText',data:' '}, key: {key:' ',time:25,repeat:false}, composing:false, mode, history:[],previousPromptText:'',
   reconstructEdit: () => ({start:5,end:5,text:' ',tracked:true}),
   engine: {tick: () => snapshot, edit: () => log.push('edit'), snapshot: () => ({...snapshot,sentenceIndex:1,value:''}),submittedSummaries:[summary]},
   appendHistory: (history: unknown[], value: unknown) => {assert.equal(value,summary);log.push('history');return [...history,value];},
   prepare: (now: number) => {assert.equal(now,25);log.push('prepare');},paint: (now: number) => {assert.equal(now,25);log.push('paint');},
  };
  runInNewContext(stripTypeScriptTypes(`(${handler})`), context)({isComposing:false});
  assert.equal(input.value,'');assert.equal(context.before,null);assert.equal(context.key,null);
  assert.deepEqual(log,mode==='assessment'?['edit','history','prepare','paint']:['edit','prepare','paint']);
 }
});

test('late native input restores retained text without another engine edit or prediction', () => {
 const begin = source.indexOf('  const acceptInput = ') + '  const acceptInput = '.length;
 const end = source.indexOf("\n  input.addEventListener('input', acceptInput);", begin);
 const handler = source.slice(begin, end).trim().replace(/;$/, '');
 for (const state of ['completed','stopped','aborted']) {
  const input = {value:'late text'};let paints=0;
  const run = runInNewContext(stripTypeScriptTypes(`(${handler})`), {restarting:false,disposed:false,input,performance:{now:()=>60},
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
 const context:any={restarting:false,disposed:false,performance:{now:()=>5},paint:()=>({state:'stopped',value:'accepted'}),before:{},key:{}};
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
 const code=source.slice(source.indexOf('  function paint('),source.indexOf('  async function finish()'));
 const nodes=new Map<string,any>();const node=(selector:string)=>{if(!nodes.has(selector))nodes.set(selector,{hidden:true,textContent:''});return nodes.get(selector);};
 const value='accepted';const snapshot={state:'stopped',value,sentenceIndex:0,remainingMs:1000,elapsedMs:500,
  metrics:{wpm:0,accuracy:0},qualityFlags:['interrupted']};
 const context:any={performance:{now:()=>500},engine:{tick:()=>snapshot,stoppedSnapshot:()=>({id:'diagnostic',stopReason:'result-limit'})},
  qwerty:{},duration:{},practiceKind:null,manualPair:null,restarting:false,disposed:false,
  input:{selectionStart:8,selectionEnd:8,selectionDirection:'none',value,readOnly:false},
  lastPromptKey:'0:accepted:8:8:8',lastState:'running',finished:false,before:{},key:{},timer:1,
  clearInterval:()=>{},format:String,accuracy:String,$:node,warning:(message:string)=>{node('#exercise-warning').textContent=message;},download:()=>{}};
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
 const context:any={restarting:false,disposed:false,performance:{now:()=>5},paint:()=>({state:'running'}),before:{},key:{},warning:(value:string)=>message=value};
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


test('save retries are single-flight and late save success/failure cannot navigate or mutate disposed pages',async()=>{
 const begin=source.indexOf('    const generation = restartGeneration;',source.indexOf('async function finish()'));
 const end=source.indexOf("    $('#retry-save').onclick",begin);
 const code=source.slice(begin,end);
 for(const outcome of ['success','failure','generation'] as const){
  let resolve!:()=>void;let reject!:(error:Error)=>void;let saves=0,navigations=0,domWrites=0;
  const pending=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});
  const context:any={restartGeneration:0,disposed:false,result:{id:'test'},encodeURIComponent,
   saveResult:()=>{saves++;return pending;},location:{assign:()=>navigations++},
   $:()=>{domWrites++;return {disabled:false,hidden:true,textContent:''};},
  };
  const save=runInNewContext(`${stripTypeScriptTypes(code)}; attemptSave`,context);
  const first=save();await save();assert.equal(saves,1);const before=domWrites;
  if(outcome==='generation')context.restartGeneration++;else context.disposed=true;
  if(outcome==='failure')reject(Error('unavailable'));else resolve();await first;
  assert.equal(navigations,0);assert.equal(domWrites,before);await save();assert.equal(saves,1);
 }
});


test('save failure distinguishes permanent validation rejection from retryable browser storage errors',async()=>{
 const begin=source.indexOf('    const generation = restartGeneration;',source.indexOf('async function finish()'));
 const end=source.indexOf("    $('#retry-save').onclick",begin);
 class ResultValidationError extends Error {}
 for(const permanent of [false,true]) {
  const retry={disabled:false,hidden:true},status={textContent:''};let saves=0,navigations=0;
  const context:any={restartGeneration:0,disposed:false,result:{id:'test'},encodeURIComponent,ResultValidationError,
   saveResult:async()=>{saves++;if(saves===1)throw permanent?new ResultValidationError('invalid result'):Error('storage unavailable');},
   location:{assign:()=>navigations++},$:(selector:string)=>selector==='#retry-save'?retry:status};
  const save=runInNewContext(`${stripTypeScriptTypes(source.slice(begin,end))}; attemptSave`,context);
  await save();assert.equal(navigations,0);
  if(permanent){assert.equal(retry.hidden,true);assert.match(status.textContent,/cannot be saved|validation/i);await save();assert.equal(saves,1);}
  else {assert.equal(retry.hidden,false);assert.equal(retry.disabled,false);assert.match(status.textContent,/retry/i);await save();assert.equal(saves,2);assert.equal(navigations,1);}
 }
});

test('permanently rejected completion keeps export enabled and never navigates',async()=>{
 const code=source.slice(source.indexOf('  async function finish()'),source.indexOf("  input.addEventListener('keydown'"));
 class ResultValidationError extends Error {}
 const result={id:'retained',settings:{durationMs:60000,qwerty:false}};
 const nodes=new Map<string,any>();const node=(selector:string)=>{if(!nodes.has(selector))nodes.set(selector,{disabled:false,hidden:true,textContent:''});return nodes.get(selector);};
 let saves=0,navigations=0,exported:unknown;
 const context:any={finished:false,clearInterval:()=>{},timer:1,before:{},key:{},input:{value:'',disabled:false},
  performance:{now:()=>60},engine:{snapshot:()=>({value:'accepted'}),result:()=>result},$:node,metricCards:()=>'',
  restartGeneration:0,disposed:false,ResultValidationError,saveResult:async()=>{saves++;throw new ResultValidationError('invalid');},
  download:(data:unknown)=>{exported=data;},location:{assign:()=>navigations++}};
 const finish=runInNewContext(`${stripTypeScriptTypes(code)}; finish`,context);
 await finish();assert.equal(saves,1);assert.equal(navigations,0);assert.equal(node('#retry-save').hidden,true);
 assert.equal(node('#export-current').disabled,false);node('#export-current').onclick();assert.equal(exported,result);
 node('#retry-save').onclick();await Promise.resolve();assert.equal(saves,1);
});

test('practice query supports general, evidence-backed recommendation and catalogue-only manual pairs',()=>{
 const code=source.slice(source.indexOf('function parsePracticeChoice('),source.indexOf('async function calibration('));
 const parse=runInNewContext(`${stripTypeScriptTypes(code)}; parsePracticeChoice`,{});
 const pairs=['at','th'];
 assert.equal(parse(null,null,pairs,null,'No history').kind,'general');
 assert.equal(parse('manual','th',pairs,null,'No history').pair,'th');
 for(const pair of ['xx','TH','','<script>']){const result=parse('manual',pair,pairs,null,'No history');assert.equal(result.kind,'general');assert.match(result.reason,/unsupported/i);}
 assert.equal(parse('recommended',null,pairs,{pair:'th'},'').kind,'recommended');
 assert.match(parse('recommended',null,pairs,null,'No compatible history').reason,/No compatible history/);
 assert.equal(parse('unknown',null,pairs,null,'').kind,'general');
});


test('direct recommended/manual practice selects shared drills and persists only the matching identity',()=>{
 const helpers=practiceContext();
 const start=source.indexOf('  const manualPairs = supportedManualPairs(');
 const end=source.indexOf('  shell(',start);
 const makeStart=source.indexOf('  const makeEngine = ');
 const makeEnd=source.indexOf('  let engine = ',makeStart);
 const focus={pair:'th',evidenceCount:8,source:'baseline',score:1,baselineVersion:'v1'};
 for(const kind of ['general','recommended','manual']){
  let drillPair:string|undefined;let configuration:any;
  const context:any={...helpers,mode:'practice',params:new URLSearchParams(`practice=${kind}&pair=at`),history:[],sourceAssessmentId:undefined,
   supportedManualPairs:()=>['at','th'],practicePrompts:[],artifact:null,buildHistory:()=>({}),selectPracticeFocus:()=>focus,declaredQwerty:true,
   selectDrillPrompts:(identity:any)=>{drillPair=identity?.pair;return [{id:'practice',text:'cat'}];},
   crypto:{randomUUID:()=> 'new-run'},durationMs:30000,CORPUS_VERSION:'original-v1',
   TypingEngine:class{constructor(value:any){configuration=value;}},
  };
  const run=runInNewContext(`${stripTypeScriptTypes(source.slice(start,end)+source.slice(makeStart,makeEnd))}; makeEngine`,context);
  run(true);assert.equal(configuration.durationMs,30000);assert.equal(configuration.inputMode,'flow-v1');
  assert.equal(configuration.sourceAssessmentId,undefined);
  if(kind==='recommended'){assert.equal(drillPair,'th');assert.equal(configuration.practiceFocus,focus);assert.equal(configuration.manualDrill,undefined);}
  if(kind==='manual'){assert.equal(drillPair,'at');assert.equal(configuration.practiceFocus,undefined);assert.equal(configuration.manualDrill.pair,'at');assert.equal(configuration.manualDrill.source,'manual');}
  if(kind==='general'){assert.equal(drillPair,undefined);assert.equal(configuration.practiceFocus,undefined);assert.equal(configuration.manualDrill,undefined);}
 }
});


test('keyboard query is explicit, inherits only when absent and fails safely with feedback',()=>{
 const code=source.slice(source.indexOf('function parseQwerty('),source.indexOf('type PracticeKind'));
 const parse=runInNewContext(`${stripTypeScriptTypes(code)}; parseQwerty`,{});
 assert.equal(parse(null).qwerty,false);assert.equal(parse(null,true).qwerty,true);
 assert.equal(parse('1',false).qwerty,true);assert.equal(parse('0',true).qwerty,false);
 for(const value of ['','true','false','2',' 1']){assert.equal(parse(value,true).qwerty,false);assert.match(parse(value,true).reason,/undeclared/i);}
});

test('optional corrupt or deleted origins retain current results, export/delete and settings-preserving fallback links',async()=>{
 const code=source.slice(source.indexOf('async function results()'),source.indexOf('function renderPredictionComparison('));
 for(const mode of ['practice','assessment'] as const)for(const state of ['corrupt','deleted'] as const){
  const result=fixture();result.settings={...settings(true),durationMs:30000,inputMode:'flow-v1'};result.mode=mode;result.sourceAssessmentId='origin';
  if(mode==='practice')result.manualDrill={pair:'th',source:'manual'};
  const nodes=new Map<string,any>();let html='',exported:unknown,deleted='';
  const context:any={params:new URLSearchParams(`id=${result.id}`),getResult:async(id:string)=>{if(id===result.id)return result;if(state==='corrupt')throw Error('corrupt origin');return undefined;},
   calibration:async()=>({sentences:[],diagnostics:[]}),selectPracticeFocus:()=>null,buildHistory:()=>({}),artifact:null,practicePrompts:[],assessmentPrompts:[{id:'fresh',text:'cat'}],
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
 const run=runInNewContext(`${stripTypeScriptTypes(code)}; results`,{params:new URLSearchParams('id=current'),getResult:async()=>{throw Error('corrupt current result');}});
 await assert.rejects(run(),/corrupt current result/);
});


test('assessment from URLs never acquire retest lineage on restart; explicit practice/retest origins retain their contracts',async()=>{
 const handler=restartHandler();
 const makeStart=source.indexOf('  const makeEngine = '),makeEnd=source.indexOf('  let engine = ',makeStart);
 const origin=fixture();origin.settings={...settings(true),durationMs:15000,inputMode:'flow-v1'};
 for(const scenario of ['assessment-from','practice-from','retest'] as const){
  let configuration:any;const mode=scenario==='practice-from'?'practice':'assessment';
  const context:any={...practiceContext(),performance:{now:()=>10},paint:()=>({state:'idle'}),engine:{abort:()=>{}},
   input:{disabled:false,readOnly:false,value:'',focus:()=>{}},qwerty:{checked:true,disabled:false},duration:{disabled:false},durationMs:15000,
   params:new URLSearchParams(`${scenario==='retest'?'retest':'from'}=${origin.id}&duration=15&qwerty=1`),originId:origin.id,origin,sourceAssessmentId:undefined,excluded:[],lineageMessage:'',mode,
   settings:(qwerty:boolean,durationMs:15000|30000=15000)=>({...settings(qwerty),durationMs,inputMode:'flow-v1'}),compatible,resolveRetest,assessmentPrompts:[{id:'fresh',text:'cat'}],
   getResult:async()=>origin,calibration:async()=>({sentences:[],diagnostics:[]}),history:[],focus:null,buildHistory:()=>({}),selectPracticeFocus:()=>null,practicePrompts:[],artifact:null,
   choosePrompts:()=>[{id:'fresh',text:'cat'}],prompts:[{id:'fresh',text:'cat'}],prepare:()=>{},storageNotice:()=>{},clearInterval:()=>{},setInterval:()=>1,timer:1,
   restarting:false,disposed:false,restartGeneration:0,lastPromptKey:'',lastState:'idle',before:null,key:null,composing:false,finished:false,previousPromptText:'',
   crypto:{randomUUID:()=> 'new-run'},CORPUS_VERSION:'original-v1',TypingEngine:class{constructor(value:any){configuration=value;}abort(){}},
   $:()=>({disabled:false,hidden:false,textContent:''}),
  };
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
