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
