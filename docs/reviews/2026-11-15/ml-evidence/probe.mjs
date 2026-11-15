// Synthetic diagnostics only. No real users, benefit estimates, source-data acquisition or training.
// Run from repository root: node --experimental-strip-types docs/reviews/2026-11-15/ml-evidence/probe.mjs
import {readFileSync, writeFileSync} from 'node:fs';
import {assessmentPrompts,practicePrompts,shufflePrompts} from '../../../../typing-app/client/src/corpus.ts';
import {pairPositions,parseModelArtifact,predictSentence} from '../../../../typing-app/client/src/model.ts';
import {buildHistory,selectPracticeFocus,supportedManualPairs,selectHistory} from '../../../../typing-app/client/src/profile.ts';
import {TypingEngine} from '../../../../typing-app/client/src/engine.ts';
const model=parseModelArtifact(JSON.parse(readFileSync('typing-app/client/src/generated/model.json','utf8')));
let seed=20261115;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
function counts(prompt){const pairs={};for(const pos of pairPositions(prompt.text)){const p=prompt.text.slice(pos-1,pos+1);pairs[p]=(pairs[p]??0)+1;}return pairs;}
const assessmentCounts=assessmentPrompts.map(counts);
const allAssessment=[...new Set(assessmentCounts.flatMap(c=>Object.keys(c)))].sort();
const supported=supportedManualPairs(practicePrompts);
const maxInTen=Object.fromEntries(allAssessment.map(p=>[p,assessmentCounts.map(c=>c[p]??0).sort((a,b)=>b-a).slice(0,10).reduce((a,b)=>a+b,0)]));
function summary(prompt,constant=false){const pairs={};for(const [pair,count] of Object.entries(counts(prompt))){const ms=constant?200:100+((pair.charCodeAt(0)*31+pair.charCodeAt(1)*7)%301);pairs[pair]={count,logSum:count*Math.log(ms)};}return {promptId:prompt.id,promptText:prompt.text,response:prompt.text,submitted:true,eligible:true,diagnosticsAvailable:true,qualityFlags:[],keys:{},pairs};}
const simulations=[];
for(const n of [1,2,3,5,10]){
  let supportedCount=0,positiveCount=0,uniformPositiveCount=0;const chosen={};let maxUniformScore=0;
  for(let run=0;run<1000;run++){
    const prompts=shufflePrompts(assessmentPrompts,random).slice(0,n);
    const h=buildHistory(prompts.map(p=>summary(p)));
    supportedCount+=Number(Object.entries(h.pairs).some(([p,s])=>s.count>=8&&supported.includes(p)));
    const focus=selectPracticeFocus(h,practicePrompts,model);
    if(focus){positiveCount++;chosen[focus.pair]=(chosen[focus.pair]??0)+1;}
    const uniform=selectPracticeFocus(buildHistory(prompts.map(p=>summary(p,true))),practicePrompts,model);
    if(uniform){uniformPositiveCount++;maxUniformScore=Math.max(maxUniformScore,uniform.score);}
  }
  simulations.push({eligibleSentences:n,syntheticRuns:1000,supportThresholdMet:supportedCount,recommended:positiveCount,chosenPairs:chosen,constant200msRecommended:uniformPositiveCount,maxUniformScore});
}
const warm={count:28,logSum:8*Math.log(400)+20*Math.log(100),pairs:{th:{count:8,logSum:8*Math.log(400)},er:{count:20,logSum:20*Math.log(100)}}};
const coefficientMutation=structuredClone(model);coefficientMutation.coefficients.fill(0);coefficientMutation.intercept=2;
const eng=new TypingEngine({id:'synthetic',qwerty:true,inputMode:'flow-v1',durationMs:15000,prompts:[{id:'synthetic',text:'cat cat'}]});
let t=0;
for(const c of 'cat cat '){t+=100;eng.edit({start:eng.value.length,end:eng.value.length,text:c,pressTime:t},t);}
eng.tick(15100);
const session=eng.result('2026-11-15T12:00:00.000Z');
const practices=structuredClone(session);practices.mode='practice';
const uniformEngine=new TypingEngine({id:'synthetic-uniform',qwerty:true,inputMode:'flow-v1',durationMs:120000,prompts:assessmentPrompts});
let uniformTime=0;
for(const prompt of assessmentPrompts.slice(0,10))for(const c of prompt.text+' '){uniformTime+=200;uniformEngine.edit({start:uniformEngine.value.length,end:uniformEngine.value.length,text:c,pressTime:uniformTime},uniformTime);}
const uniformSummaries=uniformEngine.submittedSummaries;
const report={synthetic:true,seed:20261115,method:'1000 seeded without-replacement prompt samples per eligible-sentence count; artificial pair speeds 100..400ms, plus exactly uniform 200ms. All summaries are correct and eligible, so these are conditional mechanical yield, never human uptake or benefit estimates.',
 corpus:{assessmentPrompts:assessmentPrompts.length,practicePrompts:practicePrompts.length,assessmentDistinctPairs:allAssessment.length,practiceSupportedPairs:supported.length,assessmentPairsSupportedInPractice:allAssessment.filter(p=>supported.includes(p)).length,assessmentPairsPossibleEightInTenDistinctPrompts:allAssessment.filter(p=>maxInTen[p]>=8).length,assessmentPairsBothEligibleAndPracticeSupported:allAssessment.filter(p=>maxInTen[p]>=8&&supported.includes(p)).length,maxInTen,unsupportedInPractice:allAssessment.filter(p=>!supported.includes(p))},
 simulations,uniformEngineProbe:{constantIntervalMs:200,submittedSentences:uniformSummaries.length,eligibleSentences:uniformSummaries.filter(s=>s.eligible).length,focus:selectPracticeFocus(buildHistory(uniformSummaries),practicePrompts,model)},artifactAblation:{validFocus:selectPracticeFocus(warm,practicePrompts,model),changedCoefficientsFocus:selectPracticeFocus(warm,practicePrompts,coefficientMutation),missingArtifactFocus:selectPracticeFocus(warm,practicePrompts,null),warmMissingStatus:predictSentence('cat cat',warm,null).status,coldMissingStatus:predictSentence('cat cat',buildHistory([]),null).status},
 profileGates:{assessmentSentences:selectHistory([session],session.settings).length,practiceSentences:selectHistory([practices],session.settings).length,otherDuration:selectHistory([session],{...session.settings,durationMs:30000}).length,undeclared:selectHistory([session],{...session.settings,qwerty:false}).length,legacy:selectHistory([session],{...session.settings,inputMode:undefined}).length},
 aggregateBlindSpot:{actual:[100,400],predicted:[200,200],observedGeometricMean:200,predictedGeometricMean:200,transitionMaeMs:150,note:'Same saved count and log sums as perfect [200,200] predictions of [200,200]; per-transition MAE cannot be reconstructed from saved aggregates.'}};
writeFileSync(new URL('./probe.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,corpus:{...report.corpus,maxInTen:undefined}},null,2));
