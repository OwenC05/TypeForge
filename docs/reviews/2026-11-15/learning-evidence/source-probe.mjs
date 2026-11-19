// Read-only synthetic checks: no browser, storage, training, or human observations.
// Run from repository root: node docs/reviews/2026-11-15/learning-evidence/source-probe.mjs
import { readFileSync } from 'node:fs';
import { TypingEngine } from '../../../../typing-app/client/src/engine.ts';
import { practicePrompts, assessmentPrompts, shufflePrompts } from '../../../../typing-app/client/src/corpus.ts';
import { pairPositions } from '../../../../typing-app/client/src/model.ts';
import { selectHistory, selectPracticeFocus, supportedManualPairs } from '../../../../typing-app/client/src/profile.ts';

const artifact = JSON.parse(readFileSync(new URL('../../../../typing-app/client/src/generated/model.json', import.meta.url)));
const supported = new Set(supportedManualPairs(practicePrompts));
const pairs = p => pairPositions(p.text).map(i => p.text.slice(i - 1, i + 1));
const catalogue = [...supported].map(pair => ({pair,
  passages: practicePrompts.filter(p => pairs(p).includes(pair)).length,
  occurrences: practicePrompts.flatMap(pairs).filter(p => p === pair).length,
})).sort((a,b) => a.passages-b.passages || a.pair.localeCompare(b.pair));
const cadenceExposure = ['th','he','ag'].map(pair => {
  const target=practicePrompts.filter(p=>pairs(p).includes(pair));
  const general=practicePrompts.filter(p=>!pairs(p).includes(pair));
  const mean=(bank,fn)=>bank.reduce((sum,p)=>sum+fn(p),0)/bank.length;
  const occurrences=p=>pairs(p).filter(x=>x===pair).length;
  const ordinaryOccurrences=mean(practicePrompts,occurrences);
  const focusedOccurrences=(2/3)*mean(target,occurrences);
  return {pair,targetContainingPassages:target.length,
    ordinaryTargetPassageFraction:target.length/practicePrompts.length,focusedTargetPassageFraction:2/3,
    ordinaryExpectedOccurrencesPerPassage:ordinaryOccurrences,focusedExpectedOccurrencesPerPassage:focusedOccurrences,
    ordinaryOccurrencesPer100Characters:100*ordinaryOccurrences/mean(practicePrompts,p=>p.text.length),
    focusedOccurrencesPer100Characters:100*focusedOccurrences/((2/3)*mean(target,p=>p.text.length)+(1/3)*mean(general,p=>p.text.length)),
  };
});
let seed = 20261115;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2**32);
const opportunity = [1,3,5,10].map(sentences => {
  let passing = 0; const counts = [];
  for(let t=0; t<1000; t++) {
    const seen = new Map();
    for(const pair of shufflePrompts(assessmentPrompts, random).slice(0,sentences).flatMap(pairs)) seen.set(pair,(seen.get(pair)??0)+1);
    const n = [...seen].filter(([pair,count])=>count>=8 && supported.has(pair)).length;
    passing += Number(n>0); counts.push(n);
  }
  return {cleanCompletedSentences:sentences,windows:1000,windowsWithAnyCountAndBankEligiblePair:passing,meanQualifyingPairs:counts.reduce((a,b)=>a+b)/counts.length};
});
function engineProbe(corrected=false,longGap=false) {
  const engine = new TypingEngine({id:'synthetic',inputMode:'flow-v1',qwerty:true,prompts:[{id:'probe',text:'cat'}]});
  let now=100;
  const append=(text,gap=100)=>{now+=gap;engine.edit({start:engine.value.length,end:engine.value.length,text,pressTime:now},now);};
  append('c');append(corrected?'x':'a',longGap?5100:100);
  if(corrected) {now+=100;engine.edit({start:1,end:2,text:''},now);append('a');}
  append('t');append(' ');engine.tick(60200);
  const result=engine.result('2026-11-15T00:00:00Z');
  return {metrics:result.metrics,sentence:result.sentences[0]};
}
const clean=engineProbe();
const sentence=clean.sentence;
const settings={inputMode:'flow-v1',durationMs:60000,language:'en',qwerty:true,corpusVersion:'probe'};
const run={id:'probe',metricVersion:1,schemaVersion:1,mode:'practice',settings,completedAt:'2026-11-15T00:00:00Z',sentences:[sentence]};
const h={count:20,logSum:10*Math.log(200)+10*Math.log(100),pairs:{th:{count:10,logSum:10*Math.log(200)},he:{count:10,logSum:10*Math.log(100)}}};
console.log(JSON.stringify({
  provenance:{kind:'synthetic source execution, not user coverage or learning evidence',seed:20261115,node:process.version,baseline:artifact.baseline},
  corpus:{practice:practicePrompts.length,assessment:assessmentPrompts.length,allLowercaseSpacesOnly:[...practicePrompts,...assessmentPrompts].every(p=>/^[a-z ]+$/.test(p.text)),supportedPairs:supported.size,leastSupported:catalogue.slice(0,8),mostSupported:catalogue.slice(-5)},
  optimisticOpportunity:opportunity,
  cadenceExposure,
  history:{practiceSentencesSelected:selectHistory([run],settings).length,assessmentSentencesSelected:selectHistory([{...run,mode:'assessment'}],settings).length},
  focus:{bundled:selectPracticeFocus(h,practicePrompts,artifact),noArtifact:selectPracticeFocus(h,practicePrompts,null)},
  engine:{clean,corrected:engineProbe(true),longGap:engineProbe(false,true)},
},null,2));
