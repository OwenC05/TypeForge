// Pass this function to Playwright browser_run_code_unsafe; no new package is required.
module.exports = async (page) => {
  const browser = page.context().browser();
  const url = 'http://127.0.0.1:5321/docs/implementation/2026-11-16/baseline/implementation/storage/containment-follow-up/probe.html';
  const results=[];
  for (const which of ['upgrade-add-throw','delete-sync-throw','mixed-ledger-failed-member','missing-meta-no-repair','max-reset-notification','hash-delete-silent','ready-and-local-admission','final-proof-abort']) {
    const context=await browser.newContext(), p=await context.newPage(), errors=[];
    p.on('pageerror',e=>errors.push(String(e)));
    let result, cleanup;
    try {
      await p.goto(url);
      await p.evaluate(async()=> { window.probe=await import('./independent-probes.js'); await window.probe.install('typeforge-c-independent-'+crypto.randomUUID(), true); });
      result=await p.evaluate(which=>window.probe.run(which),which);
    } catch(e) { result={which,harnessError:String(e)}; }
    finally {
      try { cleanup=await p.evaluate(()=>window.probe.cleanup()); } catch(e){ cleanup={error:String(e)}; }
      await context.close();
    }
    results.push({...result,externalPageErrors:errors,cleanup});
  }
  for (const silent of [false,true]) {
    const context=await browser.newContext(), p=await context.newPage(), peer=await context.newPage(), errors=[];
    p.on('pageerror',e=>errors.push(String(e))); peer.on('pageerror',e=>errors.push(String(e)));
    const database='typeforge-c-independent-'+Date.now().toString(16)+'-'+Math.random().toString(16).slice(2);
    let ready, peerResult, after, notifications, cleanup, harnessError;
    const failures=[]; let assertions=0;
    const check=(x,m)=>{assertions++;if(!x)failures.push(m);};
    try {
      await p.goto(url); await peer.goto(url);
      await p.evaluate(async({database,silent})=>{
        window.probe=await import('./independent-probes.js'); await window.probe.install(database,silent);
        window.notifications={broadcast:0,storage:0,invalidations:0};
        window.addEventListener('storage',e=>{if(e.key==='typeforge-source-invalidation-v3')notifications.storage++;});
        if (!silent) {window.monitor=new BroadcastChannel('typeforge-source-invalidation-v3');monitor.onmessage=()=>notifications.broadcast++;}
        window.c=await import('/typing-app/client/src/coach-storage.ts');
      },{database,silent});
      ready=await p.evaluate(()=>window.probe.tabReady());
      await p.evaluate(()=>{window.unsub=c.subscribeStorageInvalidation(()=>notifications.invalidations++);});
      check(ready==='complete-ready','real primary C+D candidate ready before peer mutation');
      await peer.evaluate(async({database,silent})=>{window.probe=await import('./independent-probes.js'); await window.probe.install(database,silent);},{database,silent});
      peerResult=await peer.evaluate(()=>window.probe.peerDelete());
      if(!silent) await p.waitForFunction(()=>notifications.broadcast>0 && notifications.storage>0 && notifications.invalidations>0);
      after=await p.evaluate(()=>window.probe.afterPeer());
      notifications=await p.evaluate(()=>notifications);
      check(peerResult.deleted,'actual second page completes production delete');
      check(!after.admission.admitted && after.admission.reason==='authority-changed','actual peer deletion invalidates stale admission');
      check(after.frozen,'historical active candidate remains immutable');
      check(silent ? after.after===after.before+1 : after.after===after.before,'silent peer uses charged second barrier; notified peer refuses before physical reread');
      check(silent ? notifications.broadcast===0 && notifications.storage===0 && notifications.invalidations===0 : notifications.broadcast>0 && notifications.storage>0,'notification receipt matches actual enabled/disabled channels');
      check(errors.length===0,'two-page check has no uncaught page errors');
    } catch(e) {harnessError=String(e);}
    finally {
      await peer.close();
      try {await p.evaluate(()=>{window.unsub?.();window.monitor?.close();});cleanup=await p.evaluate(()=>window.probe.cleanup());} catch(e){cleanup={error:String(e)};}
      await context.close();
    }
    results.push({which:silent?'two-tab-silent-barrier':'two-tab-notification',database,assertions,failures,harnessError,ready,peerResult,after,notifications,externalPageErrors:errors,cleanup});
  }
  return {browser:browser.version(),freshContexts:10,ownedPagesClosed:12,results,
    assertions:results.reduce((n,r)=>n+(r.assertions||0),0),
    failedAssertions:results.reduce((n,r)=>n+(r.failures?.length||0),0)};
};
