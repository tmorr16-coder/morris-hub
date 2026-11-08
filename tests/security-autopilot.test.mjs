import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {compatibleLockfiles,assessPull,verifyCodeScan} from '../scripts/security-risk.mjs';
import {prepareMerge,mergeReviewed} from '../scripts/security-prs.mjs';
const lock=version=>({lockfileVersion:3,packages:{'':{dependencies:{pkg:'^1.0.0'}},'node_modules/pkg':{version,resolved:`https://registry.npmjs.org/pkg/-/pkg-${version}.tgz`,integrity:'sha512-Zml4dHVyZQ=='}}});
test('automatic dependency policy accepts compatible updates and rejects breaking or supply-chain changes',()=>{
 assert.equal(compatibleLockfiles(lock('1.0.0'),lock('1.1.0')),true);
 for(const version of ['2.0.0','0.9.0','1.0.0-beta'])assert.equal(compatibleLockfiles(lock('1.0.0'),lock(version)),false);
 assert.equal(compatibleLockfiles(lock('0.1.0'),lock('0.2.0')),false);
 assert.equal(compatibleLockfiles(lock('1.1.0'),lock('1.0.1')),false);
 for(const change of [{hasInstallScript:true},{resolved:'https://elsewhere.test/pkg.tgz'},{integrity:''},{link:true}]){const next=lock('1.0.1');Object.assign(next.packages['node_modules/pkg'],change);assert.equal(compatibleLockfiles(lock('1.0.0'),next),false);}
 const next=lock('1.0.1');next.packages['node_modules/extra']={version:'1.0.0'};assert.equal(compatibleLockfiles(lock('1.0.0'),next),false);
 next.packages=lock('1.0.1').packages;next.packages[''].dependencies.pkg='^2.0.0';assert.equal(compatibleLockfiles(lock('1.0.0'),next),false);
});
const presentation=()=>({state:'open',draft:false,mergeable:true,truncated:false,changedFiles:1,files:[{path:'components/Label.tsx',status:'modified',truncated:false}],additions:3,deletions:1,body:'<!-- morris-security-alert:12 -->',base:'a'.repeat(40),head:'b'.repeat(40),checks:[]});
const source='export default function Label({label}:{label:string}) {return <p>{label}</p>}';
const apiFor=(content=source)=>async path=>path.includes('/code-scanning/')?{state:'open',rule:{id:'js/example',security_severity_level:'high'},most_recent_instance:{location:{path:'components/Label.tsx'}}}:{encoding:'base64',size:content.length,content:Buffer.from(content).toString('base64')};
test('automatic code policy allows small stateless presentation fixes and blocks sensitive or unverifiable changes',async()=>{
 assert.equal((await assessPull(apiFor(),presentation())).level,'low');
 for(const changed of [{...presentation(),files:[{path:'app/api/example/route.ts',status:'modified'}]},{...presentation(),files:[{path:'components/auth.tsx',status:'modified'}]},{...presentation(),additions:61},{...presentation(),truncated:true},{...presentation(),draft:true},{...presentation(),checks:[{state:'failure'}]}])assert.equal((await assessPull(apiFor(),changed)).level,'review');
 for(const sensitive of ['fetch(url)','document.cookie','useState(0)','dangerouslySetInnerHTML','href={url}','process.env.SECRET',"import {auth} from '@/lib/auth'"])assert.equal((await assessPull(apiFor(source+sensitive),presentation())).level,'review');
 assert.equal((await assessPull(async()=>{throw Error('offline')},presentation())).level,'review');
});
test('CodeQL evidence is mandatory and changed files must be free of findings before automatic code merge',()=>{
 const plan={automatic:true,risk:{kind:'code',rule:'js/example',path:'components/Label.tsx'},paths:['components/Label.tsx']};
 const report={runs:[{tool:{driver:{name:'CodeQL'}},results:[]}]};
 assert.throws(()=>verifyCodeScan(plan,[]));assert.doesNotThrow(()=>verifyCodeScan(plan,[report]));
 report.runs[0].results=[{ruleId:'js/example',locations:[{physicalLocation:{artifactLocation:{uri:'components/Label.tsx'}}}]}];assert.throws(()=>verifyCodeScan(plan,[report]),/still reports/);
 report.runs[0].results[0].ruleId='js/other-new-risk';assert.throws(()=>verifyCodeScan(plan,[report]),/still reports/);
 report.runs[0].results=[];report.runs[0].invocations=[{executionSuccessful:false}];assert.throws(()=>verifyCodeScan(plan,[report]),/Incomplete/);
});
test('automatic prepare and merge stop when the current platform authorization is missing or paused',async()=>{
 let calls=0;const api=async()=>{calls++;return{}};
 await assert.rejects(prepareMerge(api,{automatic:true,id:'fixture'}),/paused/);assert.equal(calls,0);
 await assert.rejects(mergeReviewed(async()=>({}),{automatic:true,id:'fixture'},'success',async()=>false),/paused/);
});
async function load(path,deps){const {outputText}=ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});const exports={};new Function('require','exports',outputText)(id=>{if(!(id in deps))throw Error(id);return deps[id]},exports);return exports;}
test('Protect now and pause require admin and only call the supported automation RPC',async()=>{
 let allowed=false,args;const a=await load('../app/home/admin/security/actions.ts',{'@/lib/supabase/auth-utils':{requireAdmin:async()=>{if(!allowed)throw Error('Admin required');return{id:'admin'}}},'@/lib/security/server':{securityDb:()=>({rpc:async(name,params)=>{args={name,...params};return{error:null}}})},'@/lib/security/schedule':{},'next/cache':{revalidatePath:()=>{}}});
 assert.match((await a.protectSecurityNow()).error,/Admin/);assert.equal(args,undefined);assert.match((await a.pauseSecurityAutomation()).error,/Admin/);allowed=true;assert.ok((await a.protectSecurityNow()).message);assert.deepEqual(args,{name:'configure_security_automation',actor:'admin',enabled:true,run_now:true});await a.pauseSecurityAutomation();assert.equal(args.enabled,false);assert.equal(args.run_now,false);
});
test('scheduled reviews attempt repairs without a manual repair request when automation is enabled',async()=>{
 const route=await load('../app/api/security/queue/route.ts',{'@/lib/security/auth':{verifySecurityWorkflow:async()=>({run_id:'1',event_name:'schedule',sha:'a'.repeat(40)})},'@/lib/security/schedule':{},'@/lib/security/server':{securityDb:()=>({rpc:async name=>({data:name==='claim_security_scan'?true:[],error:null}),from:table=>({select:()=>({eq:()=>table==='security_config'?{single:async()=>({data:{automation_enabled:true,enabled:false,version:1},error:null})}:{eq:()=>({eq:async()=>({data:[],error:null})})},order:()=>({limit:async()=>({data:[{synced_at:new Date().toISOString()}],error:null})}),is:()=>({limit:async()=>({data:[{key:'finding',severity:'critical'}],error:null})})})})})}});
 const result=await(await route.POST(new Request('https://morrisai.family/api/security/queue',{method:'POST'}))).json();assert.equal(result.automate,true);assert.equal(result.repair,true);assert.equal(result.targets[0].severity,'critical');
});
test('automatic merge authorization is bound to the signed worker run',async()=>{
 let allowed=false,args;const route=await load('../app/api/security/pulls/route.ts',{'@/lib/security/auth':{verifySecurityWorkflow:async()=>{if(!allowed)throw Error('unauthorized');return{run_id:'123'}}},'@/lib/security/server':{securityDb:()=>({rpc:async(name,p)=>{args={name,...p};return{data:true,error:null}}})},'@/lib/security/pulls':{}});
 const req=new Request('https://morrisai.family/api/security/pulls?id=11111111-1111-4111-8111-111111111111');assert.equal((await route.GET(req)).status,401);allowed=true;assert.equal((await(await route.GET(req)).json()).allowed,true);assert.equal(args.rid,'123');
});
test('automatic dependency fixes use the common risk queue and code validation stays isolated',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/security-review.yml',import.meta.url),'utf8');assert.doesNotMatch(workflow,/require\('\.\/scripts\/security-merge.cjs'\)/);assert.match(workflow,/Confirm CodeQL cleared the changed files/);
 const validation=workflow.split('  merge_validation:')[1].split('  merge_apply:')[0];assert.doesNotMatch(validation,/contents: write|id-token: write|secrets\./);assert.match(validation,/upload: false/);
});
