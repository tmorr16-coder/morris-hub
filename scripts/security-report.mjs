import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const repo = 'tmorr16-coder/morris-hub';
const digest = value => createHash('sha256').update(value).digest('hex').slice(0,32);
export function auditFindings(audit) {
  if (!audit || audit.error || !audit.vulnerabilities || typeof audit.vulnerabilities !== 'object') throw Error('Dependency audit did not return a complete vulnerability report');
  return Object.entries(audit.vulnerabilities).map(([name,v]) => {
    const advisories = v.via.filter(x => typeof x === 'object');
    const severity = v.severity === 'moderate' ? 'medium' : v.severity === 'info' ? 'low' : v.severity;
    if (!['critical','high','medium','low'].includes(severity)) throw Error('Unknown audit severity');
    const ghsa = advisories.map(a => a.url?.match(/GHSA-[a-z0-9-]+/)?.[0]).filter(Boolean).sort();
    return { key: `dependencies:${name}:${digest(ghsa.join(',') || name)}`, source:'dependencies', title: `${name}: ${advisories[0]?.title ?? 'Vulnerable dependency chain'}`.slice(0,500), severity, location:name.slice(0,500), url:ghsa[0] ? `https://github.com/advisories/${ghsa[0]}` : `https://github.com/${repo}/security/dependabot`, remediation: v.fixAvailable ? 'Automatic compatible dependency fix attempted. Review and merge a validated fix PR; major upgrades require manual review.' : 'No npm fix is available. Review the advisory, replace or mitigate this dependency.' };
  });
}
export function sarifFindings(sarif) {
  if (!Array.isArray(sarif.runs) || !sarif.runs.length) throw Error('CodeQL SARIF missing runs');
  const findings = [];
  for (const run of sarif.runs) {
    if (run.invocations?.some(i => i.executionSuccessful === false)) throw Error('CodeQL analysis was incomplete');
    const components = [run.tool?.driver, ...(run.tool?.extensions ?? [])].filter(Boolean);
    const rules = components.flatMap(component => component.rules ?? []);
    for (const result of run.results ?? []) {
      if (result.suppressions?.some(s => s.status === 'accepted')) continue;
      const ruleId = result.ruleId ?? result.rule?.id;
      const component = Number.isInteger(result.rule?.toolComponent?.index) ? run.tool?.extensions?.[result.rule.toolComponent.index] : run.tool?.driver;
      const indexedRule = component?.rules?.[result.rule?.index];
      const rule = indexedRule?.id === ruleId ? indexedRule : rules.find(r => r.id === ruleId);
      const score = Number(rule?.properties?.['security-severity']);
      const severity = score >= 9 ? 'critical' : score >= 7 ? 'high' : score >= 4 ? 'medium' : Number.isFinite(score) ? 'low' : result.level === 'error' ? 'high' : 'medium';
      const loc = result.locations?.[0]?.physicalLocation;
      const file = loc?.artifactLocation?.uri ?? 'Unknown location';
      const line = loc?.region?.startLine ?? 1;
      const fingerprint = result.partialFingerprints?.primaryLocationLineHash ?? `${line}`;
      findings.push({key:`codeql:${digest(`${ruleId}:${file}:${fingerprint}`)}`,source:'codeql',title:(result.message?.text ?? ruleId ?? 'CodeQL finding').slice(0,500),severity,location:`${file}:${line}`.slice(0,500),url:`https://github.com/${repo}/security/code-scanning`,remediation:'Review the CodeQL alert and suggested remediation. Application code changes require review and validation.'});
    }
  }
  return [...new Map(findings.map(f => [f.key,f])).values()];
}
async function collect() {
  const report = { runId:process.env.GITHUB_RUN_ID, attempt:Number(process.env.GITHUB_RUN_ATTEMPT),sha:process.env.GITHUB_SHA,completed:[],findings:[],errors:[],fixUrl:process.env.FIX_URL || null };
  try { const audit = JSON.parse(await readFile('security-output/audit.json','utf8')); report.findings.push(...auditFindings(audit)); report.completed.push('dependencies'); }
  catch { report.errors.push('Dependency security audit failed or returned an incomplete report. Check the review run.'); }
  try {
    if (process.env.CODEQL_RESULT !== 'success') throw Error('CodeQL job failed');
    const files = (await readdir('security-output/sarif')).filter(f=>f.endsWith('.sarif'));
    if (!files.length) throw Error('No CodeQL output');
    for (const file of files) report.findings.push(...sarifFindings(JSON.parse(await readFile(`security-output/sarif/${file}`,'utf8'))));
    report.completed.push('codeql');
  } catch { report.errors.push('CodeQL code review failed or was incomplete. Existing code findings have been retained.'); }
  if (process.env.FIX_RESULT === 'failure' || process.env.FIX_RESULT === 'cancelled') report.errors.push('Automatic dependency remediation failed validation, PR publication, automatic merge, or follow-up scheduling. Manual review is required.');
  report.repairs = [];
  if (process.env.REPAIR_REQUESTED === 'true') {
    try {
      report.repairs = JSON.parse(await readFile('security-output/repair/repair-results.json','utf8'));
      for (const repair of report.repairs) if (repair.status === 'pr_created') {
        repair.status = process.env.REPAIR_VALIDATION_RESULT === 'success' ? 'validated_pr' : 'validation_failed';
        repair.message = repair.status === 'validated_pr' ? 'Candidate tests and build passed. Review the PR before merging; resolution requires a new main scan.' : 'Candidate validation did not pass completely. Check GitHub jobs and review the PR; no code fix was merged.';
      }
    } catch { report.errors.push('Cyber agent did not return repair results. Check GitHub permissions, feature availability, and the repair job.'); }
    if (process.env.REPAIR_VALIDATION_RESULT === 'failure') report.errors.push('Cyber agent candidate validation failed. Manual review is required.');
  }
  await writeFile('security-output/report.json',JSON.stringify(report));
  console.log(`Review collected: ${report.findings.length} findings; ${report.errors.length} operational issues.`);
}
async function deliver() {
  const body = await readFile('security-output/report.json','utf8');
  const endpoint = 'https://morrisai.family/api/security/reports';
  for (let attempt=0;attempt<12;attempt++) {
    try {
      const oidc = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL); oidc.searchParams.set('audience',endpoint);
      const tokenResponse = await fetch(oidc,{headers:{Authorization:`Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`},signal:AbortSignal.timeout(15000)});
      if (!tokenResponse.ok) throw Error('OIDC token unavailable');
      const {value:token} = await tokenResponse.json();
      const response = await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(65000),redirect:'error'});
      if (response.ok) { console.log('Security tracker accepted report and processed notification queue.'); return; }
      console.warn(`Tracker delivery attempt ${attempt+1}: HTTP ${response.status}`);
    } catch { console.warn(`Tracker delivery attempt ${attempt+1} failed.`); }
    if (attempt<11) await new Promise(resolve=>setTimeout(resolve,30000));
  }
  throw Error('Security report delivery failed. Check the saved artifact and the platform watchdog.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === 'collect') await collect();
  else if (process.argv[2] === 'deliver') await deliver();
  else throw Error('Expected collect or deliver');
}
