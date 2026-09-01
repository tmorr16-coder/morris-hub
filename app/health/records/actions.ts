"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { findBiomarker } from "@/lib/health/biomarkers";
import { revalidatePath } from "next/cache";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const BUCKET = "health-records";

export interface ResultInput {
  name: string;
  panel?: string | null;
  value?: number | null;
  value_text?: string | null;
  unit?: string | null;
  ref_low?: number | null;
  ref_high?: number | null;
  ref_text?: string | null;
  flag?: string | null;
  note?: string | null;
  biomarker_key?: string | null;
}

export interface BodyCompositionInput {
  device?: string | null;
  weight_lbs?: number | null;
  bmi?: number | null;
  body_fat_pct?: number | null;
  body_fat_mass_lbs?: number | null;
  lean_body_mass_lbs?: number | null;
  skeletal_muscle_lbs?: number | null;
  dry_lean_mass_lbs?: number | null;
  total_body_water_lbs?: number | null;
  intracellular_water_lbs?: number | null;
  extracellular_water_lbs?: number | null;
  ecw_tbw?: number | null;
  visceral_fat_area?: number | null;
  bmr_kcal?: number | null;
  smi?: number | null;
  tbw_lbm_pct?: number | null;
  leg_lean_mass_lbs?: number | null;
  phase_angle?: number | null;
  segmental_lean?: Record<string, number> | null;
  segmental_fat?: Record<string, number> | null;
  fat_mass_control_lbs?: number | null;
  lean_mass_control_lbs?: number | null;
  notes?: string | null;
}

export interface VitalsInput {
  systolic?: number | null;
  diastolic?: number | null;
  pulse_bpm?: number | null;
  temperature_f?: number | null;
  spo2_pct?: number | null;
  respiratory_rate?: number | null;
  weight_lbs?: number | null;
  height_in?: number | null;
  waist_in?: number | null;
  context?: string | null;
  notes?: string | null;
}

export interface SaveRecordInput {
  kind?: string;
  title: string;
  source?: string | null;
  performed_on: string;
  reported_on?: string | null;
  provider?: string | null;
  facility?: string | null;
  accession?: string | null;
  summary?: string | null;
  notes?: string | null;
  entry_method?: "ai_extract" | "manual";
  results?: ResultInput[];
  body_composition?: BodyCompositionInput | null;
  vitals?: VitalsInput | null;
}

function revalidateRecords() {
  revalidatePath("/health/records");
  revalidatePath("/health");
}

/** Empty strings from form inputs must reach Postgres as null, not "". */
function nullish<T>(v: T | "" | undefined | null): T | null {
  return v === "" || v === undefined ? null : (v as T | null);
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/**
 * Save a whole report: the document plus every result on it.
 *
 * Re-importing the same report is idempotent. Two things make it so:
 * results are de-duplicated within the batch (a multi-panel lab report
 * genuinely prints the same analyte twice — platelet count shows up under
 * both the FIB-4 header and the CBC), and any previously stored result for
 * the same biomarker and collection date is cleared before the insert.
 */
export async function saveExtractedRecord(
  input: SaveRecordInput
): Promise<{ id?: string; error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  if (!input.title?.trim()) return { error: "A title is required." };
  if (!input.performed_on) return { error: "A date is required." };

  const { data: doc, error: docError } = await db
    .from("health_record_documents")
    .insert({
      user_id: userId,
      kind: input.kind ?? "lab_panel",
      title: input.title.trim(),
      source: nullish(input.source),
      performed_on: input.performed_on,
      reported_on: nullish(input.reported_on),
      provider: nullish(input.provider),
      facility: nullish(input.facility),
      accession: nullish(input.accession),
      summary: nullish(input.summary),
      notes: nullish(input.notes),
      entry_method: input.entry_method ?? "manual",
    })
    .select("id")
    .single();

  if (docError) return { error: docError.message };
  const documentId: string = doc.id;

  // ── Results ────────────────────────────────────────────────────────────
  const incoming = (input.results ?? []).filter((r) => r.name?.trim());
  if (incoming.length > 0) {
    // Keep the first occurrence of each catalog biomarker. Unmapped results
    // (biomarker_key null) are all kept — we can't tell them apart safely.
    const seen = new Set<string>();
    const rows = incoming
      .map((r) => {
        const key = r.biomarker_key ?? findBiomarker(r.name)?.key ?? null;
        return { ...r, biomarker_key: key };
      })
      .filter((r) => {
        if (!r.biomarker_key) return true;
        if (seen.has(r.biomarker_key)) return false;
        seen.add(r.biomarker_key);
        return true;
      })
      .map((r) => ({
        user_id: userId,
        document_id: documentId,
        biomarker_key: r.biomarker_key,
        name: r.name.trim(),
        panel: nullish(r.panel),
        collected_on: input.performed_on,
        value: num(r.value),
        value_text: nullish(r.value_text),
        unit: nullish(r.unit),
        ref_low: num(r.ref_low),
        ref_high: num(r.ref_high),
        ref_text: nullish(r.ref_text),
        flag: nullish(r.flag),
        note: nullish(r.note),
      }));

    const keys = rows.map((r) => r.biomarker_key).filter(Boolean) as string[];
    if (keys.length > 0) {
      await db
        .from("health_lab_results")
        .delete()
        .eq("user_id", userId)
        .eq("collected_on", input.performed_on)
        .in("biomarker_key", keys);
    }

    const { error: resultsError } = await db.from("health_lab_results").insert(rows);
    if (resultsError) {
      // Don't strand a document with no results behind it.
      await db.from("health_record_documents").delete().eq("id", documentId).eq("user_id", userId);
      return { error: resultsError.message };
    }
  }

  // ── Body composition ───────────────────────────────────────────────────
  if (input.body_composition) {
    const bc = input.body_composition;
    const device = nullish(bc.device);

    // Clear any scan already stored for this date and device, whatever
    // document it came from. The unique index is (user_id, measured_on,
    // device), so without this a re-import of the same scan fails outright
    // rather than replacing the earlier read.
    const clash = db
      .from("health_body_composition")
      .delete()
      .eq("user_id", userId)
      .eq("measured_on", input.performed_on);
    await (device === null ? clash.is("device", null) : clash.eq("device", device));

    const { error: bcError } = await db.from("health_body_composition").insert({
      user_id: userId,
      document_id: documentId,
      measured_on: input.performed_on,
      device,
      weight_lbs: num(bc.weight_lbs),
      bmi: num(bc.bmi),
      body_fat_pct: num(bc.body_fat_pct),
      body_fat_mass_lbs: num(bc.body_fat_mass_lbs),
      lean_body_mass_lbs: num(bc.lean_body_mass_lbs),
      skeletal_muscle_lbs: num(bc.skeletal_muscle_lbs),
      dry_lean_mass_lbs: num(bc.dry_lean_mass_lbs),
      total_body_water_lbs: num(bc.total_body_water_lbs),
      intracellular_water_lbs: num(bc.intracellular_water_lbs),
      extracellular_water_lbs: num(bc.extracellular_water_lbs),
      ecw_tbw: num(bc.ecw_tbw),
      visceral_fat_area: num(bc.visceral_fat_area),
      bmr_kcal: num(bc.bmr_kcal),
      smi: num(bc.smi),
      tbw_lbm_pct: num(bc.tbw_lbm_pct),
      leg_lean_mass_lbs: num(bc.leg_lean_mass_lbs),
      phase_angle: num(bc.phase_angle),
      segmental_lean: bc.segmental_lean ?? null,
      segmental_fat: bc.segmental_fat ?? null,
      fat_mass_control_lbs: num(bc.fat_mass_control_lbs),
      lean_mass_control_lbs: num(bc.lean_mass_control_lbs),
      notes: nullish(bc.notes),
    });
    if (bcError) return { error: bcError.message };
  }

  // ── Vitals ─────────────────────────────────────────────────────────────
  if (input.vitals) {
    const v = input.vitals;
    const { error: vError } = await db.from("health_vitals").insert({
      user_id: userId,
      document_id: documentId,
      measured_on: input.performed_on,
      systolic: num(v.systolic),
      diastolic: num(v.diastolic),
      pulse_bpm: num(v.pulse_bpm),
      temperature_f: num(v.temperature_f),
      spo2_pct: num(v.spo2_pct),
      respiratory_rate: num(v.respiratory_rate),
      weight_lbs: num(v.weight_lbs),
      height_in: num(v.height_in),
      waist_in: num(v.waist_in),
      context: nullish(v.context),
      notes: nullish(v.notes),
    });
    if (vError) return { error: vError.message };
  }

  revalidateRecords();
  return { id: documentId };
}

/**
 * Attach the original file to a saved document.
 *
 * Kept separate from saveExtractedRecord so a storage hiccup never costs
 * the user the parsed results — the record is already safe by this point,
 * and a failure here only means the source scan isn't viewable.
 */
export async function uploadRecordFile(
  documentId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided." };
  if (file.size > 20 * 1024 * 1024) return { error: "File too large (max 20 MB)." };

  const { data: owned } = await db
    .from("health_record_documents")
    .select("id")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!owned) return { error: "Record not found." };

  // Bucket policies key ownership off the first path segment.
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
  const path = `${userId}/${documentId}/${safeName}`;

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) return { error: uploadError.message };

  const { error: updateError } = await db
    .from("health_record_documents")
    .update({ file_name: file.name, file_path: path, file_mime: file.type })
    .eq("id", documentId)
    .eq("user_id", userId);
  if (updateError) return { error: updateError.message };

  revalidateRecords();
  return {};
}

/** Time-limited link to the stored original. Null when there's no file. */
export async function getRecordFileUrl(
  documentId: string
): Promise<{ url?: string; error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  const { data: doc } = await db
    .from("health_record_documents")
    .select("file_path")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!doc?.file_path) return { error: "No file attached to this record." };

  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(doc.file_path, 300);
  if (error) return { error: error.message };
  return { url: data.signedUrl };
}

export async function deleteRecordDocument(id: string): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  const { data: doc } = await db
    .from("health_record_documents")
    .select("file_path")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  // Results, body-comp and vitals rows cascade from the document.
  const { error } = await db
    .from("health_record_documents")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  if (doc?.file_path) {
    await db.storage.from(BUCKET).remove([doc.file_path]);
  }

  revalidateRecords();
  return {};
}

/** Add a single result by hand — a home A1c, a value read off a portal. */
export async function addManualResult(input: {
  name: string;
  collected_on: string;
  value?: number | null;
  value_text?: string | null;
  unit?: string | null;
  ref_low?: number | null;
  ref_high?: number | null;
  panel?: string | null;
  note?: string | null;
}): Promise<{ id?: string; error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  if (!input.name?.trim()) return { error: "A test name is required." };
  if (!input.collected_on) return { error: "A date is required." };

  const marker = findBiomarker(input.name);
  const key = marker?.key ?? null;

  // Same date + same marker replaces, so correcting a typo doesn't leave
  // two conflicting readings on one day.
  if (key) {
    await db
      .from("health_lab_results")
      .delete()
      .eq("user_id", userId)
      .eq("collected_on", input.collected_on)
      .eq("biomarker_key", key);
  }

  const { data, error } = await db
    .from("health_lab_results")
    .insert({
      user_id: userId,
      biomarker_key: key,
      name: input.name.trim(),
      panel: nullish(input.panel),
      collected_on: input.collected_on,
      value: num(input.value),
      value_text: nullish(input.value_text),
      unit: nullish(input.unit) ?? marker?.unit ?? null,
      ref_low: num(input.ref_low) ?? marker?.refLow ?? null,
      ref_high: num(input.ref_high) ?? marker?.refHigh ?? null,
      note: nullish(input.note),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidateRecords();
  return { id: data.id };
}

export async function updateLabResult(
  id: string,
  patch: { value?: number | null; unit?: string | null; note?: string | null }
): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  const { error } = await db
    .from("health_lab_results")
    .update({
      ...(patch.value !== undefined ? { value: num(patch.value) } : {}),
      ...(patch.unit !== undefined ? { unit: nullish(patch.unit) } : {}),
      ...(patch.note !== undefined ? { note: nullish(patch.note) } : {}),
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidateRecords();
  return {};
}

export async function deleteLabResult(id: string): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  const { error } = await db.from("health_lab_results").delete().eq("id", id).eq("user_id", userId);
  if (error) return { error: error.message };
  revalidateRecords();
  return {};
}

/** Log a blood pressure / vitals reading without a source document. */
export async function addVitals(input: VitalsInput & { measured_on: string }): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  if (!input.measured_on) return { error: "A date is required." };

  const { error } = await db.from("health_vitals").insert({
    user_id: userId,
    measured_on: input.measured_on,
    systolic: num(input.systolic),
    diastolic: num(input.diastolic),
    pulse_bpm: num(input.pulse_bpm),
    temperature_f: num(input.temperature_f),
    spo2_pct: num(input.spo2_pct),
    respiratory_rate: num(input.respiratory_rate),
    weight_lbs: num(input.weight_lbs),
    height_in: num(input.height_in),
    waist_in: num(input.waist_in),
    context: nullish(input.context),
    notes: nullish(input.notes),
  });

  if (error) return { error: error.message };
  revalidateRecords();
  return {};
}

export async function deleteVitals(id: string): Promise<{ error?: string }> {
  const db: AnyClient = createAdminClient();
  const userId = await getCurrentUserId();

  const { error } = await db.from("health_vitals").delete().eq("id", id).eq("user_id", userId);
  if (error) return { error: error.message };
  revalidateRecords();
  return {};
}
