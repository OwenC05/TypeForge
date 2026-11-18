import * as C from '/typing-app/client/src/coach-storage.ts';
import * as S from '/typing-app/client/src/storage.ts';
import * as original from './probes.js';
const native = indexedDB;
const request = r => new Promise((resolve,reject)=> { r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); r.onblocked=()=>reject(new Error('Owned synthetic DB blocked')); });
const done = tx => new Promise((resolve,reject)=> { tx.oncomplete=resolve; tx.onabort=()=>reject(tx.error ?? new Error('Owned transaction aborted')); });
const source = () => ({ id:'00000000-0000-4000-8000-000000000123',owner:'guest',schemaVersion:1,metricVersion:1,
  completedAt:'2026-11-18T12:00:00.000Z',mode:'assessment',settings:{durationMs:30000,language:'en',qwerty:true,corpusVersion:'1',inputMode:'flow-v1'},
  qualityFlags:[],eligibleForProgress:true,metrics:{elapsedMs:30000,correctCharacters:0,attemptedCharacters:1,correctAttempts:0,accuracy:0,deletedCharacters:0,wpm:0},
  sentences:[],chartSamples:[{elapsedMs:30000,wpm:0,accuracy:0}] });
export async function run(kind,name) {
  let assertions=0; const failures=[],errors=[],rejections=[];
  const check=(condition,message)=> { assertions++; if(!condition)failures.push(message); };
  const error=e=>errors.push(String(e.error ?? e.message)), rejection=e=>rejections.push(String(e.reason));
  window.addEventListener('error',error); window.addEventListener('unhandledrejection',rejection);
  await original.install(name,true);
  async function read(store,key) {
    const db=await request(native.open(name));
    try {const tx=db.transaction(store),r=tx.objectStore(store).get(key);await done(tx);return r.result;} finally {db.close();}
  }
  const oldAbort=IDBTransaction.prototype.abort; let abortCalls=0;
  const armAbort=()=> { IDBTransaction.prototype.abort=function(){abortCalls++;oldAbort.call(this);throw new DOMException('Independent secondary already-aborted exception','InvalidStateError');}; };
  const primary=new DOMException('Independent primary callback fault',kind==='upgrade'?'QuotaExceededError':'UnknownError');
  let details={};
  try {
    if(kind==='upgrade') {
      const value=source(),pending=native.open(name,2);
      pending.onupgradeneeded=()=> {const s=pending.result.createObjectStore(S.STORE,{keyPath:'id'});s.createIndex(S.ORDER_INDEX,['completedAt','id']);s.add(value);};
      (await request(pending)).close();
      const oldAdd=IDBObjectStore.prototype.add; let failure;
      IDBObjectStore.prototype.add=function(...args){if(this.name===S.METADATA_STORE)throw primary;return oldAdd.apply(this,args);};armAbort();
      try{await S.openDatabase();}catch(e){failure=e;}finally{IDBObjectStore.prototype.add=oldAdd;IDBTransaction.prototype.abort=oldAbort;}
      check(failure===primary,'upgrade rejects original primary error despite secondary abort exception');
      check(abortCalls===1,'upgrade calls native abort exactly once');
      const db=await request(native.open(name));check(db.version===2 && [...db.objectStoreNames].join()===S.STORE,'v2 schema/version retained after secondary exception');db.close();
      check(C.canonicalJSON(await read(S.STORE,value.id))===C.canonicalJSON(value),'legacy original bytes retained');
      const capture=await C.captureContext();check(capture!==null,'upgrade succeeds on explicit fault-free retry');
      check(await read(S.CURRENT_STORE,value.id)===undefined && await read(S.MEMBERSHIP_STORE,value.id)===undefined,'retry performs no legacy copy or membership repair');
      const next={...value,id:crypto.randomUUID()};const saved=await C.saveSource(next,capture);
      check(saved.state==='saved'&&saved.membershipReady,'ordinary captured save works after upgrade failure');
      check((await read(S.METADATA_STORE,'authority')).sourceRevision===1,'successful post-retry mutation increments revision once');
      details={rejected:failure.name,abortCalls,saved};
    }else if(kind==='delete') {
      const capture={...await C.captureContext(),purpose:'protected-probe'},value=source();
      const saved=await C.saveSource(value,capture);check(saved.state==='saved'&&saved.membershipReady,'original protected-purpose membership seeded');
      const meta=await read(S.METADATA_STORE,'authority'),member=await read(S.MEMBERSHIP_STORE,value.id);
      let notifications=0;const unsubscribe=C.subscribeStorageInvalidation(()=>notifications++);
      const oldDelete=IDBObjectStore.prototype.delete;let failure;
      IDBObjectStore.prototype.delete=function(...args){if(this.name===S.CURRENT_STORE)throw primary;return oldDelete.apply(this,args);};armAbort();
      try{await C.deleteSource(value.id);}catch(e){failure=e;}finally{IDBObjectStore.prototype.delete=oldDelete;IDBTransaction.prototype.abort=oldAbort;}
      check(failure===primary,'delete rejects primary error despite secondary abort exception');
      check(abortCalls===1,'delete calls native abort once');
      check(C.canonicalJSON(await read(S.CURRENT_STORE,value.id))===C.canonicalJSON(value),'source survives complete delete rollback');
      check(C.canonicalJSON(await read(S.MEMBERSHIP_STORE,value.id))===C.canonicalJSON(member),'exact purpose/capture/member survives rollback');
      check(C.canonicalJSON(await read(S.METADATA_STORE,'authority'))===C.canonicalJSON(meta),'full authority survives rollback');
      check(notifications===0,'failed delete emits no committed notification');
      const retry=await C.saveSource(value,capture);check(retry.state==='saved'&&retry.membershipReady,'identical original-capture save retry reconciles');
      check((await read(S.METADATA_STORE,'authority')).sourceRevision===meta.sourceRevision,'idempotent retry does not increment revision');
      await C.deleteSource(value.id);
      check(await read(S.CURRENT_STORE,value.id)===undefined && await read(S.MEMBERSHIP_STORE,value.id)===undefined,'explicit deletion retry removes source and member together');
      check((await read(S.METADATA_STORE,'authority')).sourceRevision===meta.sourceRevision+1 && notifications===1,'successful deletion retry increments/notifies once');unsubscribe();
      details={rejected:failure.name,abortCalls,retry};
    }else if(kind==='member') {
      const capture=await C.captureContext(),value=source();await C.saveSource(value,capture);
      const beforeMeta=await read(S.METADATA_STORE,'authority'),beforeMember=await read(S.MEMBERSHIP_STORE,value.id);
      const oldGet=IDBObjectStore.prototype.get;let physical=[];
      IDBObjectStore.prototype.get=function(...args){physical.push({store:this.name,key:args[0]});if(this.name===S.MEMBERSHIP_STORE)throw primary;return oldGet.apply(this,args);};armAbort();
      const ledger=C.createPreparationLedger();let page,again;
      try{page=await C.listSavedSourcesPage({cursor:null,ledger});again=await C.listSavedSourcesPage({cursor:page.cursor,ledger});}
      finally{IDBObjectStore.prototype.get=oldGet;IDBTransaction.prototype.abort=oldAbort;}
      check(abortCalls===1,'nested point calls native abort once despite its secondary error');
      check(physical.length===4 && ledger.work.examinedRows===4,'exact four native attempts charged without double settlement');
      check(physical.map(p=>p.store).join()===`${S.METADATA_STORE},${S.CURRENT_STORE},${S.STORE},${S.MEMBERSHIP_STORE}`,'physical requests include missing opposite source and failed member');
      check(page.stop==='failure'&&!page.complete&&page.sources.length===0,'nested failure cannot produce partial successful source page');
      check(again.stop==='failure'&&ledger.terminal==='failure'&&ledger.work.examinedRows===4,'same terminal ledger refuses without new requests');
      check(ledger.work.examinedBytes>0&&ledger.work.examinedBytes<4*1048576,'failed get adds no fabricated bytes or refreshed budget');
      check(C.canonicalJSON(await read(S.METADATA_STORE,'authority'))===C.canonicalJSON(beforeMeta),'failed read leaves metadata unchanged');
      check(C.canonicalJSON(await read(S.MEMBERSHIP_STORE,value.id))===C.canonicalJSON(beforeMember),'failed read leaves exact membership unchanged');
      const nextLedger=C.createPreparationLedger(),retry=await C.listSavedSourcesPage({cursor:null,ledger:nextLedger});
      check(nextLedger.lookupId!==ledger.lookupId&&retry.complete&&retry.sources.length===1,'explicit new fault-free lookup succeeds');
      check(retry.sources[0].membership?.resultSha256===beforeMember.resultSha256,'lookup retry returns original membership without repair');
      check((await C.saveSource(value,capture)).membershipReady,'ordinary exact retry remains ready');
      details={physical,abortCalls,work:ledger.work,retryWork:nextLedger.work};
    }else throw new Error('Unknown secondary case');
    await new Promise(resolve=>setTimeout(resolve,0));
    check(errors.length===0,'no uncaught page error including secondary abort exception');
    check(rejections.length===0,'no unhandled rejection');
    return {kind,database:name,assertions,failures,errors,rejections,details};
  } finally { IDBTransaction.prototype.abort=oldAbort;window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',rejection); }
}
export const cleanup=original.cleanup;
