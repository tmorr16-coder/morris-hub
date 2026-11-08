/** Uses confirmed worker records rather than guessing job stages or completion percentages. */
type Request = {status:string;requested_at:string;claimed_at?:string|null;claimed_run:string|null};
type Command = {kind:string;status:string;pr_number:number|null;requested_at:string;claimed_at?:string|null;finished_at?:string|null;claimed_run:string|null;message:string};
type Run = {run_id:string;received_at:string;completed:string[];errors:string[];repairs?:{status:string}[]};
export type SecurityActivity = {state:'queued'|'working'|'checking'|'complete'|'attention'|'idle'|'unknown'|'review';title:string;message:string;active:boolean;busy:boolean;startedAt:string|null;reportedAt:string|null;checkedAt:number;runId:string|null;queued:number};
const validRun=(value:unknown)=>/^\d{1,20}$/.test(String(value))?String(value):null;
const time=(value:string|null|undefined)=>value&&Number.isFinite(Date.parse(value))?Date.parse(value):0;
export function securityActivity({config,requests,runs,commands=[],pulls=[],available=true,now=Date.now()}:{config:{last_started_at?:string|null;last_started_run?:string|number|null};requests:Request[];runs:Run[];commands?:Command[];pulls?:{number:number;snapshot:{state:string;risk?:{level:string};branch?:string}}[];available?:boolean;now?:number}):SecurityActivity {
 const latest=runs[0];
 const running=requests.filter(r=>r.status==='running');
 const queued=requests.filter(r=>r.status==='queued');
 const merges=commands.filter(c=>c.kind==='merge'&&['queued','running'].includes(c.status));
 const checking=merges.find(c=>c.status==='running');
 const scanActive=time(config.last_started_at)>time(latest?.received_at);
 const active=!!checking||scanActive||running.length>0||merges.length>0||queued.length>0;
 const started=checking?.claimed_at??(scanActive?config.last_started_at:null)??running[0]?.claimed_at??running[0]?.requested_at??merges[0]?.requested_at??queued[0]?.requested_at??null;
 const base={active,busy:active,startedAt:started,reportedAt:latest?.received_at??null,checkedAt:now,runId:validRun(checking?.claimed_run??(scanActive?config.last_started_run:null)??running[0]?.claimed_run??(active?null:latest?.run_id)),queued:queued.length+merges.filter(c=>c.status==='queued').length};
 if(active&&time(started)&&now-time(started)>2*3600_000)return{...base,busy:false,state:'attention',title:'Progress update overdue',message:'The worker has not confirmed completion for over two hours. Check the run or use Protect now to request recovery.'};
 if(checking)return{...base,state:'checking',title:'Checking and applying fixes',message:'Fresh tests and the build are required before a reviewed fix can merge. A follow-up scan confirms resolution.'};
 if(scanActive||running.length)return{...base,state:'working',title:'Security workflow running',message:'The agent is scanning and preparing supported repairs. Open the active run for individual job stages.'};
 if(queued.length||merges.length)return{...base,runId:null,state:'queued',title:merges.length?'Fix checks queued':'Protection queued',message:'Waiting for the GitHub worker. It checks requests every five minutes; existing jobs and GitHub delays can extend the wait.'};
 if(!available)return{...base,busy:false,state:'unknown',title:'Fix status temporarily unavailable',message:'The scan history is available, but live merge status could not be loaded. This page will retry automatically.'};
 const merged=commands.find(c=>c.kind==='merge'&&c.status==='merged');
 if(merged&&time(merged.finished_at)>time(latest?.received_at))return{...base,busy:false,runId:validRun(merged.claimed_run),state:'complete',title:'Fix merged · confirmation pending',message:'The fix was merged. Findings remain open until the follow-up security scan confirms resolution.'};
 const latestCommands=new Map<number,Command>();for(const c of commands)if(c.kind==='merge'&&c.pr_number&&!latestCommands.has(c.pr_number))latestCommands.set(c.pr_number,c);
 const blocked=[...latestCommands.values()].some(c=>c.status==='blocked'&&pulls.some(p=>p.number===c.pr_number&&p.snapshot.state==='open')&&!c.message.startsWith('Automation paused'));
 const incomplete=latest&&(!latest.completed.includes('codeql')||!latest.completed.includes('dependencies'));
 if(blocked||latest?.errors.length||incomplete||latest?.repairs?.some(r=>r.status==='blocked'||r.status==='validation_failed'))return{...base,busy:false,state:'attention',title:'Finished with items needing attention',message:'The latest work reported incomplete coverage, a blocked repair, or a failed check. Review the items below; open findings stay tracked.'};
 if(pulls.some(p=>p.snapshot.state==='open'&&p.snapshot.risk?.level==='review'&&/^security\//.test(p.snapshot.branch??'')))return{...base,busy:false,state:'review',title:'Fix ready for your review',message:'A proposed security fix falls outside the automatic risk policy. Review it below; eligible routine work continues automatically.'};
 if(latest)return{...base,busy:false,state:'complete',title:'Latest security cycle finished',message:'The latest workflow has reported. Review any remaining findings and decisions below; completion does not mean every finding is fixed.'};
 return{...base,busy:false,state:'idle',title:'Ready for the first security review',message:'Use Protect now to start a scan and supported repairs.'};
}
export function elapsedLabel(start:string|null,now:number):string|null{
 if(!start||!time(start))return null;const seconds=Math.max(0,Math.floor((now-time(start))/1000));if(seconds<60)return`${seconds}s`;const minutes=Math.floor(seconds/60);return minutes<60?`${minutes}m ${seconds%60}s`:`${Math.floor(minutes/60)}h ${minutes%60}m`;
}
