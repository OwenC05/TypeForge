async (page) => {
  const browser = page.context().browser(), base = 'http://127.0.0.1:5188';
  const results = [], errors = [];
  const read = p => p.evaluate(() => new Promise((resolve, reject) => {
    const r = indexedDB.open('typeforge'); r.onerror=()=>reject(String(r.error));
    r.onsuccess=()=>{const db=r.result;const q=db.transaction('results').objectStore('results').getAll();q.onsuccess=()=>{db.close();resolve(q.result)};q.onerror=()=>reject(String(q.error));};
  }));
  async function run(name, options, test) {
    const context=await browser.newContext({viewport:{width:1440,height:900},...options}), p=await context.newPage();
    p.setDefaultTimeout(10000); p.on('pageerror',e=>errors.push({name,message:e.message}));
    try {results.push({name,...await test(p,context)});} catch(e){results.push({name,executionError:String(e)});} finally {await context.close();}
  }
  await run('native edit undo paste and focus mechanics', {permissions:['clipboard-read','clipboard-write']}, async (p) => {
    await p.clock.install(); await p.clock.pauseAt(new Date()); await p.goto(base+'/practice.html?duration=15&qwerty=1');
    const input=p.locator('#typing-input'); await input.pressSequentially('abc def'); await input.press('Control+Backspace');
    const wordDelete=await input.inputValue(); await input.press('Control+z'); const undo=await input.inputValue();
    await input.press('Control+Shift+z'); const redo=await input.inputValue();
    await p.evaluate(()=>navigator.clipboard.writeText('PASTE_SHOULD_NOT_APPEAR')); await input.press('Control+v');
    const paste={value:await input.inputValue(),warning:await p.locator('#exercise-warning').innerText()};
    await input.press('Home'); await input.press('Shift+ArrowRight'); await input.press('x');
    const replace=await input.inputValue(); await input.press('Backspace'); const backspace=await input.inputValue();
    await input.press('Tab'); const focus=await p.evaluate(()=>document.activeElement.id);
    await p.clock.fastForward(15000); await p.waitForURL('**/results.html?*'); const rows=await read(p);
    return {wordDelete,undo,redo,paste,replace,backspace,focus,qualityFlags:rows[0].qualityFlags,accuracy:rows[0].metrics.accuracy,eligible:rows[0].eligibleForProgress};
  });
  await run('delete export reopen offline and migration corruption', {}, async(p,context)=>{
    await p.clock.install(); await p.clock.pauseAt(new Date()); await p.goto(base+'/practice.html?duration=15');
    await p.locator('#typing-input').pressSequentially('test'); await context.setOffline(true); await p.clock.fastForward(15000);
    // The completed write succeeds offline; navigation cannot reload static HTML offline.
    const rows=await read(p); await context.setOffline(false);
    const offlineSave={count:rows.length,elapsed:rows[0]?.metrics.elapsedMs};
    await p.goto(base+'/results.html?id='+rows[0].id); await p.locator('#export-result').waitFor();
    const download=p.waitForEvent('download'); await p.locator('#export-result').click(); const exported=(await download).suggestedFilename();
    // Reopen current DB as v1 fixture with real valid legacy-compatible shape retained.
    await p.evaluate(async result=>{
      await new Promise((r,j)=>{const q=indexedDB.deleteDatabase('typeforge');q.onsuccess=r;q.onerror=j;});
      await new Promise((r,j)=>{const q=indexedDB.open('typeforge',1);q.onupgradeneeded=()=>q.result.createObjectStore('results',{keyPath:'id'});q.onsuccess=()=>{const db=q.result,tx=db.transaction('results','readwrite'),s=tx.objectStore('results');s.add(result);s.add({id:'corrupt-visible-id',completedAt:'2026-11-01T00:00:00.000Z'});tx.oncomplete=()=>{db.close();r();};};q.onerror=j;});
    },rows[0]);
    await p.goto(base+'/progress.html'); await p.locator('#history-rows').waitFor();
    const migration={rows:await p.locator('#history-rows tr').count(),notice:await p.locator('.notice').innerText(),database:await p.evaluate(()=>new Promise(r=>{const q=indexedDB.open('typeforge');q.onsuccess=()=>{const db=q.result;const detail={version:db.version,indexes:[...db.transaction('results').objectStore('results').indexNames]};db.close();r(detail);};}))};
    const historyDownload=p.waitForEvent('download'); await p.locator('#export-history').click(); const historyExport=(await historyDownload).suggestedFilename();
    await p.goto(base+'/results.html?id='+rows[0].id); await p.locator('#delete-result').waitFor();
    p.once('dialog',d=>d.dismiss());await p.locator('#delete-result').click(); const afterCancel=(await read(p)).length;
    p.once('dialog',d=>d.accept());await p.locator('#delete-result').click();await p.waitForURL('**/progress.html');
    return {offlineSave,exported,migration,historyExport,afterCancel,remaining:await read(p)};
  });
  await run('narrow caret scroll mechanics', {viewport:{width:390,height:844}}, async(p)=>{
    await p.clock.install();await p.clock.pauseAt(new Date());await p.goto(base+'/practice.html?duration=120');
    const input=p.locator('#typing-input');await input.pressSequentially('x'.repeat(180));
    const geometry=()=>p.evaluate(()=>{const v=document.querySelector('#typing-viewport'),c=document.querySelector('#prompt .cursor'),t=document.querySelector('#typing-input'),vr=v.getBoundingClientRect(),cr=c.getBoundingClientRect();return {selectionStart:t.selectionStart,selectionEnd:t.selectionEnd,scroll:v.scrollTop,textareaScroll:t.scrollTop,markerTop:cr.top,markerBottom:cr.bottom,viewportTop:vr.top,viewportBottom:vr.bottom,markerInside:cr.top>=vr.top&&cr.bottom<=vr.bottom,documentOverflow:document.documentElement.scrollWidth>innerWidth};});
    const end=await geometry();await input.press('Control+Home');const start=await geometry();await input.press('Control+End');const returnEnd=await geometry();
    return {end,start,returnEnd};
  });
  for (const throttle of [1,4]) await run('bounded native input frame measurement CPU '+throttle, {}, async(p,context)=>{
    const cdp=await context.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
    await p.goto(base+'/practice.html?duration=120'); const input=p.locator('#typing-input');
    await p.evaluate(()=>{window.__frames=[];window.__handlers=[];window.__long=[];let start=0;const t=document.querySelector('#typing-input');t.addEventListener('input',()=>{start=performance.now();requestAnimationFrame(()=>window.__frames.push(performance.now()-start));},true);t.addEventListener('input',()=>window.__handlers.push(performance.now()-start));new PerformanceObserver(l=>window.__long.push(...l.getEntries().map(x=>x.duration))).observe({type:'longtask',buffered:true});});
    const prompt=(await p.locator('#target-description').innerText()).replace('Passage to copy: ','');
    await input.pressSequentially(prompt+' ',{delay:20});
    const timings=await p.evaluate(()=>{const stats=a=>{const s=a.slice().sort((a,b)=>a-b);return {count:s.length,median:s[Math.floor(s.length*.5)]??null,p95:s[Math.floor(s.length*.95)]??null,max:s.at(-1)??null};};return {inputHandlerMs:stats(window.__handlers),inputToNextFrameMs:stats(window.__frames),longTasksMs:window.__long,resourceBytes:performance.getEntriesByType('resource').map(r=>({name:r.name,transfer:r.transferSize,decoded:r.decodedBodySize})),domNodes:document.querySelectorAll('*').length};});
    return {throttle,viewport:'1440x900',typedCharacters:prompt.length+1,method:'Native Playwright sequential input with 20ms delay; capture listener to app-completed bubble listener; next requestAnimationFrame is a scheduling proxy, not physical input/display latency',...timings};
  });
  return {browser:browser.version(),base,clock:'paused/accelerated in mechanics, real unmocked clock in performance cases',results,errors};
}
