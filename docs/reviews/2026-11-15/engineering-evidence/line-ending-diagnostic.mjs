import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const raw=readFileSync(new URL('../../../../typing-app/client/src/app.ts',import.meta.url),'utf8');
const inspect=source=>{
  const marker="$('#restart').onclick = ";
  const begin=source.indexOf(marker)+marker.length;
  const end=source.indexOf('\n  prepare();\n  const initialEngine',begin);
  const handler=source.slice(begin,end).trim().replace(/;$/,'');
  try{stripTypeScriptTypes(`(${handler})`);return {begin,end,parse:'PASS'};}
  catch(error){return {begin,end,parse:'FAIL',code:error.code,message:error.message};}
};
console.log(JSON.stringify({node:process.version,crlfCount:(raw.match(/\r\n/g)||[]).length,raw:inspect(raw),normalizedDiagnosticOnly:inspect(raw.replace(/\r\n/g,'\n')),limits:'This only parses extracted handler; it does not execute or repair any test.'},null,2));
