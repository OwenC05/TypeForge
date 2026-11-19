import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Run from repository root. Evaluate frozen application functions with minimal host fakes;
// real engine/model imports remain untouched. This is not a browser or SDK-runtime test.
const source = readFileSync('typing-app/client/src/app.ts', 'utf8').replace(/\r\n/g, '\n');
const load = file => import(pathToFileURL(resolve(`typing-app/client/src/${file}`)).href);
const { TypingEngine } = await load('engine.ts');
const { parseModelArtifact, predictSentence } = await load('model.ts');
const { buildHistory } = await load('profile.ts');
const artifact = parseModelArtifact(JSON.parse(readFileSync('typing-app/client/src/generated/model.json', 'utf8')));
const extract = (start, end) => {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Present ordered boundaries: ${start}`);
  return source.slice(a, b);
};
const fresh = () => new TypingEngine({ id: '00000000-0000-4000-8000-000000000001', prompts: [{id:'probe', text:'the short path'}], mode:'practice', durationMs:30000, inputMode:'flow-v1', corpusVersion:'original-v1', qwerty:true });
const prepareCode = extract('function prepare(now = performance.now())', '  const input = $<HTMLTextAreaElement>');
const lateCode = extract('  if (evidencePending) {', '  const configurationWarning =');
const observations = [];
for (const scenario of ['idle', 'no-op edit', 'one native-style insertion']) {
  const engine = fresh(), nodes = new Map();
  const node = key => { if (!nodes.has(key)) nodes.set(key, {textContent:''}); return nodes.get(key); };
  let pending;
  const context = {engine, initialEngine:engine, evidencePending:true, restartGeneration:0, disposed:false, restarting:false,
    performance:{now:()=>10}, qwerty:{checked:true}, history:[], buildHistory, artifact, predictSentence,
    lineageMessage:'', practiceChoice:{kind:'general', reason:''}, mode:'practice', focus:null, sourceAssessmentId:undefined,
    durationMs:30000, declaredQwerty:true, settings:()=>({}), stage:{dataset:{}}, prompts:[engine.prompt], suggestedItem:null, params:new URLSearchParams('qwerty=1'),
    $:node, storageNotice:()=>{}, recommendationReason:()=>'', selectPracticeFocus:()=>null, practicePrompts:[],
    parsePracticeChoice:()=>({kind:'general', reason:''}), manualPairs:[],
    calibration:()=>({then:callback=>{pending = Promise.resolve().then(()=>callback({sentences:[], diagnostics:[]}));}}),
  };
  context.prepare = runInNewContext(`${stripTypeScriptTypes(prepareCode)}; prepare`, context);
  context.prepare();
  if (scenario === 'no-op edit') engine.edit({start:0,end:0,text:'',tracked:true}, 10);
  if (scenario === 'one native-style insertion') engine.edit({start:0,end:0,text:'t',tracked:true,pressTime:10}, 10);
  runInNewContext(stripTypeScriptTypes(lateCode), context);
  let error = null;
  try { await pending; } catch (caught) { error = String(caught); }
  if (scenario === 'one native-style insertion') assert.equal(error, null);
  else assert.match(error, /Predictions must be exhaustive, finite and frozen once before editing/);
  observations.push({scenario, state:engine.state, lateCalibrationError:error});
}

// Exercise actual finish -> Again -> restart with delayed failing persistence. The fake
// completion element models removal of its export/retry buttons when innerHTML is cleared.
for (const saveMode of ['pending', 'already failed']) {
  const nodes = new Map();
  const node = key => { if (!nodes.has(key)) nodes.set(key, {hidden:false, disabled:false, textContent:'', onclick:null}); return nodes.get(key); };
  const completion = node('#completion');
  Object.defineProperty(completion, 'innerHTML', {set(value) { this.markup=value; if (!value) for (const id of ['#again','#export-current','#retry-save','#save-state']) nodes.delete(id); }});
  let rejectSave, restartDone, exported = 0;
  const result = {id:'original-unsaved-result'};
  const context = {finished:false, timer:1, before:null, key:null, input:{value:'t',disabled:false,readOnly:false,focus:()=>{}},
    clearInterval:()=>{}, setInterval:()=>1, performance:{now:()=>30000},
    engine:{snapshot:()=>({value:'t'}), result:()=>result, abort:()=>{}},
    resultPanel:()=>'<result with again, export and retry>', mayFocusInput:()=>false,
    document:{getElementById:id=>node(`#${id}`)}, $:node,
    download:()=>{exported++;}, restartGeneration:0, disposed:false, repeatRequested:false,
    saveResult:()=>new Promise((_,reject)=>{rejectSave=reject;}), refreshToday:()=>{}, ResultValidationError:class extends Error{},
    PointerEvent:class {}, stage:{}, restarting:false, paint:()=>({state:'completed'}), composing:false,
    settings:()=>({}), qwerty:{checked:false}, durationMs:30000, calibration:async()=>({sentences:[],diagnostics:[]}),
    originId:undefined, history:[], evidencePending:false, mode:'practice', buildHistory:()=>({}), selectPracticeFocus:()=>null,
    practicePrompts:[], artifact:null, parsePracticeChoice:()=>({kind:'general'}), params:new URLSearchParams(), manualPairs:[],
    recommendedFocus:null, practiceChoice:null, recommendationReason:()=>'', focus:null, practiceKind:null, manualPair:null,
    choosePrompts:()=>[], prompts:[], makeEngine:()=>({state:'idle'}), previousPromptText:'', previousResponse:'', undoUsed:false,
    lastPromptKey:'', lastState:'', slotLevel:0, hintMark:'', storageNotice:()=>{}, prepare:()=>{}, settingsPending:false,
  };
  const functions = extract('  function afterResultRendered()', '  input.addEventListener(\'keydown\'');
  const restart = extract("  $('#restart').onclick = async () => {", '  prepare();\n  const initialEngine');
  runInNewContext(`${stripTypeScriptTypes(functions + restart)}; globalThis.reviewFinish=finish`, context);
  const actualRestart = node('#restart').onclick;
  node('#restart').onclick = (...args) => (restartDone = actualRestart(...args));
  const finishing = context.reviewFinish();
  if (saveMode === 'already failed') {
    rejectSave(Error('storage unavailable'));
    await finishing;
    assert.equal(node('#retry-save').hidden, false);
    assert.match(node('#save-state').textContent, /could not be saved/);
  }
  assert.equal(typeof node('#again').onclick, 'function');
  node('#again').onclick();
  await restartDone;
  assert.equal(completion.hidden, true);
  assert.equal(completion.markup, '');
  assert.equal(nodes.has('#export-current'), false);
  if (saveMode === 'pending') { rejectSave(Error('storage unavailable')); await finishing; }
  assert.equal(nodes.has('#retry-save'), false);
  assert.equal(context.restartGeneration, 1);
  assert.equal(exported, 0);
  observations.push({scenario:`Again with save ${saveMode}`, originalResult:result.id, completionHidden:completion.hidden,
    exportButtonRetained:nodes.has('#export-current'), retryButtonRetained:nodes.has('#retry-save'), generation:context.restartGeneration,
    consequence:'Old save catch returns on generation mismatch; removed export/retry closures have no UI route.'});
}
console.log(JSON.stringify({kind:'source-and-real-engine-probes', assertions:'Expected defects reproduced; not product acceptance', observations}, null, 2));
