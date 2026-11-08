import { REPOSITORY } from "./model";
export type PullFile = { path: string; status: string; additions: number; deletions: number; patch: string; truncated: boolean };
export type PullRisk = { level: "low" | "review"; kind: "dependency" | "code" | "manual"; reason: string; priority: "critical" | "high" | "medium" | "low"; version: number; rule?: string; path?: string };
export type PullReview = { risk?: PullRisk; number: number; title: string; body: string; url: string; state: "open" | "closed" | "merged"; draft: boolean; head: string; base: string; branch: string; author: string; mergeable: boolean | null; checks: { name: string; state: string }[]; files: PullFile[]; additions: number; deletions: number; changedFiles: number; updatedAt: string; truncated: boolean };
export type PullCommand = { claimed_at?: string | null; finished_at?: string | null; automatic?: boolean; id: string; kind: string; pr_number: number | null; expected_head: string | null; expected_base: string | null; status: string; message: string; requested_at: string; claimed_run: string | null };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number) => { if (typeof v !== "string" || v.length > max) throw Error("Invalid PR field"); return v; };
const count = (v: unknown) => { if (!Number.isInteger(v) || Number(v)<0 || Number(v)>1e7) throw Error("Invalid PR count"); return Number(v); };
export function parsePull(value: unknown): PullReview {
 if (!object(value) || !Number.isInteger(value.number) || Number(value.number)<1 || !["open","closed","merged"].includes(String(value.state)) || !/^[a-f0-9]{40}$/.test(String(value.head)) || !/^[a-f0-9]{40}$/.test(String(value.base)) || typeof value.draft!=="boolean" || ![true,false,null].includes(value.mergeable as boolean | null) || !Array.isArray(value.files) || value.files.length>100 || !Array.isArray(value.checks) || value.checks.length>100) throw Error("Invalid PR snapshot");
 if (!Number.isFinite(Date.parse(String(value.updatedAt)))) throw Error("Invalid PR date");
 let risk: PullRisk | undefined;
 if(value.risk!==undefined){const r=value.risk;if(!object(r)||!["low","review"].includes(String(r.level))||!["dependency","code","manual"].includes(String(r.kind))||!["critical","high","medium","low"].includes(String(r.priority))||r.version!==1)throw Error("Invalid risk policy");risk={level:r.level as PullRisk["level"],kind:r.kind as PullRisk["kind"],reason:str(r.reason,1000),priority:r.priority as PullRisk["priority"],version:1,...(r.rule?{rule:str(r.rule,200)}:{}),...(r.path?{path:str(r.path,1000)}:{})};}
 const number=Number(value.number);const url=`https://github.com/${REPOSITORY}/pull/${number}`;
 if (value.url!==url) throw Error("Invalid PR URL");
 return { ...(risk?{risk}:{}),number,title:str(value.title,500),body:str(value.body,12000),url,state:value.state as PullReview["state"],draft:value.draft,head:String(value.head),base:String(value.base),branch:str(value.branch,250),author:str(value.author,150),mergeable:value.mergeable as boolean|null,checks:value.checks.map(c=>{if(!object(c))throw Error("Invalid check");return{name:str(c.name,200),state:str(c.state,100)};}),files:value.files.map(f=>{if(!object(f)||typeof f.truncated!=="boolean")throw Error("Invalid file");return{path:str(f.path,1000),status:str(f.status,50),additions:count(f.additions),deletions:count(f.deletions),patch:str(f.patch,20000),truncated:f.truncated};}),additions:count(value.additions),deletions:count(value.deletions),changedFiles:count(value.changedFiles),updatedAt:str(value.updatedAt,50),truncated:value.truncated===true };
}

export function reviewHref(url: string): string {
 const match=url.match(/^https:\/\/github\.com\/tmorr16-coder\/morris-hub\/pull\/(\d+)$/);
 return match ? `/home/admin/security/pulls/${match[1]}` : url;
}
/** Commands arrive newest first; successful retries and closed PRs clear old alerts. */
export function activeMergeIssues(pulls: {number:number;snapshot:PullReview}[],commands:PullCommand[]):string[]{
 const latest=new Map<number,PullCommand>();
 for(const c of commands)if(c.kind==='merge'&&c.pr_number&&!latest.has(c.pr_number))latest.set(c.pr_number,c);
 return [...latest.values()].filter(c=>c.status==='blocked'&&(!pulls.find(p=>p.number===c.pr_number)||pulls.find(p=>p.number===c.pr_number)?.snapshot.state==='open')).map(c=>`PR #${c.pr_number}: ${c.message}`);
}
