import {readFile,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export const POLICY_VERSION=1;
const repo='tmorr16-coder/morris-hub';
const review=(reason,priority='medium')=>({level:'review',kind:'manual',reason,priority,version:POLICY_VERSION});
const sensitivePath=/(^|\/)(api|admin|auth|security|supabase|finance|money|health|billing|payments?|student|buddy|children|family|settings)(\/|[.-])|auth|security|finance|health|student|buddy|child|family|billing|payment|middleware|proxy\.|encryption|access|session|permission|secret/i;
// Full files, not just added lines: state, I/O and security boundaries require review.
const sensitiveCode=/\b(import\s*\(|require\s*\(|fetch|XMLHttpRequest|WebSocket|navigator|window|document|globalThis|global|self|frames|parent|top|location|Reflect|Proxy|constructor|__proto__|setTimeout|setInterval|queueMicrotask|requestAnimationFrame|atob|btoa|process|eval|cookie|localStorage|sessionStorage|supabase|auth|token|password|secret|permission|role|redirect|router|useRouter|useEffect|useLayoutEffect|useActionState|useState|useReducer|useRef|useContext|action|formAction|dangerouslySetInnerHTML|innerHTML|outerHTML|href|src|srcDoc|on\w+|style|use\s+server)\b|https?:|node:|@supabase|@\/lib|\\[ux][0-9a-f]{2}|\bFunction\s*\(/i;
async function contents(api,path,ref){const f=await api(`/repos/${repo}/contents/${path}?ref=${ref}`);if(f.encoding!=='base64'||typeof f.content!=='string'||f.size>1_000_000)throw Error('Full file unavailable');return Buffer.from(f.content,'base64').toString('utf8');}
export function compatibleLockfiles(before,after){
 if(before.lockfileVersion!==after.lockfileVersion||!before.packages||!after.packages||JSON.stringify(before.packages[''])!==JSON.stringify(after.packages['']))return false;
 const keys=Object.keys(before.packages);if(keys.length!==Object.keys(after.packages).length)return false;
 let changed=0;
 for(const key of keys){if(!key)continue;const a=before.packages[key],b=after.packages[key];if(!b)return false;if(JSON.stringify(a)===JSON.stringify(b))continue;changed++;
  const av=/^(\d+)\.(\d+)\.(\d+)$/.exec(a.version??''),bv=/^(\d+)\.(\d+)\.(\d+)$/.exec(b.version??'');
  if(!av||!bv||av[1]!==bv[1]||(av[1]==='0'&&av[2]!==bv[2])||Number(bv[2])<Number(av[2])||(av[2]===bv[2]&&Number(bv[3])<Number(av[3]))||b.hasInstallScript||b.link||!/^https:\/\/registry\.npmjs\.org\//.test(b.resolved??'')||!/^sha512-[A-Za-z0-9+/=]+$/.test(b.integrity??''))return false;
 }
 return changed>0;
}
export async function assessPull(api,p){
 let priority=p.author==='dependabot[bot]'?'low':'medium',alert;
 const marker=p.body.match(/<!-- morris-security-alert:(\d+) -->/);
 if(marker){try{alert=await api(`/repos/${repo}/code-scanning/alerts/${marker[1]}`);priority=alert.rule?.security_severity_level??'medium';if(!['critical','high','medium','low'].includes(priority))priority='medium';}catch{return review('The original security finding could not be verified.');}}
 const lockOnly=p.files.length===1&&p.files[0].path==='package-lock.json';
 if(p.state!=='open'||p.draft||p.mergeable===false||(!lockOnly&&(p.truncated||p.files.some(f=>f.truncated)))||p.files.length!==p.changedFiles||!p.files.length)return review('Draft, conflicting, or incomplete changes need review.',priority);
 if(p.checks.some(c=>['failure','error','timed_out','cancelled','action_required'].includes(c.state)))return review('A reported check failed. Review the failure before retrying.',priority);
 try{
  if(p.files.length===1&&p.files[0].path==='package-lock.json'&&p.files[0].status==='modified'){
   const [a,b]=await Promise.all([contents(api,'package-lock.json',p.base),contents(api,'package-lock.json',p.head)]);
   return compatibleLockfiles(JSON.parse(a),JSON.parse(b))?{level:'low',kind:'dependency',reason:'Compatible lockfile update; no major upgrades, new packages or install scripts.',priority,version:POLICY_VERSION}:review('Dependency structure, install scripts, or a breaking version change needs review.',priority);
  }
  if(!marker||!alert||alert.state!=='open'||!alert.rule?.id)return review('This change needs an identified, open security finding.',priority);
  if(p.files.length>2||p.additions+p.deletions>60||p.files.some(f=>f.status!=='modified'||!/^components\/.+\.tsx$/.test(f.path)||sensitivePath.test(f.path)))return review('This fix touches sensitive logic or exceeds the small presentation-fix scope.',priority);
  const path=alert.most_recent_instance?.location?.path;
  if(!p.files.some(f=>f.path===path))return review('The patch does not match the security finding location.',priority);
  for(const f of p.files){const [a,b]=await Promise.all([contents(api,f.path,p.base),contents(api,f.path,p.head)]);const imports=v=>v.split('\n').filter(l=>/^\s*import\b/.test(l));const beforeImports=imports(a),afterImports=imports(b);if([...beforeImports,...afterImports].some(l=>!/^\s*import\s+.*['"][^'"]+['"];?\s*$/.test(l))||beforeImports.join('\n')!==afterImports.join('\n')||sensitiveCode.test(a)||sensitiveCode.test(b))return review('State, external data, navigation, or a security boundary needs human review.',priority);}
  return{level:'low',kind:'code',reason:'Small, stateless presentation fix; imports and sensitive boundaries are unchanged.',priority,version:POLICY_VERSION,rule:alert.rule.id,path};
 }catch{return review('Full change evidence could not be verified. Human review is required.',priority);}
}
// Runs only in the isolated validation job. Missing SARIF or query metadata fails closed.
export function verifyCodeScan(plan,reports){
 if(!plan.automatic||plan.risk?.kind!=='code')return;
 if(!reports.length||!plan.risk.rule||!plan.risk.path)throw Error('Automatic code fix needs complete CodeQL evidence');
 const paths=new Set(plan.paths);
 for(const sarif of reports){if(!Array.isArray(sarif.runs)||!sarif.runs.length)throw Error('Incomplete CodeQL report');for(const run of sarif.runs){
  if(run.tool?.driver?.name!=='CodeQL'||!Array.isArray(run.results)||run.invocations?.some(i=>i.executionSuccessful===false))throw Error('Incomplete CodeQL analysis');
  for(const r of run.results){const rule=r.ruleId??r.rule?.id;const touched=r.locations?.some(l=>{const uri=decodeURIComponent(l.physicalLocation?.artifactLocation?.uri??'');return [...paths].some(path=>uri===path||uri.endsWith(`/candidate/${path}`));});
   if(touched)throw Error(`CodeQL still reports ${rule??'a finding'} in the changed files. Human review is required.`);
  }
 }}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const plan=JSON.parse(process.env.MERGE_PLAN??'{}');if(plan.automatic&&plan.risk?.kind==='code'){const dir=process.argv[2];const files=(await readdir(dir)).filter(f=>f.endsWith('.sarif'));verifyCodeScan(plan,await Promise.all(files.map(async f=>JSON.parse(await readFile(`${dir}/${f}`,'utf8')))));}}
