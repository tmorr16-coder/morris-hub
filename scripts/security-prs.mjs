import {appendFile} from 'node:fs/promises';
import {assessPull} from './security-risk.mjs';
import {pathToFileURL} from 'node:url';
export const REPO='tmorr16-coder/morris-hub';
export function eligiblePull(pr){return pr.head?.repo?.full_name===REPO&&pr.base?.ref==='main'&&(/^security\/(cyber-agent-|compatible-dependency-fixes)/.test(pr.head.ref)||pr.user?.login==='dependabot[bot]');}
export async function pullSnapshot(api,number){
 const pr=await api(`/repos/${REPO}/pulls/${number}`);
 if(!eligiblePull(pr))throw Error('This PR is outside the security review queue.');
 const [files,status,checks,main]=await Promise.all([api(`/repos/${REPO}/pulls/${number}/files?per_page=100`),api(`/repos/${REPO}/commits/${pr.head.sha}/status`),api(`/repos/${REPO}/commits/${pr.head.sha}/check-runs?per_page=100`),api(`/repos/${REPO}/git/ref/heads/main`)]);
 let remaining=120000;
 const snapshot={number:pr.number,title:pr.title.slice(0,500),body:(pr.body??'').slice(0,12000),url:pr.html_url,state:pr.merged_at?'merged':pr.state,draft:pr.draft,head:pr.head.sha,base:main.object.sha,branch:pr.head.ref,author:pr.user.login,mergeable:pr.mergeable??null,checks:[...(status.statuses??[]).map(s=>({name:s.context.slice(0,200),state:s.state.slice(0,100)})),...(checks.check_runs??[]).map(c=>({name:c.name.slice(0,200),state:(c.conclusion??c.status).slice(0,100)}))].slice(0,100),files:files.map(f=>{const raw=f.patch??'';const patch=raw.slice(0,Math.min(20000,remaining));remaining-=patch.length;return{path:f.filename,status:f.status,additions:f.additions,deletions:f.deletions,patch,truncated:raw.length>patch.length||(!f.patch&&f.changes>0)};}),additions:pr.additions,deletions:pr.deletions,changedFiles:pr.changed_files,updatedAt:pr.updated_at,truncated:files.length<pr.changed_files||remaining===0};
 return{...snapshot,risk:await assessPull(api,snapshot)};
}
async function assertReviewed(api,command){
 const pr=await api(`/repos/${REPO}/pulls/${command.pr_number}`);
 if(!eligiblePull(pr)||pr.state!=='open'||pr.draft||pr.head.sha!==command.expected_head)throw Error('PR changed. Refresh the review and request merge again.');
 const base=await api(`/repos/${REPO}/git/ref/heads/main`);
 if(base.object.sha!==command.expected_base)throw Error('Main changed. Refresh the review before merging.');
 if(pr.mergeable===false)throw Error('This PR has conflicts. Resolve them before merging.');
 return pr;
}
async function assertAutomatic(api,command,authorize){
 if(!command.automatic)return null;
 if(!await authorize(command.id))throw Error('Automation paused by administrator.');
 const snapshot=await pullSnapshot(api,command.pr_number);
 if(snapshot.risk.level!=='low')throw Error(snapshot.risk.reason);
 return snapshot;
}
export async function prepareMerge(api,command,authorize=async()=>false){
 const automatic=await assertAutomatic(api,command,authorize);
 await assertReviewed(api,command);
 if(!/^[a-f0-9-]{36}$/.test(command.id))throw Error('Invalid merge request');
 const preview=`security/merge-preview-${command.id}`;
 let ref;
 try{await api(`/repos/${REPO}/git/refs`,'POST',{ref:`refs/heads/${preview}`,sha:command.expected_base});ref={object:{sha:command.expected_base}};}
 catch(error){if(error.status!==422)throw error;ref=await api(`/repos/${REPO}/git/ref/heads/${preview}`);}
 if(ref.object.sha===command.expected_base){
  await api(`/repos/${REPO}/merges`,'POST',{base:preview,head:command.expected_head,commit_message:`Validate reviewed security PR #${command.pr_number}`});
  ref=await api(`/repos/${REPO}/git/ref/heads/${preview}`);
 }
 const commit=await api(`/repos/${REPO}/git/commits/${ref.object.sha}`);
 let valid=commit.parents?.[0]?.sha===command.expected_base&&commit.parents?.[1]?.sha===command.expected_head;
 if(ref.object.sha===command.expected_head){const comparison=await api(`/repos/${REPO}/compare/${command.expected_base}...${command.expected_head}`);valid=comparison.merge_base_commit?.sha===command.expected_base&&comparison.status==='ahead';}
 if(!valid||!commit.tree?.sha)throw Error('Merge preview did not match the reviewed versions. Refresh and try again.');
 return{...command,candidate:ref.object.sha,candidateTree:commit.tree.sha,preview,...(automatic?{risk:automatic.risk,paths:automatic.files.map(f=>f.path)}:{})};
}
export async function mergeReviewed(api,plan,validation,authorize=async()=>false){
 if(validation!=='success')throw Error('Pre-merge tests or build did not pass. Nothing was merged.');
 const pr=await api(`/repos/${REPO}/pulls/${plan.pr_number}`);
 if(pr.merged_at&&pr.head.sha===plan.expected_head)return{merged:true};
 await assertAutomatic(api,plan,authorize);
 await assertReviewed(api,plan);
 const candidate=await api(`/repos/${REPO}/git/commits/${plan.candidate}`);
 if(candidate.tree?.sha!==plan.candidateTree)throw Error('Merge preview changed after validation. Refresh and try again.');
 const result=await api(`/repos/${REPO}/pulls/${plan.pr_number}/merge`,'PUT',{sha:plan.expected_head,merge_method:'squash',commit_title:`Apply reviewed security fix #${plan.pr_number}`});
 if(!result.merged)throw Error('GitHub blocked the merge. Check repository rules and required checks.');
 return result;
}
async function api(path,method='GET',body){const r=await fetch(`https://api.github.com${path}`,{method,headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2026-03-10'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000),redirect:'error'});if(!r.ok){const e=await r.json().catch(()=>({}));const error=Error(`GitHub HTTP ${r.status}: ${String(e.message??'request failed').slice(0,300)}`);error.status=r.status;throw error;}return r.status===204?{}:r.json();}
async function oidc(){const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);url.searchParams.set('audience','https://morrisai.family/api/security/reports');const r=await fetch(url,{headers:{Authorization:`Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Worker identity unavailable');return(await r.json()).value;}
async function authorize(id){const r=await fetch(`https://morrisai.family/api/security/pulls?id=${id}`,{headers:{Authorization:`Bearer ${await oidc()}`},signal:AbortSignal.timeout(30000),redirect:'error'});return r.ok&&(await r.json()).allowed===true;}
async function deliver(pulls,results=[]){for(let attempt=0;attempt<8;attempt++){try{const r=await fetch('https://morrisai.family/api/security/pulls',{method:'POST',headers:{Authorization:`Bearer ${await oidc()}`,'Content-Type':'application/json'},body:JSON.stringify({runId:process.env.GITHUB_RUN_ID,pulls,results}),signal:AbortSignal.timeout(60000),redirect:'error'});if(r.ok&&r.headers.get('content-type')?.includes('application/json'))return;}catch{/* retry rollout/network errors */}if(attempt<7)await new Promise(r=>setTimeout(r,20000));}throw Error('Could not update in-platform PR review.');}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const mode=process.argv[2];
 if(mode==='sync'){const pulls=await api(`/repos/${REPO}/pulls?state=all&sort=updated&direction=desc&per_page=100`);const requested=JSON.parse(process.env.PR_NUMBERS??'[]');const numbers=[...new Set([...requested,...pulls.filter(eligiblePull).slice(0,20).map(p=>p.number)])].slice(0,30);const snapshots=[];for(const number of numbers)snapshots.push(await pullSnapshot(api,number));await deliver(snapshots);console.log(`Updated ${snapshots.length} in-platform PR reviews.`);}
 else if(mode==='prepare'){const commands=JSON.parse(process.env.MERGE_COMMANDS??'[]');const plans=[],results=[];for(const c of commands){try{plans.push(await prepareMerge(api,c,authorize));}catch(e){results.push({id:c.id,status:'blocked',message:e.message.slice(0,1000)});}}await appendFile(process.env.GITHUB_OUTPUT,`plans=${JSON.stringify(plans)}\n`);if(results.length)await deliver([],results);}
 else if(mode==='merge'){const plans=JSON.parse(process.env.MERGE_PLANS??'[]');const results=[],pulls=[];let merged=false;for(const p of plans){try{await mergeReviewed(api,p,process.env.MERGE_VALIDATION,authorize);merged=true;results.push({id:p.id,status:'merged',message:'Merged after fresh tests and build. A follow-up scan will confirm resolved findings.'});}catch(e){results.push({id:p.id,status:'blocked',message:e.message.slice(0,1000)});}try{pulls.push(await pullSnapshot(api,p.pr_number));}catch{/* command result still records failures */}}await deliver(pulls,results);for(const p of plans){if(p.preview)try{const ref=await api(`/repos/${REPO}/git/ref/heads/${p.preview}`);if(ref.object.sha===p.candidate)await api(`/repos/${REPO}/git/refs/heads/${p.preview}`,'DELETE');}catch{console.warn('Could not remove validation preview branch.');}}if(merged)await api(`/repos/${REPO}/actions/workflows/security-review.yml/dispatches`,'POST',{ref:'main'});console.log('Merge requests reported to platform.');}
 else throw Error('Expected sync, prepare or merge');
}
