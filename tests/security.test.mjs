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
const report=()=>({runId:'100',attempt:1,sha:'a'.repeat(40),completed:['dependencies'],findings:[{key:'dependencies:pkg:123',source:'dependencies',title:'Package issue',severity:'medium',location:'pkg',url:'https://github.com/advisories/GHSA-1234-1234-1234',remediation:'Review update'}],errors:[],fixUrl:null,repairs:[]});
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
  const auth=await load('../lib/security/auth.ts',{'server-only':{},'jose':{createRemoteJWKSet:()=>({}),jwtVerify:async()=>({payload:signed})},'./model':m});
  const route=await load('../app/api/security/reports/route.ts',{'@/lib/security/auth':auth,'@/lib/security/model':m,'@/lib/security/server':{securityDb:()=>({rpc:async()=>{writes++;return {error:null};},from:()=>({update:()=>({eq:()=>({eq:async()=>({error:null})})})})}),sendSecurityAlerts:async()=>{}}});
  const request=(body=report(),auth=true)=>new Request('https://morrisai.family/api/security/reports',{method:'POST',headers:auth?{authorization:'Bearer signed'}:{},body:JSON.stringify(body)});
  assert.equal((await route.POST(request(report(),false))).status,401);signed={...claims(),repository_id:'wrong'};assert.equal((await route.POST(request())).status,401);signed=claims();assert.equal((await route.POST(request({...report(),sha:'b'.repeat(40)}))).status,400);assert.equal(writes,0);assert.equal((await route.POST(request())).status,200);assert.equal(writes,1);
});
test('Bible names MAI voice and shows the chapter plus actual verse number',async()=>{
  const reader=await readFile(new URL('../app/bible/read/[bookId]/[chapter]/ChapterReader.tsx',import.meta.url),'utf8');
  assert.match(reader,/MAI voice/);assert.match(reader,/chapterData\.verses\[readingVerseIdx\]\.number/);assert.doesNotMatch(reader,/Buddy’s voice/);
});
test('notification failures remain pending and successful provider acceptance is recorded',async()=>{
  const crypto=await import('node:crypto');let fail=true;const queued=new Map();let sendCount=0;
  const db={from(table){const q={select:()=>q,eq:()=>q,single:async()=>({data:{enabled:true,frequency:"daily"},error:null}),is:()=>q,not:()=>q,order:()=>q,range:async()=>({data:[],error:null}),limit:async()=>({data:table==='security_runs'?[{run_id:'100',received_at:new Date().toISOString(),errors:['CodeQL unavailable'],fix_url:null}]:[],error:null}),upsert:async(value)=>{if(!queued.has(value.id))queued.set(value.id,{...value,sent_at:null,attempts:0});return {error:null};},update:(patch)=>({eq:async(_,id)=>{Object.assign(queued.get(id),patch);return {error:null};}})};return q;},rpc:async()=>({data:[...queued.values()].filter(m=>!m.sent_at).map(m=>({...m,attempts:++m.attempts})),error:null})};
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
const scheduling=await load('../lib/security/schedule.ts');
test('schedule validates inputs, handles weekly and Eastern DST, and pauses cleanly',()=>{
  const config={enabled:true,frequency:'daily',time:'07:17',weekday:1};
  assert.equal(scheduling.nextReview(config,Date.parse('2026-11-01T00:00:00Z')),'2026-11-01T12:17:00.000Z');
  assert.equal(scheduling.nextReview({...config,frequency:'weekly'},Date.parse('2026-11-01T00:00:00Z')),'2026-11-02T12:17:00.000Z');
  assert.equal(scheduling.nextReview({...config,time:'01:30'},Date.parse('2026-11-01T05:30:00Z'),'2026-11-01'),'2026-11-02T06:30:00.000Z');
  assert.equal(scheduling.nextReview({...config,enabled:false}),null);
  assert.throws(()=>scheduling.parseSchedule({...config,time:'25:00'}));assert.throws(()=>scheduling.parseSchedule({...config,weekday:8}));
});
test('scan requests and schedule writes require admin and reject malformed settings',async()=>{
 let allowed=false,writes=0;const dependencies={'@/lib/supabase/auth-utils':{requireAdmin:async()=>{if(!allowed)throw Error('Admin access required');return{id:'admin'};}},'@/lib/security/server':{securityDb:()=>({rpc:async()=>{writes++;return{error:null};}})},'@/lib/security/schedule':scheduling,'next/cache':{revalidatePath:()=>{}}};
 const actions=await load('../app/home/admin/security/actions.ts',dependencies);assert.match((await actions.requestSecurityScan()).error,/Admin/);assert.equal(writes,0);allowed=true;
 const invalid=new FormData();invalid.set('time','25:00');assert.ok((await actions.saveSecuritySchedule({},invalid)).error);assert.equal(writes,0);
 const form=new FormData();for(const[k,v]of Object.entries({enabled:'on',frequency:'weekly',time:'08:45',weekday:'2',version:'1'}))form.set(k,v);assert.ok((await actions.saveSecuritySchedule({},form)).message);await actions.requestSecurityScan();assert.equal(writes,2);
});
test('queue endpoint requires the signed worker and binds claims to its database decision',async()=>{
 let authenticated=false,args;
 const route=await load('../app/api/security/queue/route.ts',{'@/lib/security/auth':{verifySecurityWorkflow:async()=>{if(!authenticated)throw Error('Unauthorized');return {run_id:'17',event_name:'schedule',sha:'a'.repeat(40)};}},'@/lib/security/server':{securityDb:()=>({from:()=>({select:()=>({order:()=>({limit:async()=>({data:[{synced_at:new Date().toISOString()}],error:null})}),eq:()=>({single:async()=>({data:{enabled:false,frequency:'daily',time:'07:17',weekday:1,next_due:null,version:3},error:null})})})}),rpc:async(name,p)=>{if(name==='claim_security_pr_commands')return{data:[],error:null};args=p;return {data:false,error:null};}})},'@/lib/security/schedule':scheduling});
 const request=()=>new Request('https://morrisai.family/api/security/queue',{method:'POST'});assert.equal((await route.POST(request())).status,401);assert.equal(args,undefined);authenticated=true;assert.deepEqual(await (await route.POST(request())).json(),{should_run:false,repair:false,targets:[],merges:[],sync_pulls:false,pull_numbers:[]});assert.deepEqual(args,{rid:'17',event:'schedule',expected_version:3,following_due:null,head_sha:'a'.repeat(40)});
});
test('workflow queue gate retries HTML readiness responses instead of parsing them as JSON',async()=>{
 const yaml=await readFile(new URL('../.github/workflows/security-review.yml',import.meta.url),'utf8');
 const script=yaml.match(/script: \|\n([\s\S]*?)\n  review:/)[1];
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;const gate=new AsyncFunction('core','fetch','setTimeout',script);let calls=0,output;const outputs={};
 await gate({getIDToken:async()=> 'fixture-token',setOutput:(name,value)=>{output=[name,value];outputs[name]=value;}},async()=>++calls===1?new Response('<html>Deployment in progress</html>',{headers:{'content-type':'text/html'}}):Response.json({should_run:false}),(fn)=>fn());
 assert.equal(calls,2);assert.deepEqual(output,['pull_numbers','[]']);assert.equal(outputs.should_run,'false');
});
test('Fix now requires admin and never accepts arbitrary repair commands',async()=>{
 let allowed=false,writes=0;const actions=await load('../app/home/admin/security/actions.ts',{'@/lib/supabase/auth-utils':{requireAdmin:async()=>{if(!allowed)throw Error('Admin access required');return{id:'admin'};}},'@/lib/security/server':{securityDb:()=>({rpc:async(name,args)=>{assert.equal(name,'queue_security_repair');assert.equal(args.finding_key,'codeql:fixture');writes++;return{error:null};}})},'@/lib/security/schedule':scheduling,'next/cache':{revalidatePath:()=>{}}});
 const form=new FormData();form.set('finding','codeql:fixture');assert.match((await actions.requestSecurityFix({},form)).error,/Admin/);assert.equal(writes,0);allowed=true;assert.ok((await actions.requestSecurityFix({},form)).message);assert.equal(writes,1);
});
test('repair reports reject foreign PR URLs and unknown repair states',()=>{
 assert.throws(()=>m.parseReport({...report(),repairs:[{key:'codeql:fixture',status:'fixed',message:'claim',url:''}]}));
 assert.throws(()=>m.parseReport({...report(),repairs:[{key:'codeql:fixture',status:'pr_created',message:'claim',url:'https://evil.example/pr/1'}]}));
});
