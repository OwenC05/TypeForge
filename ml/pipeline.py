"""Deterministic public-data experiment; synthetic fixtures are tests only."""
import argparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
import csv
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import sys
import threading
import time
import urllib.request
import zlib

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
GENERATED = ROOT.parent / 'typing-app/client/src/generated'
SOURCE = 'https://userinterfaces.aalto.fi/136Mkeystrokes/data/Keystrokes.zip'
NAMES = [f'pair_{a}{b}' for a in 'abcdefghijklmnopqrstuvwxyz' for b in 'abcdefghijklmnopqrstuvwxyz'] + ['word_length','pair_position','user_mean_log_ms','user_log_count','pair_mean_log_ms','pair_log_count']
SEED=42


def digest(value):
    return hashlib.sha256(value if isinstance(value, bytes) else json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def write(path, value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix(path.suffix+'.tmp')
    temp.write_text(json.dumps(value,sort_keys=True,indent=2,allow_nan=False)+'\n')
    temp.replace(path)


def read(name): return json.loads((DATA/name).read_text())


def urlopen_retry(request):
    for attempt in range(5):
        try:
            return urllib.request.urlopen(request, timeout=60)
        except (urllib.error.URLError, TimeoutError):
            if attempt == 4:
                raise
            time.sleep(2 ** attempt)


class RangeZip:
    """Read only named members; discover ZIP64 central directory from its footer."""
    def __init__(self, source, cap):
        self.source=source; self.cap=cap; self.used=0; self.lock=threading.Lock(); self.etag=None
        self.local=Path(source) if not source.startswith('https://') else None
        if self.local: self.size=self.local.stat().st_size
        else:
            req=urllib.request.Request(source,method='HEAD')
            with urlopen_retry(req) as r:
                self.size=int(r.headers['Content-Length']); self.etag=r.headers.get('ETag')
        tail=self.fetch(max(0,self.size-65557),self.size)
        at=tail.rfind(b'PK\x05\x06')
        if at<0: raise ValueError('Missing ZIP end directory')
        _,_,_,_,_,size,offset,_=struct.unpack_from('<4s4H2LH',tail,at)
        if size==0xffffffff or offset==0xffffffff:
            locator=at-20
            if tail[locator:locator+4]!=b'PK\x06\x07': raise ValueError('Missing ZIP64 locator')
            pos=struct.unpack_from('<Q',tail,locator+8)[0]
            end=self.fetch(pos,pos+56)
            if end[:4]!=b'PK\x06\x06': raise ValueError('Missing ZIP64 end record')
            size,offset=struct.unpack_from('<QQ',end,40)
        if size>32*1024*1024: raise ValueError('Central directory exceeds expansion cap')
        directory=self.fetch(offset,offset+size)
        self.entries={}; p=0
        while p<len(directory):
            if directory[p:p+4]!=b'PK\x01\x02': raise ValueError('Truncated central directory')
            fields=struct.unpack_from('<4s6H3L5H2L',directory,p)
            method,crc,compressed,expanded=fields[4],fields[7],fields[8],fields[9]
            nl,el,cl=fields[10:13]; off=fields[16]
            if p+46+nl+el+cl>len(directory): raise ValueError('Truncated central directory entry')
            name=directory[p+46:p+46+nl].decode('utf8')
            extra=directory[p+46+nl:p+46+nl+el]; q=0
            while q+4<=len(extra):
                tag,length=struct.unpack_from('<HH',extra,q); val=extra[q+4:q+4+length]; q+=4+length
                if tag==1:
                    k=0
                    if expanded==0xffffffff: expanded=struct.unpack_from('<Q',val,k)[0]; k+=8
                    if compressed==0xffffffff: compressed=struct.unpack_from('<Q',val,k)[0]; k+=8
                    if off==0xffffffff: off=struct.unpack_from('<Q',val,k)[0]
            self.entries[name]=(method,crc,compressed,expanded,off)
            p+=46+nl+el+cl

    def fetch(self,start,end):
        if start<0 or end>self.size or end<start: raise ValueError('Invalid archive range')
        with self.lock:
            self.used+=end-start
            if self.used>self.cap: raise ValueError('Transfer cap exceeded; cache retained; increase explicit --max-bytes')
        if self.local:
            with self.local.open('rb') as f: f.seek(start); data=f.read(end-start)
        else:
            headers={'Range':f'bytes={start}-{end-1}','Accept-Encoding':'identity'}
            if self.etag: headers['If-Match']=self.etag
            with urlopen_retry(urllib.request.Request(self.source,headers=headers)) as r:
                if r.status!=206 or r.headers.get('Content-Range')!=f'bytes {start}-{end-1}/{self.size}': raise ValueError('Server ignored requested range')
                if self.etag and r.headers.get('ETag')!=self.etag: raise ValueError('Source ETag changed')
                data=r.read(end-start+1)
        if len(data)!=end-start: raise ValueError('Truncated/oversized range response')
        return data

    def member(self,name):
        method,crc,size,expanded,off=self.entries[name]
        if expanded>32*1024*1024 or size>32*1024*1024: raise ValueError('Member expansion cap exceeded')
        head=self.fetch(off,off+30)
        if head[:4]!=b'PK\x03\x04': raise ValueError('Bad local ZIP header')
        nl,el=struct.unpack_from('<HH',head,26)
        raw=self.fetch(off+30+nl+el,off+30+nl+el+size)
        if method==8:
            decoder=zlib.decompressobj(-15); result=decoder.decompress(raw,expanded+1)
            if not decoder.eof or decoder.unconsumed_tail: raise ValueError('Truncated/oversized deflate stream')
        elif method==0: result=raw
        else: raise ValueError('Unsupported ZIP compression')
        if len(result)!=expanded or zlib.crc32(result)!=crc: raise ValueError('Member checksum mismatch')
        return result


def acquire(args):
    DATA.mkdir(exist_ok=True)
    if args.participants<=0: raise ValueError('Participant count must be positive')
    if args.seed<0 or args.max_bytes<=0: raise ValueError('Seed must be nonnegative and transfer cap positive')
    if args.participants!=2000: print('EXPLORATORY acquisition: cannot satisfy the 2000-participant release gate',flush=True)
    archive=RangeZip(args.source,args.max_bytes)
    names=sorted(n for n in archive.entries if re.fullmatch(r'Keystrokes/files/\d+_keystrokes.txt',n))
    selected=sorted(names,key=lambda n:digest(f'{args.seed}:{n}'.encode()))[:args.participants]
    if len(selected)!=args.participants: raise ValueError('Insufficient archive participants')
    meta=['Keystrokes/files/metadata_participants.txt','Keystrokes/files/readme.txt']
    if sum(archive.entries[name][3] for name in meta+selected)>1024**3: raise ValueError('Total member expansion exceeds 1 GiB cap')
    cache=DATA/'raw'; cache.mkdir(exist_ok=True)
    def get(name):
        path=cache/Path(name).name
        data=path.read_bytes() if path.exists() else None
        if data is None or len(data)!=archive.entries[name][3] or zlib.crc32(data)!=archive.entries[name][1]:
            data=archive.member(name)
            path.write_bytes(data)
        return {'name':name,'sha256':digest(data),'bytes':len(data),'crc32':archive.entries[name][1]}
    members=[]
    with ThreadPoolExecutor(max_workers=6) as pool:
        for i,result in enumerate(pool.map(get,meta+selected)):
            members.append(result)
            if i%100==0: print(f'acquired {i}/{len(selected)}',flush=True)
    manifest={'sourceUrl':args.source,'etag':archive.etag,'archiveBytes':archive.size,'seed':args.seed,'requestedParticipants':args.participants,'members':members}
    write(DATA/'manifest.json',manifest)
    print(json.dumps({'manifestSha256':digest(manifest),'participants':len(selected),'transferredBytes':archive.used}))


def fingerprint(prompt): return digest(' '.join(prompt.lower().split()).encode())
def reserved(prompt): return int(fingerprint(prompt)[:8],16)%5==0
def partition_participants(ids,seed=SEED):
    ordered=sorted(ids,key=lambda pid:digest(f'{seed}:split:{pid}'.encode()))
    a=int(len(ordered)*.7); b=int(len(ordered)*.85)
    return {pid:'train' if i<a else 'validation' if i<b else 'test' for i,pid in enumerate(ordered)}




def occurrences(prompt):
    result=[]
    for match in re.finditer(r'[A-Za-z]+',prompt):
        word=match.group()
        for i in range(1,len(word)):
            pair=word[i-1:i+1]
            if re.fullmatch('[a-z]{2}',pair): result.append((match.start()+i,pair,len(word),i/(len(word)-1)))
    return result


def observations(prompt,rows):
    typed=[r for r in rows if int(r['KEYCODE'])!=16]
    if ''.join(r['LETTER'] for r in typed)!=prompt: return []
    result=[]
    for position,pair,length,relative in occurrences(prompt):
        delta=float(typed[position]['PRESS_TIME'])-float(typed[position-1]['PRESS_TIME'])
        if math.isfinite(delta) and 0<delta<=5000:
            result.append({'position':position,'pair':pair,'length':length,'relative':relative,'ms':delta,'log':math.log(delta)})
    return result


def summary_history(history):
    count=0; total=0; pairs=defaultdict(lambda:[0,0])
    for sentence in history[-10:]:
        for o in sentence:
            count+=1; total+=o['log']; pairs[o['pair']][0]+=1; pairs[o['pair']][1]+=o['log']
    return count,total,pairs


def features(prompt,position,history,population):
    occ=next(o for o in occurrences(prompt) if o[0]==position)
    count,total,pairs=summary_history(history)
    user=total/count if count else population
    n,s=pairs.get(occ[1],(0,0)); pair=s/n if n else user
    x=[0.0]*682; x[(ord(occ[1][0])-97)*26+ord(occ[1][1])-97]=1
    x[-6:]=[occ[2],occ[3],user,math.log1p(count),pair,math.log1p(n)]
    return x


def tsv(path):
    with path.open(encoding='utf-8-sig',newline='') as f:
        reader=csv.DictReader(f,delimiter='\t',quoting=csv.QUOTE_NONE)
        for row in reader:
            if None in row or any(value is None for value in row.values()):
                raise ValueError(f'Truncated or oversized TSV row in {path.name}')
            yield row


def audit(_args):
    manifest=read('manifest.json'); records=[]; reasons=Counter(); layouts=Counter(); coverage=defaultdict(Counter); error_coverage=defaultdict(Counter)
    metadata_member=next(m for m in manifest['members'] if m['name'].endswith('/metadata_participants.txt'))
    if digest((DATA/'raw/metadata_participants.txt').read_bytes())!=metadata_member['sha256']: raise ValueError('Metadata cache hash mismatch')
    metadata={r['PARTICIPANT_ID']:r for r in tsv(DATA/'raw/metadata_participants.txt')}
    assignments=partition_participants([Path(m['name']).name.split('_')[0] for m in manifest['members'] if m['name'].endswith('_keystrokes.txt')],manifest['seed'])
    for member in manifest['members']:
        if not member['name'].endswith('_keystrokes.txt'): continue
        path=DATA/'raw'/Path(member['name']).name
        if digest(path.read_bytes())!=member['sha256']: raise ValueError('Cache hash mismatch')
        pid=path.name.split('_')[0]; meta=metadata.get(pid,{})
        layouts[meta.get('LAYOUT','missing')]+=1
        if meta.get('LAYOUT')!='qwerty' or meta.get('KEYBOARD_TYPE') not in ('full','laptop'):
            reasons['unsupported_layout_or_keyboard']+=1; continue
        trials=defaultdict(list)
        try:
            event_rows=list(tsv(path))
        except UnicodeDecodeError:
            reasons['invalid_utf8_participant']+=1
            continue
        except ValueError:
            reasons['malformed_tsv_participant']+=1
            continue
        try:
            for r in event_rows:
                float(r['PRESS_TIME']); float(r['KEYSTROKE_ID']); int(r['KEYCODE'])
        except (ValueError, OverflowError):
            reasons['invalid_numeric_participant']+=1
            continue
        for r in event_rows:
            if r['PARTICIPANT_ID']!=pid: raise ValueError('Participant member mismatch')
            trials[r['TEST_SECTION_ID']].append(r)
        ordered=sorted(trials.items(),key=lambda item:(min(float(r['PRESS_TIME']) for r in item[1]),item[0]))
        for trial,rows in ordered:
            rows.sort(key=lambda r:(float(r['PRESS_TIME']),float(r['KEYSTROKE_ID'])))
            prompt=rows[0]['SENTENCE']; reason=None
            if any(not math.isfinite(float(r['PRESS_TIME'])) for r in rows): reason='nonfinite_time'
            elif any(r['SENTENCE']!=prompt or r['USER_INPUT']!=prompt for r in rows): reason='not_exact_final_copy'
            elif any(int(r['KEYCODE'])!=16 and len(r['LETTER'])!=1 for r in rows): reason='unreconstructable_edit_or_control'
            else:
                typed=[r for r in rows if int(r['KEYCODE'])!=16]
                if ''.join(r['LETTER'] for r in typed)!=prompt: reason='not_first_pass_reconstructable'
                elif any(float(b['PRESS_TIME'])<=float(a['PRESS_TIME']) for a,b in zip(typed,typed[1:])): reason='nonincreasing_press_time'
            obs=[] if reason else observations(prompt,rows)
            if not reason and not obs: reason='no_eligible_pairs'
            reasons[reason or 'eligible_trial']+=1
            speed=meta.get('AVG_WPM_15','unknown')
            try: speed=f'{int(float(speed)//20)*20}-{int(float(speed)//20)*20+20}'
            except ValueError: speed='unknown'
            coverage[speed][reason or 'eligible_trial']+=1
            try: error_band='below-2-percent' if float(meta['ERROR_RATE'])<2 else '2-percent-or-more'
            except (ValueError, KeyError): error_band='unknown'
            error_coverage[error_band][reason or 'eligible_trial']+=1
            if obs: records.append({'pid':pid,'trial':trial,'prompt':prompt,'speedBand':speed,'errorBand':error_band,'reserved':reserved(prompt),'split':assignments[pid],'observations':obs})
    for split in ('train','validation','test'):
        if not any(r['split']==split and not r['reserved'] for r in records): raise ValueError(f'Empty usable {split} split')
    write(DATA/'rows.json',records)
    report={'acquiredParticipants':manifest['requestedParticipants'],'eligibleParticipants':len({r['pid'] for r in records}),'eligibleTrials':len(records),'eligibleObservations':sum(len(r['observations']) for r in records),'exclusions':dict(reasons),'exclusionUnits':{'unsupported_layout_or_keyboard':'participants','invalid_utf8_participant':'participants','malformed_tsv_participant':'participants','invalid_numeric_participant':'participants','all_other_reasons':'trials'},'layouts':dict(layouts),'speedStrata':dict(coverage),'errorStrata':dict(error_coverage),'rowsSha256':digest(records),'acquisitionSplits':dict(Counter(assignments.values())),'splits':{s:{'participants':len({r['pid'] for r in records if r['split']==s and not r['reserved']}),'observations':sum(len(r['observations']) for r in records if r['split']==s and not r['reserved'])} for s in ('train','validation','test')}}
    write(DATA/'audit.json',report); print(json.dumps(report))


def macro(errors): return sum(sum(v)/len(v) for v in errors.values())/len(errors) if errors else None


def bootstrap(errors,seed):
    if len(errors)<2: return None
    import numpy as np
    values=np.array([sum(v)/len(v) for _,v in sorted(errors.items())]); rng=np.random.default_rng(seed)
    samples=np.array([rng.choice(values,len(values),replace=True).mean() for _ in range(2000)])
    return np.quantile(samples,[.025,.975]).tolist()


def matrix(records,population,split,include_reserved=False):
    import numpy as np
    from scipy.sparse import csr_matrix
    data=[]; indices=[]; indptr=[0]; ys=[]; info=[]; histories=defaultdict(list)
    for trial in records:
        if trial['split']!=split: continue
        history=histories[trial['pid']]; count,total,pairs=summary_history(history)
        if not trial['reserved'] or include_reserved:
            for o in trial['observations']:
                user=total/count if count else population; n,s=pairs.get(o['pair'],(0,0))
                vector=[o['length'],o['relative'],user,math.log1p(count),s/n if n else user,math.log1p(n)]
                indices.extend([(ord(o['pair'][0])-97)*26+ord(o['pair'][1])-97]+list(range(676,682)))
                data.extend([1]+vector); indptr.append(len(data)); ys.append(o['log'])
                info.append({'pid':trial['pid'],'key':f"{trial['pid']}:{trial['trial']}:{o['position']}",'pair':o['pair'],'reserved':trial['reserved'],'warm':bool(history),'count':count,'pairCount':n,'pairSum':s,'user':user,'prompt':fingerprint(trial['prompt']),'speedBand':trial.get('speedBand','unknown')})
        if not trial['reserved']: history.append(trial['observations']); del history[:-10]
    return csr_matrix((data,indices,indptr),shape=(len(ys),682)),np.array(ys),info


def baseline(info,population,kind,k=0):
    import numpy as np
    return np.array([population if kind=='population' else r['user'] if kind=='user' else (r['pairSum']+k*r['user'])/(r['pairCount']+k) for r in info])


def score(y,pred,info):
    import numpy as np
    errors=defaultdict(list)
    for actual,estimate,r in zip(np.exp(y),np.exp(pred),info): errors[r['pid']].append(float(abs(actual-estimate)))
    return macro(errors)


def freeze_preregistration(config):
    fields=['seed','historySentences','participantSplit','reservedPrompts','primary','secondary','bootstrap','manifestSha256','rowsSha256','baseline']
    registration={key:config[key] for key in fields}
    registration.update({'configSha256':digest(config),'selectedAlpha':config['models']['ridge']['alpha'],'status':'frozen-before-test-unlock','selectionPopulation':'nonreserved validation participants; participant-macro millisecond MAE','alphaCandidates':[.1,1,10,100],'smoothingCandidates':[1,5,20]})
    write(ROOT/'experiment.json',registration)


def parity_inputs():
    return [('cat can',[]), ("aBcd can't cat", [[{'pair':'ca','log':math.log(100)},{'pair':'at','log':math.log(300)}]])]


def train(_args):
    import numpy as np
    import scipy
    import sklearn
    from sklearn.linear_model import Ridge
    from sklearn.preprocessing import StandardScaler
    records=read('rows.json'); population=float(np.mean([o['log'] for r in records if r['split']=='train' and not r['reserved'] for o in r['observations']]))
    x,y,info=matrix(records,population,'train'); vx,vy,vi=matrix(records,population,'validation')
    scaler=StandardScaler(with_mean=False).fit(x); sx=scaler.transform(x); sv=scaler.transform(vx)
    from scipy.sparse import csr_matrix
    fixture_x=csr_matrix([features(prompt,pos,history,population) for prompt,history in parity_inputs() for pos,_,_,_ in occurrences(prompt)])
    candidates=[]
    for kind,k in [('population',0),('user',0),('smoothed-pair',1),('smoothed-pair',5),('smoothed-pair',20)]:
        candidates.append({'kind':kind,'k':k,'maeMs':score(vy,baseline(vi,population,kind,k),vi)})
    chosen=min(candidates,key=lambda c:c['maeMs']); models={}; validation=[]
    for name,dimensions in [('ridge-no-history',678),('ridge',682)]:
        best=None
        for alpha in [.1,1,10,100]:
            estimator=Ridge(alpha=alpha,solver='lsqr',tol=1e-6).fit(sx[:,:dimensions],y)
            pred=estimator.predict(sv[:,:dimensions]); value=score(vy,pred,vi)
            validation.append({'name':name,'alpha':alpha,'maeMs':value})
            if best is None or value<best['maeMs']:
                coeff=(estimator.coef_/scaler.scale_[:dimensions]).tolist()+[0.]*(682-dimensions)
                best={'alpha':alpha,'maeMs':value,'coefficients':coeff,'intercept':float(estimator.intercept_),'parityPredictions':estimator.predict(scaler.transform(fixture_x)[:,:dimensions]).tolist()}
        models[name]=best
    selected=models['ridge']; residual=vy-(vx@np.array(selected['coefficients'])+selected['intercept'])
    config={'seed':read('manifest.json')['seed'],'historySentences':10,'participantSplit':'sha256(seed:split:id) ranked acquired participants: exact 70/15/15 before eligibility','reservedPrompts':'sha256(lowercase whitespace-normalized prompt) modulo 5 == 0','primary':'test/nonreserved/warm participant-macro MAE full ridge minus selected baseline','secondary':['nonreserved-cold','reserved-warm','reserved-cold'],'bootstrap':{'seed':read('manifest.json')['seed'],'unit':'participant','replicates':2000,'interval':.95},'populationMeanLogMs':population,'baseline':{'kind':chosen['kind'],'k':chosen['k'],'version':f"aalto-{chosen['kind']}-k{chosen['k']}-v1"},'models':models,'residualLogQuantiles':dict(zip(['q10','q90'],np.quantile(residual,[.1,.9]).tolist())),'manifestSha256':digest(read('manifest.json')),'rowsSha256':digest(records),'validationBaselines':candidates,'validationModels':validation,'environment':{'python':sys.version,'numpy':np.__version__,'scipy':scipy.__version__,'scikitLearn':sklearn.__version__}}
    if (DATA/'evaluation.json').exists():
        previous=read('config.json')
        if digest(previous)!=digest(config): raise ValueError('Test already unlocked: changed configuration requires a new untouched holdout')
    write(DATA/'config.json',config)
    freeze_preregistration(config)
    print(json.dumps({'configSha256':digest(config),'selectedBaseline':chosen,'selectedAlpha':selected['alpha'],'trainRows':len(y),'validationRows':len(vy)}))


def evaluate(args):
    import numpy as np
    config=read('config.json'); records=read('rows.json')
    if digest(records)!=config['rowsSha256'] or digest(read('manifest.json'))!=config['manifestSha256']: raise ValueError('Frozen inputs changed')
    registration=json.loads((ROOT/'experiment.json').read_text())
    if registration['configSha256']!=digest(config): raise ValueError('Missing/mismatched preregistration; holdout remains locked')
    x,y,info=matrix(records,config['populationMeanLogMs'],'test',True)
    predictors={kind:baseline(info,config['populationMeanLogMs'],kind,min((b for b in config['validationBaselines'] if b['kind']=='smoothed-pair'),key=lambda b:b['maeMs'])['k']) for kind in ['population','user','smoothed-pair']}
    predictors['selected-baseline']=baseline(info,config['populationMeanLogMs'],config['baseline']['kind'],config['baseline']['k'])
    for name,m in config['models'].items(): predictors[name]=x@np.array(m['coefficients'])+m['intercept']
    train_prompts={fingerprint(r['prompt']) for r in records if r['split']=='train' and not r['reserved']}
    slices={}; manifests={}
    for name,is_reserved,warm in [('primary',False,True),('nonreserved-cold',False,False),('reserved-warm',True,True),('reserved-cold',True,False)]:
        ix=[i for i,r in enumerate(info) if r['reserved']==is_reserved and r['warm']==warm]; selected=[info[i] for i in ix]
        manifests[name]=[r['key'] for r in selected]
        if not ix:
            slices[name]={'status':'unavailable','reason':'No eligible observations','participants':0,'observations':0,'metrics':None,'differenceCi95Ms':None}; continue
        metrics={}; difference=defaultdict(list)
        for predictor,values in predictors.items():
            log_errors=defaultdict(list)
            for i in ix: log_errors[info[i]['pid']].append(float(abs(y[i]-values[i])))
            metrics[predictor]={'maeMs':score(y[ix],values[ix],selected),'maeLog':macro(log_errors)}
        for i in ix: difference[info[i]['pid']].append(float(abs(np.exp(y[i])-np.exp(predictors['ridge'][i]))-abs(np.exp(y[i])-np.exp(predictors['selected-baseline'][i]))))
        residual=y[ix]-predictors['ridge'][ix]; q=config['residualLogQuantiles']
        slices[name]={'status':'available','participants':len(difference),'observations':len(ix),'metrics':metrics,'differenceMs':macro(difference),'differenceCi95Ms':bootstrap(difference,config['bootstrap']['seed']),'intervalNote':'Descriptive small-cohort uncertainty; no power guarantee','residualCoverage':float(np.mean((residual>=q['q10'])&(residual<=q['q90']))),'actualTrainPromptOverlapFraction':sum(r['prompt'] in train_prompts for r in selected)/len(selected),'observationKeysSha256':digest(manifests[name])}
    if len(set(k for keys in manifests.values() for k in keys))!=sum(map(len,manifests.values())): raise ValueError('Overlapping evaluation slices')
    # Pair-ranking support is explicitly counted; unsupported participants are not assigned scores.
    pair_errors=defaultdict(lambda:defaultdict(list))
    for i,r in enumerate(info):
        if not r['reserved'] and r['warm']: pair_errors[r['pid']][r['pair']].append((float(y[i]),float(predictors['ridge'][i])))
    from scipy.stats import spearmanr
    rankings=[]
    for pairs in pair_errors.values():
        qualified=[v for v in pairs.values() if len(v)>=8]
        if len(qualified)>=5:
            correlation=float(spearmanr([np.mean([a for a,b in v]) for v in qualified],[np.mean([b for a,b in v]) for v in qualified]).statistic)
            if math.isfinite(correlation): rankings.append(correlation)
    strata={}
    for dimension in ['speedBand','historyCoverage']:
        groups=defaultdict(list)
        for i,r in enumerate(info):
            if not r['reserved'] and r['warm']:
                key=r['speedBand'] if dimension=='speedBand' else ('1-49' if r['count']<50 else '50-199' if r['count']<200 else '200+')
                groups[key].append(i)
        strata[dimension]={key:{'participants':len({info[i]['pid'] for i in ix}),'observations':len(ix),'ridgeMaeMs':score(y[ix],predictors['ridge'][ix],[info[i] for i in ix]),'baselineMaeMs':score(y[ix],predictors['selected-baseline'][ix],[info[i] for i in ix])} for key,ix in groups.items()}
    report={'primaryStrata':strata,'configSha256':digest(config),'slices':slices,'ranking':{'minPairObservations':8,'minPairs':5,'participants':len(rankings),'excludedParticipants':len(pair_errors)-len(rankings),'meanSpearman':float(np.mean(rankings)) if rankings else None,'status':'available' if rankings else 'unavailable'},'promotion':'Experimental only; no TypeForge transfer or training-efficacy evidence'}
    write(DATA/'evaluation-keys.json',manifests); write(DATA/'evaluation.json',report)
    print(json.dumps(report))


def export(_args):
    config=read('config.json'); report=read('evaluation.json'); audit_report=read('audit.json')
    if report['configSha256']!=digest(config): raise ValueError('Evaluation/config mismatch')
    if audit_report['rowsSha256']!=config['rowsSha256'] or digest(read('manifest.json'))!=config['manifestSha256']: raise ValueError('Audit/source differs from frozen experiment')
    if audit_report['acquiredParticipants']!=2000: raise ValueError('Release export requires exactly 2000 acquired participants; exploratory metrics cannot substitute')
    version='aalto-ridge-'+digest(config)[:12]; report_version='benchmark-'+digest(report)[:12]
    artifact={'artifactVersion':1,'featureVersion':1,'modelVersion':version,'status':'experimental','task':{'language':'en','layout':'qwerty','lowercasePairsOnly':True,'historySentences':10,'maxIntervalMs':5000},'featureNames':NAMES,'coefficients':config['models']['ridge']['coefficients'],'intercept':config['models']['ridge']['intercept'],'populationMeanLogMs':config['populationMeanLogMs'],'baseline':config['baseline'],'residualLogQuantiles':config['residualLogQuantiles'],'provenance':{'sourceUrl':SOURCE,'manifestSha256':config['manifestSha256'],'configSha256':digest(config),'reportVersion':report_version}}
    benchmark={'reportVersion':report_version,'modelVersion':version,'status':'experimental','source':{'url':SOURCE,'name':'Aalto 136 million keystrokes','license':'Non-commercial use with attribution; see source terms','termsUrl':'https://userinterfaces.aalto.fi/136Mkeystrokes/'},'audit':audit_report,'splitDesign':{k:config[k] for k in ['participantSplit','reservedPrompts','primary','secondary','bootstrap']},'selectedBaseline':config['baseline'],'selectedAlpha':config['models']['ridge']['alpha'],'validationBaselines':config['validationBaselines'],'validationModels':config['validationModels'],'evaluation':report,'environment':config['environment'],'hashes':{'artifactSha256':digest(artifact),'manifestSha256':config['manifestSha256'],'configSha256':digest(config),'rowsSha256':config['rowsSha256']},'limitations':['Public source lacks focus, composition and key-repeat flags; reconstructable exact copying is not identical browser instrumentation.','Correct-copy filtering introduces selection bias; errors are audited separately.','English physical QWERTY cohort; no cross-layout/mobile claim.','Seen-text means nonreserved prompt partition; actual training overlap is separately reported.','No independent TypeForge transfer validation; historical baseline remains the coach.','Timing prediction accuracy does not establish typing-training efficacy.','Residual bounds describe individual transitions, not pair-average confidence or expected practice improvement.'],'stageTimingsSeconds':read('timings.json') if (DATA/'timings.json').exists() else {},'reproduction':['python -m ml.pipeline acquire --participants 2000 --seed 42 --max-bytes 268435456','python -m ml.pipeline audit','python -m ml.pipeline train','python -m ml.pipeline evaluate --split test','python -m ml.pipeline export']}
    write(GENERATED/'model.json',artifact); write(GENERATED/'benchmark.json',benchmark)
    fixtures=[]
    fitted_predictions=iter(config['models']['ridge']['parityPredictions'])
    for prompt,history in parity_inputs():
        rows=[]
        for position,pair,_,_ in occurrences(prompt):
            vector=features(prompt,position,history,artifact['populationMeanLogMs']); pred=next(fitted_predictions)
            exported=artifact['intercept']+sum(a*b for a,b in zip(vector,artifact['coefficients']))
            if not math.isclose(pred,exported,rel_tol=1e-12,abs_tol=1e-12): raise ValueError('Folded export differs from fitted estimator')
            count,total,pairs=summary_history(history)
            user=total/count if count else artifact['populationMeanLogMs']; n,pair_sum=pairs.get(pair,(0,0))
            b=artifact['baseline']; base=artifact['populationMeanLogMs'] if b['kind']=='population' else user if b['kind']=='user' else (pair_sum+b['k']*user)/(n+b['k'])
            rows.append({'position':position,'pair':pair,'features':vector,'predictedLogMs':pred,'predictedMs':math.exp(pred),'baselineLogMs':base})
        count,total,pairs=summary_history(history)
        fixtures.append({'prompt':prompt,'history':{'count':count,'logSum':total,'pairs':{p:{'count':n,'logSum':s} for p,(n,s) in pairs.items()}},'occurrences':rows})
    stream=[]
    for char,timestamp in zip('cat cat',[0,100,300,400,500,550,650]):
        stream.append({'LETTER':char,'KEYCODE':str(32 if char==' ' else ord(char.upper())),'PRESS_TIME':str(timestamp)})
    retained=observations('cat cat',stream)
    count,total,pairs=summary_history([retained])
    transition_fixture={'prompt':'cat cat','events':stream,'eligibleOccurrences':retained,'historyAfter':{'count':count,'logSum':total,'pairs':{p:{'count':n,'logSum':value} for p,(n,value) in pairs.items()}}}
    write(ROOT/'fixtures/parity.json',{'synthetic':True,'modelVersion':version,'cases':fixtures,'transitionFixture':transition_fixture})
    print(json.dumps({'modelVersion':version,'reportVersion':report_version,'artifactSha256':digest(artifact)}))


def main():
    parser=argparse.ArgumentParser(description=__doc__); sub=parser.add_subparsers(dest='command',required=True)
    p=sub.add_parser('acquire'); p.add_argument('--participants',type=int,default=2000); p.add_argument('--seed',type=int,default=SEED); p.add_argument('--max-bytes',type=int,default=268435456); p.add_argument('--source',default=SOURCE)
    for command in ['audit','train','export']: sub.add_parser(command)
    p=sub.add_parser('evaluate'); p.add_argument('--split',choices=['test'],required=True)
    args=parser.parse_args(); start=time.monotonic(); globals()[args.command](args)
    duration=time.monotonic()-start
    timings=read('timings.json') if (DATA/'timings.json').exists() else {}
    timings[args.command]=round(duration,3); write(DATA/'timings.json',timings)
    print(f'{args.command} completed in {duration:.1f}s',flush=True)

if __name__=='__main__': main()
