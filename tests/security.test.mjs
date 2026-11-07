import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { auditFindings, sarifFindings } from '../scripts/security-report.mjs';
async function load(path, dependencies={}) {
  const source=await readFile(new URL(path,import.meta.url),'utf8');
  const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  const exports={}; new Function('require','exports',outputText)(id=>{if(!(id in dependencies))throw Error(id);return dependencies[id];},exports);return exports;
}
const m=await load('../lib/security/model.ts');
const report=()=>({runId:'100',attempt:1,sha:'a'.repeat(40),completed:['dependencies'],findings:[{key:'dependencies:pkg:123',source:'dependencies',title:'Package issue',severity:'medium',location:'pkg',url:'https://github.com/advisories/GHSA-1234-1234-1234',remediation:'Review update'}],errors:[],fixUrl:null});
const claims=()=>({repository:m.REPOSITORY,repository_id:'1247836919',ref:'refs/heads/main',workflow_ref:`${m.REPOSITORY}/.github/workflows/security-review.yml@refs/heads/main`,event_name:'schedule',run_id:'100',run_attempt:'1',sha:'a'.repeat(40)});
test('report validates severity, duplicate keys, coverage, bounded payloads and safe URLs',()=>{
  assert.deepEqual(m.parseReport(report()),report());
  for(const url of ['javascript:alert(1)','https://github.com.evil.test/a','https://github.com/another/repo/security','https://user:password@github.com/advisories/x'])assert.throws(()=>m.parseReport({...report(),fixUrl:url}));
  assert.throws(()=>m.parseReport({...report(),completed:['unknown']}));
  assert.throws(()=>m.parseReport({...report(),findings:[...report().findings,...report().findings]}));
  assert.throws(()=>m.parseReport({...report(),errors:['a'.repeat(1001)]}));
});
test('only the main-branch security workflow from the immutable repository id is trusted',()=>{
  assert.equal(m.trustedClaims(claims()),true);
  for(const change of [{repository_id:'123'},{ref:'refs/pull/3/merge'},{event_name:'pull_request_target'},{workflow_ref:`${m.REPOSITORY}/.github/workflows/evil.yml@refs/heads/main`},{repository:'evil/repo'}])assert.equal(m.trustedClaims({...claims(),...change}),false);
});
test('cron auth fails closed without configured secret',()=>{
  assert.equal(m.cronAuthorized(null,undefined),false);assert.equal(m.cronAuthorized('Bearer undefined',undefined),false);assert.equal(m.cronAuthorized('Bearer abc','abc'),true);assert.equal(m.cronAuthorized('Bearer nope','abc'),false);
});
test('npm audit normalizes moderate severity, preserves no-fix findings and rejects incomplete audits',()=>{
  const findings=auditFindings({vulnerabilities:{package:{severity:'moderate',via:[{title:'Unsafe input',url:'https://github.com/advisories/GHSA-abcd-1234-5678'}],fixAvailable:false}}});
  assert.equal(findings[0].severity,'medium');assert.match(findings[0].remediation,/No npm fix/);assert.match(findings[0].key,/^dependencies:package:/);
  assert.throws(()=>auditFindings({error:{code:'E403'}}));assert.throws(()=>auditFindings({}));assert.deepEqual(auditFindings({vulnerabilities:{}}),[]);
});
test('CodeQL uses security severity and stable fingerprints, and rejects incomplete analysis',()=>{
  const sarif={runs:[{tool:{driver:{rules:[{id:'js/xss',properties:{'security-severity':'8.2'}}]}},results:[{ruleId:'js/xss',message:{text:'Unsafe rendering'},partialFingerprints:{primaryLocationLineHash:'abc'},locations:[{physicalLocation:{artifactLocation:{uri:'app/page.tsx'},region:{startLine:2}}}]}]}]};
  const first=sarifFindings(sarif)[0];assert.equal(first.severity,'high');sarif.runs[0].results[0].locations[0].physicalLocation.region.startLine=8;assert.equal(sarifFindings(sarif)[0].key,first.key);
  assert.throws(()=>sarifFindings({runs:[{invocations:[{executionSuccessful:false}]}]}));assert.throws(()=>sarifFindings({}));
});
test('report ingress rejects unsigned, foreign, and run-mismatched reports before database access',async()=>{
  let signed=claims(),writes=0;
  const route=await load('../app/api/security/reports/route.ts',{'jose':{createRemoteJWKSet:()=>({}),jwtVerify:async()=>({payload:signed})},'@/lib/security/model':m,'@/lib/security/server':{securityDb:()=>({rpc:async()=>{writes++;return {error:null};}}),sendSecurityAlerts:async()=>{}}});
  const request=(body=report(),auth=true)=>new Request('https://morrisai.family/api/security/reports',{method:'POST',headers:auth?{authorization:'Bearer signed'}:{},body:JSON.stringify(body)});
  assert.equal((await route.POST(request(report(),false))).status,401);signed={...claims(),repository_id:'wrong'};assert.equal((await route.POST(request())).status,401);signed=claims();assert.equal((await route.POST(request({...report(),sha:'b'.repeat(40)}))).status,400);assert.equal(writes,0);assert.equal((await route.POST(request())).status,200);assert.equal(writes,1);
});
test('Bible names MAI voice and shows the chapter plus actual verse number',async()=>{
  const reader=await readFile(new URL('../app/bible/read/[bookId]/[chapter]/ChapterReader.tsx',import.meta.url),'utf8');
  assert.match(reader,/MAI voice/);assert.match(reader,/chapterData\.verses\[readingVerseIdx\]\.number/);assert.doesNotMatch(reader,/Buddy’s voice/);
});
test('notification failures remain pending and successful provider acceptance is recorded',async()=>{
  const crypto=await import('node:crypto');let fail=true;const queued=new Map();let sendCount=0;
  const db={from(table){const q={select:()=>q,is:()=>q,not:()=>q,order:()=>q,range:async()=>({data:[],error:null}),limit:async()=>({data:table==='security_runs'?[{run_id:'100',received_at:new Date().toISOString(),errors:['CodeQL unavailable'],fix_url:null}]:[],error:null}),upsert:async(value)=>{if(!queued.has(value.id))queued.set(value.id,{...value,sent_at:null,attempts:0});return {error:null};},update:(patch)=>({eq:async(_,id)=>{Object.assign(queued.get(id),patch);return {error:null};}})};return q;},rpc:async()=>({data:[...queued.values()].filter(m=>!m.sent_at).map(m=>({...m,attempts:++m.attempts})),error:null})};
  const server=await load('../lib/security/server.ts',{'server-only':{},'node:crypto':crypto,'resend':{Resend:class{emails={send:async(payload,opts)=>{sendCount++;assert.equal(payload.to,m.RECIPIENT);assert.match(opts.idempotencyKey,/^security\//);return fail?{error:{message:'Provider unavailable'}}:{data:{id:'email-1'}};}};}},'@/lib/supabase/server':{createServiceClient:()=>({schema:()=>db})},'./model':m});
  const oldKey=process.env.RESEND_API_KEY,oldFrom=process.env.RESEND_FROM_EMAIL;process.env.RESEND_API_KEY='fixture';process.env.RESEND_FROM_EMAIL='alerts@example.test';
  try {await assert.rejects(server.sendSecurityAlerts(),/pending/);assert.equal([...queued.values()][0].sent_at,null);assert.equal([...queued.values()][0].last_error,'Provider unavailable');fail=false;await server.sendSecurityAlerts();assert.equal(queued.size,1);assert.ok([...queued.values()][0].sent_at);await server.sendSecurityAlerts();assert.equal(sendCount,2);}finally{if(oldKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=oldKey;if(oldFrom===undefined)delete process.env.RESEND_FROM_EMAIL;else process.env.RESEND_FROM_EMAIL=oldFrom;}
});
test('automatic merges stop on changed base, unexpected head or extra files and dispatch verification only after merge',async()=>{
  const {default:merge}=await import('../scripts/security-merge.cjs');let base='a',head='b',files=[{filename:'package-lock.json',status:'modified'}],merges=0,dispatches=0;
  const github={rest:{pulls:{get:async()=>({data:{number:1,state:'open',draft:false,head:{sha:head,ref:'security/compatible-dependency-fixes',repo:{full_name:'owner/repo'}},base:{ref:'main',sha:'a'}}}),listFiles:()=>{},merge:async(args)=>{assert.equal(args.sha,'b');merges++;return {data:{merged:true}};}},repos:{getBranch:async()=>({data:{commit:{sha:base}}})},actions:{createWorkflowDispatch:async()=>{dispatches++;}}},paginate:async()=>files};
  const ctx={github,context:{repo:{owner:'owner',repo:'repo'},sha:'a'},core:{info:()=>{}}};
  base='changed';await assert.rejects(merge(ctx,1,'b'),/stopped/);base='a';head='changed';await assert.rejects(merge(ctx,1,'b'),/stopped/);head='b';files.push({filename:'app/page.tsx'});await assert.rejects(merge(ctx,1,'b'),/stopped/);assert.equal(merges,0);assert.equal(dispatches,0);files.pop();await merge(ctx,1,'b');assert.equal(merges,1);assert.equal(dispatches,1);
});

test('CodeQL extension packs preserve high and critical security severity from real SARIF layout',()=>{
  const result=(id,index)=>({ruleId:id,rule:{id,index,toolComponent:{index:0}},message:{text:'Security finding'},locations:[{physicalLocation:{artifactLocation:{uri:'app/page.tsx'},region:{startLine:index+1}}}]});
  const sarif={runs:[{tool:{driver:{name:'CodeQL',rules:[]},extensions:[{name:'codeql/javascript-queries',rules:[{id:'js/xss-through-dom',properties:{'security-severity':'7.8'}},{id:'js/critical-example',properties:{'security-severity':'9.8'}}]}]},results:[result('js/xss-through-dom',0),result('js/critical-example',1)]}]};
  assert.deepEqual(sarifFindings(sarif).map(f=>f.severity),['high','critical']);
});
