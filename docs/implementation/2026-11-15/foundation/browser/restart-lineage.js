// Explicit Playwright MCP filename runner. Synthetic fixture, isolated contexts only.
async (page) => {
  const browser = page.context().browser(), base = 'http://127.0.0.1:5197';
  const results = [], errors = [];
  const origin = {
    id:'00000000-0000-4000-8000-000000000001',owner:'guest',schemaVersion:1,metricVersion:1,
    completedAt:'2026-09-30T12:00:00.000Z',mode:'assessment',
    settings:{durationMs:60000,language:'en',qwerty:true,corpusVersion:'1',inputMode:'flow-v1'},
    qualityFlags:[],eligibleForProgress:true,
    metrics:{elapsedMs:60000,correctCharacters:3,attemptedCharacters:3,correctAttempts:3,accuracy:100,deletedCharacters:0,wpm:0.6},
    sentences:[{promptId:'legacy-cat',promptText:'cat',response:'cat',submitted:true,eligible:true,diagnosticsAvailable:true,qualityFlags:[],
      keys:Object.fromEntries(['c','a','t'].map(k=>[k,{attempts:1,correct:1,firstAttempts:1,firstErrors:0}])),
      pairs:{ca:{count:1,logSum:Math.log(100)},at:{count:1,logSum:Math.log(100)}}}],
    chartSamples:[{elapsedMs:60000,wpm:0.6,accuracy:100}],
  };
  function check(name, ok, details) {
    results.push({name,status:ok?'PASS':'FAIL',...(details===undefined?{}:{details})});
    if(!ok) throw Error(name);
  }
  const records = p => p.evaluate(() => new Promise((resolve,reject)=>{
    const r=indexedDB.open('typeforge');r.onerror=()=>reject(String(r.error));
    r.onsuccess=()=>{const db=r.result,q=db.transaction('results').objectStore('results').getAll();q.onsuccess=()=>{db.close();resolve(q.result)};q.onerror=()=>{db.close();reject(String(q.error))}};
  }));
  async function restart(p) {
    await p.locator('#restart').click();
    await p.waitForFunction(()=>!document.querySelector('#typing-input').disabled && !document.querySelector('#restart').disabled);
    const input=p.locator('#typing-input');
    check('restart returns empty editable focused input',await input.inputValue()==='' && await input.evaluate(e=>!e.readOnly && document.activeElement===e));
  }
  async function scenario(kind, mutation) {
    const name=kind+'/'+mutation, context=await browser.newContext(),p=await context.newPage();
    p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push({name,message:e.message}));
    try {
      await p.clock.install();await p.clock.pauseAt(new Date());
      await p.goto(base+'/practice.html?qwerty=1');await p.locator('#typing-input').waitFor();
      // Schema is created by the application; insert the deliberately synthetic valid fixture.
      await p.evaluate(row=>new Promise((resolve,reject)=>{
        const r=indexedDB.open('typeforge');r.onerror=()=>reject(String(r.error));
        r.onsuccess=()=>{const db=r.result,t=db.transaction('results','readwrite');t.objectStore('results').put(row);t.oncomplete=()=>{db.close();resolve()};t.onerror=()=>{db.close();reject(String(t.error))}};
      }),origin);
      await p.goto(base+'/results.html?id='+origin.id);
      await p.locator('#result-date').waitFor();
      check(name+': synthetic origin passes application validation',(await p.locator('#result-date').innerText()).includes('Space flow'));
      const query=kind==='retest'?`retest=${origin.id}`:`from=${origin.id}${kind==='practice-from'?'&mode=practice':''}`;
      await p.goto(base+'/practice.html?'+query);await p.locator('#typing-input').waitFor();
      check(name+': origin settings restored',await p.locator('#qwerty').isChecked() && await p.locator('#duration').inputValue()==='60');
      if(mutation==='delete') {
        await p.evaluate(id=>new Promise((resolve,reject)=>{
          const r=indexedDB.open('typeforge');r.onerror=()=>reject(String(r.error));
          r.onsuccess=()=>{const db=r.result,t=db.transaction('results','readwrite');t.objectStore('results').delete(id);t.oncomplete=()=>{db.close();resolve()};t.onerror=()=>{db.close();reject(String(t.error))}};
        }),origin.id);
      } else if(mutation==='incompatible' || mutation==='restored') {
        await p.locator('#qwerty').uncheck();
        await p.waitForFunction(()=>!document.querySelector('#typing-input').disabled);
        if(mutation==='restored') {
          await p.locator('#qwerty').check();
          await p.waitForFunction(()=>!document.querySelector('#typing-input').disabled);
        }
      }
      await restart(p);
      if(kind==='retest' && (mutation==='delete'||mutation==='incompatible'))
        check(name+': unavailable origin visibly starts new assessment',(await p.locator('#focus-state').innerText()).includes('New assessment:'));
      if(kind==='practice-from' && mutation==='delete')
        check(name+': deleted practice origin visibly unavailable',(await p.locator('#focus-state').innerText()).includes('origin is unavailable'));
      await p.locator('#typing-input').press('a');await p.clock.fastForward(60000);
      await p.waitForURL('**/results.html?*');
      const rows=await records(p),saved=rows.filter(r=>r.id!==origin.id);
      check(name+': exactly one new saved run',saved.length===1);
      const expected=kind!=='assessment-from' && mutation!=='delete' && mutation!=='incompatible'?origin.id:undefined;
      check(name+': saved lineage matches current origin eligibility',saved[0].sourceAssessmentId===expected,{expected:expected??null,actual:saved[0].sourceAssessmentId??null});
      check(name+': saved mode retained',saved[0].mode===(kind==='practice-from'?'practice':'assessment'));
      if(mutation!=='delete') check(name+': origin remains immutable',JSON.stringify(rows.find(r=>r.id===origin.id))===JSON.stringify(origin));
    } catch(error) { results.push({name:name+': execution',status:'FAIL',details:String(error)}); }
    finally {await context.close();}
  }
  for(const [kind,mutations] of [['assessment-from',['unchanged','restored']],['practice-from',['unchanged','delete','restored']],['retest',['unchanged','delete','incompatible','restored']]])
    for(const mutation of mutations) await scenario(kind,mutation);
  return {suite:'foundation-native-restart-lineage',base,browser:browser.version(),
    assertions:results.filter(r=>!r.name.endsWith(': execution')).length,passed:results.filter(r=>r.status==='PASS').length,
    failed:results.filter(r=>r.status==='FAIL').length,results,errors,
    limits:['Synthetic seeded origin; no human evidence','Accelerated clock; Chromium only','No Undo, AT, OS IME, physical keyboard/device or zoom certification']};
}
