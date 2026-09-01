/**
 * Biomarker catalog for the health records module.
 *
 * A lab report is a pile of strings: "ALKALINE PHOSPHATASE", "46",
 * "36-130 U/L". This file turns that into something the app can reason
 * about — a canonical key so the same analyte lines up across years and
 * across labs that spell it differently, a category so a report groups
 * into panels, a default reference range for when a report omits one,
 * and a direction so a trend knows which way is "better".
 *
 * Reference ranges are adult ranges as printed by Quest Diagnostics,
 * which is where these records come from. A result always prefers the
 * range printed on its own report; these are the fallback.
 *
 * `optimal*` is deliberately separate from `ref*`. The lab's reference
 * range answers "is this abnormal?"; the optimal range answers "is this
 * where I want to be?" — they differ for exactly the markers worth
 * tracking (ApoB, hs-CRP, A1c, vitamin D).
 */

export type BiomarkerCategory =
  | "metabolic"
  | "lipids"
  | "cardiovascular"
  | "liver"
  | "kidney"
  | "electrolytes"
  | "blood"
  | "thyroid"
  | "hormones"
  | "vitamins"
  | "inflammation"
  | "screening"
  | "other";

/** Which way is better. `range` = mid-range is best (most electrolytes). */
export type BiomarkerDirection = "lower" | "higher" | "range";

export interface Biomarker {
  key: string;
  name: string;
  category: BiomarkerCategory;
  unit?: string;
  refLow?: number;
  refHigh?: number;
  /** Printed form when the range isn't a simple interval, e.g. "> OR = 60". */
  refText?: string;
  optimalLow?: number;
  optimalHigh?: number;
  direction: BiomarkerDirection;
  /** Alternate spellings a lab might print. Matched case/punctuation-insensitively. */
  aliases?: string[];
  /** One plain-language line: what this marker actually tells you. */
  about?: string;
}

export const CATEGORY_LABELS: Record<BiomarkerCategory, string> = {
  metabolic: "Metabolic & glucose",
  lipids: "Lipids",
  cardiovascular: "Cardiovascular risk",
  liver: "Liver",
  kidney: "Kidney",
  electrolytes: "Electrolytes & minerals",
  blood: "Complete blood count",
  thyroid: "Thyroid",
  hormones: "Hormones",
  vitamins: "Vitamins & nutrients",
  inflammation: "Inflammation",
  screening: "Screening",
  other: "Other",
};

/** Display order for grouped views. */
export const CATEGORY_ORDER: BiomarkerCategory[] = [
  "cardiovascular",
  "lipids",
  "metabolic",
  "inflammation",
  "liver",
  "kidney",
  "blood",
  "thyroid",
  "hormones",
  "vitamins",
  "electrolytes",
  "screening",
  "other",
];

export const BIOMARKERS: Biomarker[] = [
  // ── Metabolic & glucose ───────────────────────────────────────────────
  {
    key: "glucose",
    name: "Glucose",
    category: "metabolic",
    unit: "mg/dL",
    refLow: 65,
    refHigh: 99,
    direction: "range",
    aliases: ["glucose fasting", "fasting glucose", "blood glucose", "glu"],
    about: "Blood sugar at the moment of the draw; the fasting range assumes no food for 8+ hours.",
  },
  {
    key: "hba1c",
    name: "Hemoglobin A1c",
    category: "metabolic",
    unit: "%",
    refHigh: 5.7,
    refText: "<5.7 %",
    optimalHigh: 5.4,
    direction: "lower",
    aliases: ["a1c", "hgb a1c", "hemoglobin a1c", "glycohemoglobin", "hba1c"],
    about: "Average blood sugar over ~3 months. 5.7–6.4% is prediabetes, 6.5%+ is diabetes.",
  },
  {
    key: "insulin",
    name: "Insulin",
    category: "metabolic",
    unit: "uIU/mL",
    refHigh: 18.4,
    refText: "< or = 18.4",
    optimalHigh: 10,
    direction: "lower",
    aliases: ["insulin fasting", "fasting insulin"],
    about: "Fasting insulin rises years before glucose does — an early read on insulin resistance.",
  },
  {
    key: "homa_ir",
    name: "HOMA-IR",
    category: "metabolic",
    refHigh: 2,
    direction: "lower",
    aliases: ["homa ir", "homa"],
    about: "Insulin-resistance score computed from fasting glucose and insulin.",
  },
  {
    key: "uric_acid",
    name: "Uric Acid",
    category: "metabolic",
    unit: "mg/dL",
    refLow: 4,
    refHigh: 8,
    direction: "range",
    aliases: ["urate"],
  },

  // ── Lipids ────────────────────────────────────────────────────────────
  {
    key: "cholesterol_total",
    name: "Total Cholesterol",
    category: "lipids",
    unit: "mg/dL",
    refHigh: 200,
    refText: "<200 mg/dL",
    direction: "lower",
    aliases: ["cholesterol total", "cholesterol, total", "total chol", "chol"],
  },
  {
    key: "hdl",
    name: "HDL Cholesterol",
    category: "lipids",
    unit: "mg/dL",
    refLow: 40,
    refText: "> or = 40 mg/dL",
    optimalLow: 60,
    direction: "higher",
    aliases: ["hdl", "hdl cholesterol", "hdl-c", "hdl chol"],
    about: "The lipoprotein that carries cholesterol away from arteries; higher is protective.",
  },
  {
    key: "ldl",
    name: "LDL Cholesterol",
    category: "lipids",
    unit: "mg/dL",
    refHigh: 100,
    refText: "<100 mg/dL",
    optimalHigh: 70,
    direction: "lower",
    aliases: ["ldl", "ldl cholesterol", "ldl-cholesterol", "ldl-c", "ldl calculated", "direct ldl"],
    about: "The main cholesterol-carrying particle that drives plaque. <100 for prevention, <70 with risk factors.",
  },
  {
    key: "triglycerides",
    name: "Triglycerides",
    category: "lipids",
    unit: "mg/dL",
    refHigh: 150,
    refText: "<150 mg/dL",
    optimalHigh: 100,
    direction: "lower",
    aliases: ["trig", "trigs", "triglyceride"],
  },
  {
    key: "non_hdl",
    name: "Non-HDL Cholesterol",
    category: "lipids",
    unit: "mg/dL",
    refHigh: 130,
    refText: "<130 mg/dL",
    optimalHigh: 100,
    direction: "lower",
    aliases: ["non hdl cholesterol", "non-hdl cholesterol", "non hdl", "non-hdl-c"],
    about: "Every atherogenic particle in one number — total cholesterol minus HDL.",
  },
  {
    key: "chol_hdl_ratio",
    name: "Chol/HDL Ratio",
    category: "lipids",
    refHigh: 5,
    refText: "<5.0",
    optimalHigh: 3.5,
    direction: "lower",
    aliases: ["chol/hdlc ratio", "cholesterol/hdl ratio", "chol hdl ratio", "total chol/hdl ratio"],
  },
  {
    key: "vldl",
    name: "VLDL Cholesterol",
    category: "lipids",
    unit: "mg/dL",
    refHigh: 40,
    direction: "lower",
    aliases: ["vldl", "vldl cholesterol", "vldl-c"],
  },

  // ── Cardiovascular risk ───────────────────────────────────────────────
  {
    key: "apob",
    name: "Apolipoprotein B",
    category: "cardiovascular",
    unit: "mg/dL",
    refHigh: 90,
    refText: "<90 mg/dL",
    optimalHigh: 80,
    direction: "lower",
    aliases: ["apo b", "apolipoprotein b", "apob100", "apo-b"],
    about: "A direct count of atherogenic particles — a better risk read than LDL-C alone. Optimal <90, high ≥130.",
  },
  {
    key: "apoa1",
    name: "Apolipoprotein A1",
    category: "cardiovascular",
    unit: "mg/dL",
    refLow: 94,
    direction: "higher",
    aliases: ["apo a1", "apolipoprotein a1", "apo-a1"],
  },
  {
    key: "lpa",
    name: "Lipoprotein (a)",
    category: "cardiovascular",
    unit: "nmol/L",
    refHigh: 75,
    refText: "<75 nmol/L",
    direction: "lower",
    aliases: ["lp(a)", "lipoprotein a", "lipoprotein(a)", "lp a"],
    about: "Genetically set and measured once in a lifetime. Optimal <75, moderate 75–125, high >125 nmol/L.",
  },
  {
    key: "homocysteine",
    name: "Homocysteine",
    category: "cardiovascular",
    unit: "umol/L",
    refHigh: 15,
    optimalHigh: 9,
    direction: "lower",
    aliases: ["homocysteine total"],
  },

  // ── Inflammation ──────────────────────────────────────────────────────
  {
    key: "hs_crp",
    name: "hs-CRP",
    category: "inflammation",
    unit: "mg/L",
    refHigh: 3,
    refText: "Optimal <1.0",
    optimalHigh: 1,
    direction: "lower",
    aliases: ["hs crp", "c-reactive protein high sensitivity", "crp high sensitivity", "hscrp", "cardio crp"],
    about: "Low-grade inflammation tied to cardiovascular risk. <1.0 lower risk, 1.0–3.0 average, >3.0 higher.",
  },
  {
    key: "crp",
    name: "C-Reactive Protein",
    category: "inflammation",
    unit: "mg/L",
    refHigh: 8,
    direction: "lower",
    aliases: ["c reactive protein", "c-reactive protein"],
  },
  {
    key: "esr",
    name: "Sed Rate (ESR)",
    category: "inflammation",
    unit: "mm/hr",
    refHigh: 20,
    direction: "lower",
    aliases: ["sedimentation rate", "esr", "sed rate"],
  },

  // ── Liver ─────────────────────────────────────────────────────────────
  {
    key: "ast",
    name: "AST",
    category: "liver",
    unit: "U/L",
    refLow: 10,
    refHigh: 40,
    direction: "range",
    aliases: ["ast sgot", "sgot", "aspartate aminotransferase"],
  },
  {
    key: "alt",
    name: "ALT",
    category: "liver",
    unit: "U/L",
    refLow: 9,
    refHigh: 46,
    direction: "range",
    aliases: ["alt sgpt", "sgpt", "alanine aminotransferase"],
  },
  {
    key: "alkaline_phosphatase",
    name: "Alkaline Phosphatase",
    category: "liver",
    unit: "U/L",
    refLow: 36,
    refHigh: 130,
    direction: "range",
    aliases: ["alk phos", "alkaline phos", "alp"],
  },
  {
    key: "bilirubin_total",
    name: "Bilirubin, Total",
    category: "liver",
    unit: "mg/dL",
    refLow: 0.2,
    refHigh: 1.2,
    direction: "range",
    aliases: ["total bilirubin", "bilirubin total", "bili total"],
  },
  {
    key: "ggt",
    name: "GGT",
    category: "liver",
    unit: "U/L",
    refLow: 3,
    refHigh: 70,
    direction: "range",
    aliases: ["gamma gt", "ggtp", "gamma glutamyl transferase"],
  },
  {
    key: "protein_total",
    name: "Protein, Total",
    category: "liver",
    unit: "g/dL",
    refLow: 6.1,
    refHigh: 8.1,
    direction: "range",
    aliases: ["total protein", "protein total"],
  },
  {
    key: "albumin",
    name: "Albumin",
    category: "liver",
    unit: "g/dL",
    refLow: 3.6,
    refHigh: 5.1,
    direction: "range",
  },
  {
    key: "globulin",
    name: "Globulin",
    category: "liver",
    unit: "g/dL",
    refLow: 1.9,
    refHigh: 3.7,
    direction: "range",
    aliases: ["globulin calculated", "globulin total"],
  },
  {
    key: "albumin_globulin_ratio",
    name: "Albumin/Globulin Ratio",
    category: "liver",
    refLow: 1,
    refHigh: 2.5,
    direction: "range",
    aliases: ["a/g ratio", "albumin globulin ratio", "ag ratio"],
  },
  {
    key: "fib4",
    name: "FIB-4 Index",
    category: "liver",
    refHigh: 1.3,
    refText: "Low <1.30",
    direction: "lower",
    aliases: ["fib 4 index", "fib-4", "fib4 index", "fibrosis 4 index"],
    about: "Liver fibrosis risk from age, AST, ALT and platelets. Under 1.30 argues against advanced fibrosis.",
  },

  // ── Kidney ────────────────────────────────────────────────────────────
  {
    key: "bun",
    name: "Urea Nitrogen (BUN)",
    category: "kidney",
    unit: "mg/dL",
    refLow: 7,
    refHigh: 25,
    direction: "range",
    aliases: ["bun", "urea nitrogen", "blood urea nitrogen"],
  },
  {
    key: "creatinine",
    name: "Creatinine",
    category: "kidney",
    unit: "mg/dL",
    refLow: 0.6,
    refHigh: 1.29,
    direction: "range",
    aliases: ["creatinine serum", "creat"],
  },
  {
    key: "egfr",
    name: "eGFR",
    category: "kidney",
    unit: "mL/min/1.73m2",
    refLow: 60,
    refText: "> or = 60",
    direction: "higher",
    aliases: ["egfr", "gfr", "estimated gfr", "egfr non afr american", "egfr creatinine"],
    about: "Estimated filtration rate — the headline number for kidney function.",
  },
  {
    key: "bun_creatinine_ratio",
    name: "BUN/Creatinine Ratio",
    category: "kidney",
    refLow: 6,
    refHigh: 22,
    direction: "range",
    aliases: ["bun creatinine ratio", "bun/creat ratio"],
  },
  {
    key: "cystatin_c",
    name: "Cystatin C",
    category: "kidney",
    unit: "mg/L",
    refLow: 0.5,
    refHigh: 1,
    direction: "range",
  },
  {
    key: "microalbumin",
    name: "Microalbumin, Urine",
    category: "kidney",
    unit: "mg/L",
    refHigh: 30,
    direction: "lower",
    aliases: ["microalbumin urine", "urine microalbumin", "albumin urine"],
  },

  // ── Electrolytes & minerals ───────────────────────────────────────────
  {
    key: "sodium",
    name: "Sodium",
    category: "electrolytes",
    unit: "mmol/L",
    refLow: 135,
    refHigh: 146,
    direction: "range",
    aliases: ["na", "sodium serum"],
  },
  {
    key: "potassium",
    name: "Potassium",
    category: "electrolytes",
    unit: "mmol/L",
    refLow: 3.5,
    refHigh: 5.3,
    direction: "range",
    aliases: ["k", "potassium serum"],
  },
  {
    key: "chloride",
    name: "Chloride",
    category: "electrolytes",
    unit: "mmol/L",
    refLow: 98,
    refHigh: 110,
    direction: "range",
    aliases: ["cl"],
  },
  {
    key: "co2",
    name: "Carbon Dioxide",
    category: "electrolytes",
    unit: "mmol/L",
    refLow: 20,
    refHigh: 32,
    direction: "range",
    aliases: ["carbon dioxide", "co2", "bicarbonate", "hco3", "carbon dioxide total"],
  },
  {
    key: "calcium",
    name: "Calcium",
    category: "electrolytes",
    unit: "mg/dL",
    refLow: 8.6,
    refHigh: 10.3,
    direction: "range",
    aliases: ["ca", "calcium serum", "calcium total"],
  },
  {
    key: "magnesium",
    name: "Magnesium",
    category: "electrolytes",
    unit: "mg/dL",
    refLow: 1.5,
    refHigh: 2.5,
    direction: "range",
    aliases: ["mg"],
  },
  {
    key: "phosphorus",
    name: "Phosphorus",
    category: "electrolytes",
    unit: "mg/dL",
    refLow: 2.5,
    refHigh: 4.5,
    direction: "range",
    aliases: ["phosphate"],
  },
  {
    key: "anion_gap",
    name: "Anion Gap",
    category: "electrolytes",
    unit: "mmol/L",
    refLow: 5,
    refHigh: 15,
    direction: "range",
  },

  // ── Complete blood count ──────────────────────────────────────────────
  {
    key: "wbc",
    name: "White Blood Cell Count",
    category: "blood",
    unit: "Thousand/uL",
    refLow: 3.8,
    refHigh: 10.8,
    direction: "range",
    aliases: ["wbc", "white blood cells", "leukocytes", "white count"],
  },
  {
    key: "rbc",
    name: "Red Blood Cell Count",
    category: "blood",
    unit: "Million/uL",
    refLow: 4.2,
    refHigh: 5.8,
    direction: "range",
    aliases: ["rbc", "red blood cells", "erythrocytes", "red count"],
  },
  {
    key: "hemoglobin",
    name: "Hemoglobin",
    category: "blood",
    unit: "g/dL",
    refLow: 13.2,
    refHigh: 17.1,
    direction: "range",
    aliases: ["hgb", "hb", "haemoglobin"],
  },
  {
    key: "hematocrit",
    name: "Hematocrit",
    category: "blood",
    unit: "%",
    refLow: 39.4,
    refHigh: 51.1,
    direction: "range",
    aliases: ["hct", "haematocrit"],
  },
  {
    key: "mcv",
    name: "MCV",
    category: "blood",
    unit: "fL",
    refLow: 81.4,
    refHigh: 101.7,
    direction: "range",
    aliases: ["mean corpuscular volume"],
  },
  {
    key: "mch",
    name: "MCH",
    category: "blood",
    unit: "pg",
    refLow: 27,
    refHigh: 33,
    direction: "range",
    aliases: ["mean corpuscular hemoglobin"],
  },
  {
    key: "mchc",
    name: "MCHC",
    category: "blood",
    unit: "g/dL",
    refLow: 31.6,
    refHigh: 35.4,
    direction: "range",
    aliases: ["mean corpuscular hemoglobin concentration"],
  },
  {
    key: "rdw",
    name: "RDW",
    category: "blood",
    unit: "%",
    refLow: 11,
    refHigh: 15,
    direction: "range",
    aliases: ["red cell distribution width"],
  },
  {
    key: "platelets",
    name: "Platelet Count",
    category: "blood",
    unit: "Thousand/uL",
    refLow: 140,
    refHigh: 400,
    direction: "range",
    aliases: ["platelet count", "platelets", "plt"],
  },
  {
    key: "mpv",
    name: "MPV",
    category: "blood",
    unit: "fL",
    refLow: 7.5,
    refHigh: 12.5,
    direction: "range",
    aliases: ["mean platelet volume"],
  },
  {
    key: "neutrophils_abs",
    name: "Absolute Neutrophils",
    category: "blood",
    unit: "cells/uL",
    refLow: 1500,
    refHigh: 7800,
    direction: "range",
    aliases: ["absolute neutrophils", "neutrophils absolute", "anc"],
  },
  {
    key: "lymphocytes_abs",
    name: "Absolute Lymphocytes",
    category: "blood",
    unit: "cells/uL",
    refLow: 850,
    refHigh: 3900,
    direction: "range",
    aliases: ["absolute lymphocytes", "lymphocytes absolute"],
  },
  {
    key: "monocytes_abs",
    name: "Absolute Monocytes",
    category: "blood",
    unit: "cells/uL",
    refLow: 200,
    refHigh: 950,
    direction: "range",
    aliases: ["absolute monocytes", "monocytes absolute"],
  },
  {
    key: "eosinophils_abs",
    name: "Absolute Eosinophils",
    category: "blood",
    unit: "cells/uL",
    refLow: 15,
    refHigh: 500,
    direction: "range",
    aliases: ["absolute eosinophils", "eosinophils absolute"],
  },
  {
    key: "basophils_abs",
    name: "Absolute Basophils",
    category: "blood",
    unit: "cells/uL",
    refLow: 0,
    refHigh: 200,
    direction: "range",
    aliases: ["absolute basophils", "basophils absolute"],
  },
  {
    key: "neutrophils_pct",
    name: "Neutrophils",
    category: "blood",
    unit: "%",
    direction: "range",
    aliases: ["neutrophils", "neutrophils percent", "neuts"],
  },
  {
    key: "lymphocytes_pct",
    name: "Lymphocytes",
    category: "blood",
    unit: "%",
    direction: "range",
    aliases: ["lymphocytes", "lymphocytes percent", "lymphs"],
  },
  {
    key: "monocytes_pct",
    name: "Monocytes",
    category: "blood",
    unit: "%",
    direction: "range",
    aliases: ["monocytes", "monocytes percent"],
  },
  {
    key: "eosinophils_pct",
    name: "Eosinophils",
    category: "blood",
    unit: "%",
    direction: "range",
    aliases: ["eosinophils", "eosinophils percent", "eos"],
  },
  {
    key: "basophils_pct",
    name: "Basophils",
    category: "blood",
    unit: "%",
    direction: "range",
    aliases: ["basophils", "basophils percent", "basos"],
  },
  {
    key: "ferritin",
    name: "Ferritin",
    category: "blood",
    unit: "ng/mL",
    refLow: 20,
    refHigh: 380,
    direction: "range",
  },
  {
    key: "iron",
    name: "Iron, Total",
    category: "blood",
    unit: "ug/dL",
    refLow: 50,
    refHigh: 180,
    direction: "range",
    aliases: ["iron total", "serum iron"],
  },
  {
    key: "tibc",
    name: "TIBC",
    category: "blood",
    unit: "ug/dL",
    refLow: 250,
    refHigh: 425,
    direction: "range",
    aliases: ["total iron binding capacity", "iron binding capacity"],
  },
  {
    key: "transferrin_saturation",
    name: "Transferrin Saturation",
    category: "blood",
    unit: "%",
    refLow: 15,
    refHigh: 60,
    direction: "range",
    aliases: ["iron saturation", "% saturation", "transferrin sat"],
  },

  // ── Thyroid ───────────────────────────────────────────────────────────
  {
    key: "tsh",
    name: "TSH",
    category: "thyroid",
    unit: "mIU/L",
    refLow: 0.4,
    refHigh: 4.5,
    direction: "range",
    aliases: ["tsh", "thyroid stimulating hormone", "tsh w/reflex to ft4", "tsh with reflex to ft4"],
    about: "The pituitary's signal to the thyroid — the first-line thyroid screen.",
  },
  {
    key: "free_t4",
    name: "Free T4",
    category: "thyroid",
    unit: "ng/dL",
    refLow: 0.8,
    refHigh: 1.8,
    direction: "range",
    aliases: ["ft4", "t4 free", "free thyroxine", "thyroxine free"],
  },
  {
    key: "free_t3",
    name: "Free T3",
    category: "thyroid",
    unit: "pg/mL",
    refLow: 2.3,
    refHigh: 4.2,
    direction: "range",
    aliases: ["ft3", "t3 free", "triiodothyronine free"],
  },
  {
    key: "tpo_antibodies",
    name: "TPO Antibodies",
    category: "thyroid",
    unit: "IU/mL",
    refHigh: 9,
    direction: "lower",
    aliases: ["thyroid peroxidase antibodies", "anti-tpo", "tpo ab"],
  },

  // ── Hormones ──────────────────────────────────────────────────────────
  {
    key: "testosterone_total",
    name: "Testosterone, Total",
    category: "hormones",
    unit: "ng/dL",
    refLow: 250,
    refHigh: 1100,
    direction: "range",
    aliases: ["testosterone total", "total testosterone", "testosterone"],
  },
  {
    key: "testosterone_free",
    name: "Testosterone, Free",
    category: "hormones",
    unit: "pg/mL",
    refLow: 46,
    refHigh: 224,
    direction: "range",
    aliases: ["free testosterone", "testosterone free"],
  },
  {
    key: "shbg",
    name: "SHBG",
    category: "hormones",
    unit: "nmol/L",
    refLow: 10,
    refHigh: 50,
    direction: "range",
    aliases: ["sex hormone binding globulin"],
  },
  {
    key: "estradiol",
    name: "Estradiol",
    category: "hormones",
    unit: "pg/mL",
    refHigh: 39,
    direction: "range",
    aliases: ["e2", "estradiol total"],
  },
  {
    key: "dhea_s",
    name: "DHEA-Sulfate",
    category: "hormones",
    unit: "ug/dL",
    refLow: 70,
    refHigh: 495,
    direction: "range",
    aliases: ["dhea sulfate", "dheas", "dhea-s"],
  },
  {
    key: "cortisol",
    name: "Cortisol",
    category: "hormones",
    unit: "ug/dL",
    refLow: 4,
    refHigh: 22,
    direction: "range",
    aliases: ["cortisol am", "cortisol total"],
  },
  {
    key: "igf_1",
    name: "IGF-1",
    category: "hormones",
    unit: "ng/mL",
    refLow: 50,
    refHigh: 250,
    direction: "range",
    aliases: ["igf 1", "insulin like growth factor 1", "somatomedin c"],
  },

  // ── Vitamins & nutrients ──────────────────────────────────────────────
  {
    key: "vitamin_d",
    name: "Vitamin D, 25-OH",
    category: "vitamins",
    unit: "ng/mL",
    refLow: 30,
    refHigh: 100,
    optimalLow: 40,
    optimalHigh: 80,
    direction: "higher",
    aliases: [
      "vitamin d 25 oh total ia",
      "vitamin d,25-oh,total,ia",
      "vitamin d 25 hydroxy",
      "25-oh vitamin d",
      "vitamin d total",
      "vit d",
    ],
    about: "Deficiency <20, insufficiency 20–29, optimal ≥30 ng/mL.",
  },
  {
    key: "vitamin_b12",
    name: "Vitamin B12",
    category: "vitamins",
    unit: "pg/mL",
    refLow: 200,
    refHigh: 1100,
    optimalLow: 400,
    direction: "higher",
    aliases: ["b12", "vitamin b 12", "cobalamin"],
  },
  {
    key: "folate",
    name: "Folate",
    category: "vitamins",
    unit: "ng/mL",
    refLow: 3,
    direction: "higher",
    aliases: ["folic acid", "folate serum"],
  },
  {
    key: "magnesium_rbc",
    name: "Magnesium, RBC",
    category: "vitamins",
    unit: "mg/dL",
    refLow: 4,
    refHigh: 6.4,
    direction: "range",
    aliases: ["rbc magnesium"],
  },
  {
    key: "omega_3_index",
    name: "Omega-3 Index",
    category: "vitamins",
    unit: "%",
    refLow: 8,
    direction: "higher",
    aliases: ["omega 3 index"],
  },

  // ── Screening ─────────────────────────────────────────────────────────
  {
    key: "psa_total",
    name: "PSA, Total",
    category: "screening",
    unit: "ng/mL",
    refHigh: 4,
    refText: "< or = 4.00 ng/mL",
    direction: "lower",
    aliases: ["psa total", "psa", "prostate specific antigen"],
    about: "Prostate screening marker. Trend over time matters more than any single value.",
  },
  {
    key: "psa_free",
    name: "PSA, Free",
    category: "screening",
    unit: "ng/mL",
    direction: "range",
    aliases: ["free psa", "psa free"],
  },
];

export const BIOMARKER_BY_KEY: Record<string, Biomarker> = Object.fromEntries(
  BIOMARKERS.map((b) => [b.key, b])
);

/**
 * Normalize a printed test name for matching: lowercase, strip the units
 * and footnote markers labs append, collapse punctuation to single spaces.
 * "CHOLESTEROL, TOTAL " and "Cholesterol-Total" both become "cholesterol total".
 */
export function normalizeTestName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(calc\)|\(calculated\)/g, " ")
    .replace(/[^a-z0-9+/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Built once: every canonical name and alias, normalized, pointing at its key.
const NAME_INDEX: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const b of BIOMARKERS) {
    m.set(normalizeTestName(b.name), b.key);
    m.set(normalizeTestName(b.key.replace(/_/g, " ")), b.key);
    for (const a of b.aliases ?? []) m.set(normalizeTestName(a), b.key);
  }
  return m;
})();

/**
 * Resolve a printed test name to a catalog entry. Exact normalized match
 * first, then a containment pass so "LDL-CHOLESTEROL (CALC)" still lands on
 * `ldl`. Returns null rather than guessing when nothing matches — an
 * unmapped result is still stored and displayed, just without a trend.
 */
export function findBiomarker(name: string | null | undefined): Biomarker | null {
  if (!name) return null;
  const n = normalizeTestName(name);
  if (!n) return null;

  const exact = NAME_INDEX.get(n);
  if (exact) return BIOMARKER_BY_KEY[exact];

  // Longest candidate wins, so "absolute neutrophils" beats "neutrophils".
  let best: { key: string; len: number } | null = null;
  for (const [candidate, key] of NAME_INDEX) {
    if (candidate.length < 3) continue;
    if (n === candidate || n.startsWith(candidate + " ") || n.endsWith(" " + candidate) || n.includes(" " + candidate + " ")) {
      if (!best || candidate.length > best.len) best = { key, len: candidate.length };
    }
  }
  return best ? BIOMARKER_BY_KEY[best.key] : null;
}

/**
 * Parse the reference range as the lab printed it into numeric bounds.
 * Handles "135-146", "<200", "> OR = 60", "< or = 18.4", "0.60-1.29 mg/dL".
 * Returns nulls for prose ranges — the caller falls back to the catalog.
 */
export function parseReferenceText(text: string | null | undefined): {
  low: number | null;
  high: number | null;
} {
  if (!text) return { low: null, high: null };
  const t = text.toLowerCase().replace(/\s+or\s+=/g, "=").replace(/\s+/g, " ").trim();

  // "135-146" / "0.60 - 1.29" — a plain interval.
  const interval = t.match(/(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)/);
  if (interval) {
    const low = parseFloat(interval[1]);
    const high = parseFloat(interval[2]);
    if (Number.isFinite(low) && Number.isFinite(high) && high >= low) return { low, high };
  }

  // ">=60", "> 60", ">60" — a floor.
  const atLeast = t.match(/>\s*=?\s*(-?\d+(?:\.\d+)?)/);
  if (atLeast) return { low: parseFloat(atLeast[1]), high: null };

  // "<200", "<= 18.4" — a ceiling.
  const atMost = t.match(/<\s*=?\s*(-?\d+(?:\.\d+)?)/);
  if (atMost) return { low: null, high: parseFloat(atMost[1]) };

  return { low: null, high: null };
}

export type ResultStatus = "high" | "low" | "borderline" | "normal" | "unknown";

export interface EvaluableResult {
  value: number | null | undefined;
  refLow?: number | null;
  refHigh?: number | null;
  refText?: string | null;
  biomarkerKey?: string | null;
  /** The H/L/A the lab itself printed — always wins over our own math. */
  labFlag?: string | null;
}

/**
 * Decide whether a result is in range.
 *
 * Order of trust: the lab's own flag, then the range printed on that
 * report, then the catalog's default range. `borderline` means inside the
 * lab's reference range but outside the tighter optimal range — the case
 * that matters most for markers like ApoB and hs-CRP, where "not flagged"
 * and "where you want to be" are very different statements.
 */
export function evaluateResult(r: EvaluableResult): ResultStatus {
  const flag = (r.labFlag ?? "").trim().toUpperCase();
  if (flag === "H" || flag === "HIGH" || flag === "HH") return "high";
  if (flag === "L" || flag === "LOW" || flag === "LL") return "low";

  const value = r.value;
  if (value == null || !Number.isFinite(value)) return "unknown";

  const marker = r.biomarkerKey ? BIOMARKER_BY_KEY[r.biomarkerKey] : undefined;
  const parsed = parseReferenceText(r.refText);

  const low = r.refLow ?? parsed.low ?? marker?.refLow ?? null;
  const high = r.refHigh ?? parsed.high ?? marker?.refHigh ?? null;

  if (low == null && high == null) return "unknown";
  if (high != null && value > high) return "high";
  if (low != null && value < low) return "low";

  // In range — but is it in the *optimal* range?
  if (marker?.optimalHigh != null && value > marker.optimalHigh) return "borderline";
  if (marker?.optimalLow != null && value < marker.optimalLow) return "borderline";

  return "normal";
}

/** iOS token per status, for badges and value text. */
export const STATUS_COLOR: Record<ResultStatus, string> = {
  high: "var(--ios-red)",
  low: "var(--ios-orange, #FF9500)",
  borderline: "var(--ios-yellow, #FFCC00)",
  normal: "var(--ios-green)",
  unknown: "var(--ios-label-2)",
};

export const STATUS_LABEL: Record<ResultStatus, string> = {
  high: "High",
  low: "Low",
  borderline: "Watch",
  normal: "In range",
  unknown: "—",
};

/** Human-readable range for display: "65–99 mg/dL", "<200 mg/dL". */
export function formatRange(
  refLow: number | null | undefined,
  refHigh: number | null | undefined,
  refText: string | null | undefined,
  unit?: string | null
): string | null {
  if (refLow != null && refHigh != null) return `${refLow}–${refHigh}${unit ? ` ${unit}` : ""}`;
  if (refHigh != null) return `<${refHigh}${unit ? ` ${unit}` : ""}`;
  if (refLow != null) return `≥${refLow}${unit ? ` ${unit}` : ""}`;
  if (refText) return refText;
  return null;
}

/**
 * Where a value sits inside its reference range, as 0–1, for the range bar.
 * Values outside the range clamp to the ends; an open-ended range is
 * anchored against a synthetic opposite bound so the bar still reads.
 */
export function rangePosition(
  value: number,
  refLow: number | null | undefined,
  refHigh: number | null | undefined
): number | null {
  if (refLow != null && refHigh != null && refHigh > refLow) {
    return Math.max(0, Math.min(1, (value - refLow) / (refHigh - refLow)));
  }
  if (refHigh != null && refHigh > 0) return Math.max(0, Math.min(1, value / (refHigh * 1.5)));
  if (refLow != null && refLow > 0) return Math.max(0, Math.min(1, value / (refLow * 2)));
  return null;
}

/**
 * Whether a change in this marker is an improvement. Used to color deltas
 * on the trend view — a rising HDL is green, a rising ApoB is not.
 */
export function isImprovement(biomarkerKey: string | null | undefined, delta: number): boolean | null {
  if (delta === 0) return null;
  const marker = biomarkerKey ? BIOMARKER_BY_KEY[biomarkerKey] : undefined;
  if (!marker) return null;
  if (marker.direction === "higher") return delta > 0;
  if (marker.direction === "lower") return delta < 0;
  return null; // mid-range markers: direction alone doesn't say
}

/** Markers surfaced first on the records dashboard — the ones worth watching. */
export const HEADLINE_MARKERS = [
  "apob",
  "ldl",
  "lpa",
  "hs_crp",
  "hba1c",
  "insulin",
  "triglycerides",
  "hdl",
  "vitamin_d",
  "egfr",
  "alt",
  "tsh",
] as const;
