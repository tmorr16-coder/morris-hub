"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { requireFinanceAccess } from "@/lib/finance/access";
import { createServiceClient } from "@/lib/supabase/server";

const client = new Anthropic();

interface Holding {
  name: string;
  value: number;
  pct: number | null;
  shares: number | null;
  price: number | null;
}

interface ExtractedStatement {
  account_name: string;
  institution: string | null;
  account_type: string;
  balance: number | null;
  as_of_date: string | null;
  currency: string;
  holdings: Holding[];
  ytd_contributions: number | null;
  ytd_gain: number | null;
  notes: string | null;
}

const EXTRACTION_PROMPT = `You are a financial data extractor. Analyze this account statement and extract key information.

First identify the statement TYPE, then extract accordingly:

── A) BROKERAGE / PORTFOLIO POSITIONS (e.g. E*TRADE, Morgan Stanley, Schwab, Fidelity, Vanguard brokerage, Robinhood) ──
These list positions in a table with columns like: SYMBOL, DESCRIPTION (security name), QUANTITY/SHARES, LAST PRICE / PRICE, MARKET VALUE, and often COST BASIS, TOTAL GAIN/LOSS, and % OF ACCOUNT/PORTFOLIO. They usually also show a CASH / SWEEP / MONEY MARKET balance and a TOTAL ACCOUNT VALUE.
For each position row:
- name = "SYMBOL — Description" if a ticker symbol exists (e.g. "AAPL — Apple Inc."), otherwise just the description.
- shares = QUANTITY, price = LAST PRICE, value = MARKET VALUE.
Include CASH / SWEEP / money-market as a holding named "Cash & sweep" (shares/price null, value = the cash balance).
balance = TOTAL ACCOUNT VALUE (or sum of all market values + cash). account_type = "brokerage" (use "roth_ira" / "traditional_ira" if the statement says it's an IRA). institution = the brokerage (e.g. E*TRADE).

── B) 401(k) / PLAN TRANSACTION ACTIVITY LOG (columns: VALUATION DATE, POSTING DATE, ACTIVITY TYPE, PLAN, ACCOUNT, FUND, AMOUNT, FUND NAV/PRICE, FUND UNITS) ──
1. Group all rows by FUND name
2. For each fund, sum all FUND UNITS to get current net units held
3. Use the most recent FUND NAV/PRICE for that fund to calculate current value = units × price
4. Use the most recent VALUATION DATE as the as-of date
5. Sum all fund values for total balance
6. Also look for YTD contributions by summing AMOUNT where ACTIVITY TYPE contains "contribution" or "employee" or "employer"
7. Use the PLAN name as account_name and infer account_type (401k, roth_ira, hsa, etc.)

── C) HOLDINGS SUMMARY (current balance per fund/position, no transactions) ── extract directly.

Return ONLY a JSON object with this exact structure (null for missing fields):
{
  "account_name": "string — plan/account name",
  "institution": "string or null — provider/institution (e.g. Alight, Fidelity, Vanguard)",
  "account_type": "one of: 401k, roth_ira, traditional_ira, hsa, brokerage, pension, other_investment",
  "balance": number or null — total current value in dollars,
  "as_of_date": "YYYY-MM-DD or null — most recent valuation date",
  "currency": "USD",
  "holdings": [
    {
      "name": "string — fund name",
      "value": number — current dollar value (units × nav),
      "pct": number or null — allocation as % of total (0-100),
      "shares": number or null — net units/shares held,
      "price": number or null — most recent NAV/price per unit
    }
  ],
  "ytd_contributions": number or null — total employee + employer contributions this year,
  "ytd_gain": number or null,
  "notes": "string or null"
}

Include ALL funds with positive balances. Calculate pct as (fund_value / total_balance) × 100.`;

export async function importStatement(formData: FormData): Promise<{ error?: string; id?: string }> {
  const { user } = await requireFinanceAccess();
  const file = formData.get("file") as File | null;

  if (!file) return { error: "No file provided" };
  if (file.size > 10 * 1024 * 1024) return { error: "File too large (max 10 MB)" };

  const ext = file.name.toLowerCase().split(".").pop();
  if (!["pdf", "csv", "txt"].includes(ext ?? "")) {
    return { error: "Unsupported format — upload a PDF, CSV, or TXT file" };
  }

  let extracted: ExtractedStatement | null = null;

  try {
    if (ext === "pdf") {
      // Pass PDF to Claude as base64 document
      const bytes = await file.arrayBuffer();
      const b64 = Buffer.from(bytes).toString("base64");

      const msg = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: b64 },
            },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        }],
      });

      const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
      const match = text.match(/\{[\s\S]*\}/);
      if (match) extracted = JSON.parse(match[0]);

    } else {
      // CSV / TXT — pass as text
      const text = await file.text();

      const msg = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: `Here is the account statement content:\n\n${text.slice(0, 12000)}\n\n${EXTRACTION_PROMPT}`,
        }],
      });

      const respText = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
      const match = respText.match(/\{[\s\S]*\}/);
      if (match) extracted = JSON.parse(match[0]);
    }
  } catch (e) {
    console.error("[import-statement] Claude error", e);
    return { error: "Failed to parse statement — try a different file format" };
  }

  if (!extracted) return { error: "Could not extract data from statement" };

  // Store extracted data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data: row, error } = await service
    .schema("finance")
    .from("manual_accounts")
    .insert({
      user_id: user.id,
      name: extracted.account_name || file.name.replace(/\.[^.]+$/, ""),
      institution: extracted.institution,
      account_type: extracted.account_type || "other_investment",
      balance: extracted.balance,
      as_of_date: extracted.as_of_date,
      currency: extracted.currency || "USD",
      holdings: extracted.holdings?.length ? extracted.holdings : null,
      notes: [
        extracted.ytd_contributions != null ? `YTD contributions: $${extracted.ytd_contributions.toLocaleString()}` : null,
        extracted.ytd_gain != null ? `YTD gain/loss: $${extracted.ytd_gain.toLocaleString()}` : null,
        extracted.notes,
      ].filter(Boolean).join(" · ") || null,
      source: "import",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: row.id };
}

export async function saveManualBalance(data: {
  name: string;
  institution: string | null;
  accountType: string;
  balance: number;
  asOfDate: string;
  history: { date: string; balance: number; rate: number | null }[] | null;
}): Promise<{ error?: string; id?: string }> {
  const { user } = await requireFinanceAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Store monthly history as holdings array for display purposes
  const holdings = data.history?.map((h) => ({
    name: h.date,
    value: h.balance,
    pct: h.rate,
    shares: null,
    price: null,
  })) ?? null;

  const { data: row, error } = await service
    .schema("finance")
    .from("manual_accounts")
    .insert({
      user_id: user.id,
      name: data.name,
      institution: data.institution,
      account_type: data.accountType,
      balance: data.balance,
      as_of_date: data.asOfDate,
      currency: "USD",
      holdings,
      source: "manual",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: row.id };
}

export async function toggleManualAccountSharing(
  id: string,
  visible: boolean
): Promise<{ error?: string }> {
  const { user } = await requireFinanceAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("finance")
    .from("manual_accounts")
    .update({ visible_to_family: visible })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/finance/dashboard");
  return {};
}

export async function deleteManualAccount(id: string): Promise<{ error?: string }> {
  const { user } = await requireFinanceAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("finance")
    .from("manual_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  return {};
}

// Edit an imported/manual account's value (and optionally its name) at any time.
// Ownership-scoped: only the account's owner can update it.
export async function updateManualAccount(data: {
  id: string;
  balance: number;
  name?: string;
}): Promise<{ error?: string }> {
  const { user } = await requireFinanceAccess();
  if (!Number.isFinite(data.balance)) return { error: "Enter a valid amount" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {
    balance: data.balance,
    as_of_date: new Date().toISOString().slice(0, 10),
  };
  if (typeof data.name === "string" && data.name.trim()) updates.name = data.name.trim();
  const { error } = await service
    .schema("finance")
    .from("manual_accounts")
    .update(updates)
    .eq("id", data.id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/finance/dashboard");
  return {};
}
