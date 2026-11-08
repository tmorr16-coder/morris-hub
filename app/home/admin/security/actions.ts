"use server";
import { requireAdmin } from "@/lib/supabase/auth-utils";
import { securityDb } from "@/lib/security/server";
import { parseSchedule, nextReview } from "@/lib/security/schedule";
import { revalidatePath } from "next/cache";
export type SecurityActionState = { message?: string; error?: string };
export async function requestSecurityScan(): Promise<SecurityActionState> {
  try {
    const { id } = await requireAdmin();
    const { error } = await securityDb().rpc("queue_security_scan", { requested_by: id });
    if (error) throw Error("Could not queue the review. Try again.");
    revalidatePath("/home/admin/security");
    return { message: "Scan queued. GitHub checks for requests every five minutes; starting may take longer during GitHub delays." };
  } catch (e) { return { error: e instanceof Error ? e.message : "Could not request scan" }; }
}
export async function saveSecuritySchedule(_previous: SecurityActionState, form: FormData): Promise<SecurityActionState> {
  try {
    await requireAdmin();
    const settings = parseSchedule({ enabled: form.get("enabled") === "on", frequency: form.get("frequency"), time: form.get("time"), weekday: Number(form.get("weekday")) });
    const version = Number(form.get("version"));
    if (!Number.isInteger(version) || version < 1) throw Error("Refresh the page before saving.");
    const { error } = await securityDb().rpc("configure_security_schedule", { settings, expected_version: version, due: nextReview(settings) });
    if (error) throw Error("Could not save. The schedule may have changed; refresh and try again.");
    revalidatePath("/home/admin/security");
    return { message: settings.enabled ? "Schedule saved in Eastern time." : "Scheduled reviews paused. Scan now and push reviews remain available." };
  } catch (e) { return { error: e instanceof Error ? e.message : "Could not save schedule" }; }
}
export async function requestSecurityFix(_previous: SecurityActionState, form: FormData): Promise<SecurityActionState> {
  try {
    const { id } = await requireAdmin();
    const value = form.get("finding");
    if (value !== null && (typeof value !== "string" || value.length > 250)) throw Error("Invalid finding.");
    const { error } = await securityDb().rpc("queue_security_repair", { requested_by: id, finding_key: value || null });
    if (error) throw Error("Could not request a repair. Refresh and try again.");
    revalidatePath("/home/admin/security");
    return { message: "Cyber agent repair queued. It will review the latest scan, attempt supported fixes and validate code-fix PRs. GitHub checks the queue every five minutes." };
  } catch (e) { return { error: e instanceof Error ? e.message : "Could not request repair" }; }
}
export async function refreshSecurityPulls(_previous: SecurityActionState,form: FormData): Promise<SecurityActionState> {
 try {const {id}=await requireAdmin();const value=form.get("number");const number=value===null?null:Number(value);if(number!==null&&(!Number.isInteger(number)||number<1))throw Error("Invalid PR number.");const {error}=await securityDb().rpc("queue_security_pr_command",{actor:id,pull_number:number});if(error)throw Error("Could not refresh reviews. Try again.");revalidatePath("/home/admin/security");return{message:"Refresh requested. GitHub checks the queue every five minutes."};}
 catch(e){return{error:e instanceof Error?e.message:"Could not refresh reviews"};}
}
export async function mergeSecurityPull(_previous: SecurityActionState,form: FormData): Promise<SecurityActionState> {
 try {const {id}=await requireAdmin();const number=Number(form.get("number")),head=String(form.get("head")),base=String(form.get("base"));if(!Number.isInteger(number)||number<1||!/^[a-f0-9]{40}$/.test(head)||!/^[a-f0-9]{40}$/.test(base))throw Error("Refresh the PR review before merging.");const{error}=await securityDb().rpc("queue_security_pr_command",{actor:id,pull_number:number,head_sha:head,base_sha:base});if(error)throw Error("The PR details may have changed or expired. Refresh, review, and try again.");revalidatePath("/home/admin/security");revalidatePath(`/home/admin/security/pulls/${number}`);return{message:"Merge requested. The worker will re-run tests and the build, then merge this reviewed version if the PR and main are unchanged. Check back here for the result."};}
 catch(e){return{error:e instanceof Error?e.message:"Could not request merge"};}
}

export async function protectSecurityNow():Promise<SecurityActionState>{
 try{const{id}=await requireAdmin();const{error}=await securityDb().rpc("configure_security_automation",{actor:id,enabled:true,run_now:true});if(error)throw Error("Could not start protection. Refresh and try again.");revalidatePath("/home/admin/security");return{message:"Protection queued. The agent will scan, prioritize, repair and validate supported fixes. Only changes needing your judgment will ask for review. GitHub checks requests every five minutes."};}catch(e){return{error:e instanceof Error?e.message:"Could not start protection"};}
}
export async function pauseSecurityAutomation():Promise<SecurityActionState>{
 try{const{id}=await requireAdmin();const{error}=await securityDb().rpc("configure_security_automation",{actor:id,enabled:false,run_now:false});if(error)throw Error("Could not pause automation. Try again.");revalidatePath("/home/admin/security");return{message:"Automatic repairs and queued automatic merges paused. Scanning continues. A merge already submitted to GitHub may finish."};}catch(e){return{error:e instanceof Error?e.message:"Could not pause automation"};}
}
