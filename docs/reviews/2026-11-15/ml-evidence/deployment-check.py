"""Anonymous read-only static deployment check, not a browser or deployment."""
import datetime, hashlib, json, pathlib, re, urllib.parse, urllib.request
out=pathlib.Path(__file__).resolve().parent
root=out.parents[3]
base='https://typeforge-alpha.vercel.app/'
result={'checkedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'url':base,'scope':'HTTP static bytes only; no browser execution; not proof of Git SHA or end-to-end parity'}
try:
    with urllib.request.urlopen(base,timeout=30) as response:
        html=response.read().decode(); result['httpStatus']=response.status
    scripts=re.findall(r'<script[^>]+src="([^"]+)"',html)
    result['scripts']=scripts
    result['bundles']=[]
    for src in scripts:
        url=urllib.parse.urljoin(base,src)
        with urllib.request.urlopen(url,timeout=30) as response: raw=response.read()
        text=raw.decode()
        result['bundles'].append({'url':url,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'modelVersions':sorted(set(re.findall(r'aalto-ridge-[0-9a-f]{12}',text))),'reportVersions':sorted(set(re.findall(r'benchmark-[0-9a-f]{12}',text))),'hasFlowV1': 'flow-v1' in text,'hasHistoryBaseline': 'aalto-smoothed-pair-k1-v1' in text})
except Exception as exc: result['error']=repr(exc)
result['lfNormalizedArtifactHashes']={p:hashlib.sha256((root/p).read_bytes().replace(b'\r\n',b'\n')).hexdigest() for p in ['typing-app/client/src/generated/model.json','typing-app/client/src/generated/benchmark.json']}
(out/'deployment-check.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
