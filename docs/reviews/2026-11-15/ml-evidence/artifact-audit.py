"""Read-only artifact/environment audit; no source dataset or model mutation."""
import hashlib, importlib.metadata, json, pathlib, platform, subprocess, sys

root = pathlib.Path(__file__).resolve().parents[4]
out = pathlib.Path(__file__).resolve().parent
def read(path): return json.loads((root/path).read_text())
def canonical(value): return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
model = read('typing-app/client/src/generated/model.json')
report = read('typing-app/client/src/generated/benchmark.json')
experiment = read('ml/experiment.json')
versions = {}
for name in ['numpy','scipy','scikit-learn','joblib','threadpoolctl']:
    try: versions[name]=importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError: versions[name]='not installed in this interpreter'
paths=['typing-app/client/src/generated/model.json','typing-app/client/src/generated/benchmark.json','ml/experiment.json','ml/fixtures/parity.json']
hashes={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths}
eligible_rates={dimension:{name:{'eligible':v.get('eligible_trial',0),'trials':sum(v.values()),'eligibleFraction':v.get('eligible_trial',0)/sum(v.values())} for name,v in report['audit'][dimension].items()} for dimension in ['speedStrata','errorStrata']}
result={'scope':{'commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'python':sys.version,'executable':sys.executable,'platform':platform.platform(),'packages':versions,'rawDataDirectoryPresent':(root/'ml/data').exists()},
        'artifactByteSha256':hashes,'canonicalModelSha256':canonical(model),'canonicalEvaluationSha256':canonical(report['evaluation']),
        'matches':{'artifactHash':canonical(model)==report['hashes']['artifactSha256'],'modelReportVersion':model['modelVersion']==report['modelVersion'],'reportProvenance':model['provenance']['reportVersion']==report['reportVersion'],'configRegistration':experiment['configSha256']==model['provenance']['configSha256']==report['hashes']['configSha256']},
        'versions':{'model':model['modelVersion'],'report':report['reportVersion'],'baseline':model['baseline']},
        'residualLogQuantiles':model['residualLogQuantiles'],'slices':report['evaluation']['slices'],'ranking':report['evaluation']['ranking'],'eligibleRates':eligible_rates,'validationBaselines':report['validationBaselines'],'validationModels':report['validationModels']}
(out/'artifact-audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
