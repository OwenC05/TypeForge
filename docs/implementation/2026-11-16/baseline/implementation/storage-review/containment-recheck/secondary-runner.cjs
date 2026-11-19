module.exports = async (page) => {
  const browser=page.context().browser(),results=[];
  for(const kind of ['upgrade','delete','member']){
    const context=await browser.newContext(),p=await context.newPage(),pageErrors=[];
    p.on('pageerror',error=>pageErrors.push(String(error)));
    let result,cleanup,harnessError;
    try {
      await p.goto('http://127.0.0.1:5325/docs/implementation/2026-11-16/baseline/implementation/storage-review/containment-recheck/probe.html');
      result=await p.evaluate(async kind=>{window.secondary=await import('./secondary.js');return window.secondary.run(kind,'typeforge-c-independent-'+crypto.randomUUID());},kind);
    }catch(error){harnessError=String(error);}
    finally{
      try{cleanup=await p.evaluate(()=>window.secondary.cleanup());}catch(error){cleanup={error:String(error)};}
      await context.close();
    }
    results.push({...result,harnessError,pageErrors,cleanup});
  }
  return {browser:browser.version(),freshContexts:3,ownedPagesClosed:3,results,assertions:results.reduce((n,r)=>n+(r.assertions||0),0),failedAssertions:results.reduce((n,r)=>n+(r.failures?.length||0),0)};
};
