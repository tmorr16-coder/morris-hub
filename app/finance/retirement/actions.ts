"use server";

import { requireFinanceAccess } from "@/lib/finance/access";
import { createServiceClient } from "@/lib/supabase/server";
import type {
  RetirementProfile,
  RetirementAccount,
  RetirementIncome,
  RetirementExpense,
  RetirementDebt,
  RetirementScenario,
  PlaidAccountSuggestion,
  SavedAccountSuggestion,
  SharedAccountSuggestion,
} from "./types";

type Svc = ReturnType<typeof createServiceClient>;

function db(service: Svc) {
  return (service as any).schema("finance");
}

export async function loadPlan(): Promise<{
  profile: RetirementProfile | null;
  accounts: RetirementAccount[];
  incomes: RetirementIncome[];
  expenses: RetirementExpense[];
  debts: RetirementDebt[];
  scenario: RetirementScenario | null;
  plaidAccounts: PlaidAccountSuggestion[];
  savedAccounts: SavedAccountSuggestion[];
  sharedAccounts: SharedAccountSuggestion[];
}> {
  const { user } = await requireFinanceAccess();
  const service = createServiceClient();
  const schema = db(service);

  const { data: profile } = await schema
    .from("retirement_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const [
    plaidAccounts,
    savedAccounts,
    sharedAccounts,
  ] = await Promise.all([
    fetchPlaidAccounts(service, user.id),
    fetchSavedAccounts(service, user.id),
    fetchSharedAccounts(service, user.id),
  ]);

  if (!profile) {
    return {
      profile: null,
      accounts: [],
      incomes: [],
      expenses: [],
      debts: [],
      scenario: null,
      plaidAccounts,
      savedAccounts,
      sharedAccounts,
    };
  }

  const [
    { data: accounts },
    { data: incomes },
    { data: expenses },
    { data: debts },
    { data: scenario },
  ] = await Promise.all([
    schema.from("retirement_accounts").select("*").eq("profile_id", profile.id).order("sort_order"),
    schema.from("retirement_incomes").select("*").eq("profile_id", profile.id).order("sort_order"),
    schema.from("retirement_expenses").select("*").eq("profile_id", profile.id).order("sort_order"),
    schema.from("retirement_debts").select("*").eq("profile_id", profile.id).order("sort_order"),
    schema.from("retirement_scenarios").select("*").eq("profile_id", profile.id).maybeSingle(),
  ]);

  return {
    profile: profile as RetirementProfile,
    accounts: (accounts ?? []) as RetirementAccount[],
    incomes: (incomes ?? []) as RetirementIncome[],
    expenses: (expenses ?? []) as RetirementExpense[],
    debts: (debts ?? []) as RetirementDebt[],
    scenario: scenario as RetirementScenario | null,
    plaidAccounts,
    savedAccounts,
    sharedAccounts,
  };
}

async function fetchPlaidAccounts(service: Svc, userId: string): Promise<PlaidAccountSuggestion[]> {
  const schema = db(service);
  const { data: items } = await schema
    .from("plaid_items")
    .select("id")
    .eq("user_id", userId);

  const itemIds = (items ?? []).map((r: any) => r.id);
  if (itemIds.length === 0) return [];

  const { data: accounts } = await schema
    .from("accounts")
    .select("id, name, type, mask, current_balance")
    .in("item_id", itemIds)
    .in("type", ["investment", "depository"])
    .order("name");

  return (accounts ?? []).map((a: any) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    mask: a.mask,
    balance: a.current_balance,
  })) as PlaidAccountSuggestion[];
}

async function fetchSavedAccounts(service: Svc, userId: string): Promise<SavedAccountSuggestion[]> {
  const schema = db(service);
  const { data } = await schema
    .from("manual_accounts")
    .select("id, name, institution, account_type, balance")
    .eq("user_id", userId)
    .order("name");
  return ((data ?? []) as any[]).map((a) => ({
    id: a.id,
    name: a.name,
    institution: a.institution,
    account_type: a.account_type ?? "other_investment",
    balance: a.balance ?? 0,
  }));
}

async function fetchSharedAccounts(service: Svc, userId: string): Promise<SharedAccountSuggestion[]> {
  const schema = db(service);

  // Manual accounts shared with this user.
  // Include accepted=true AND accepted=null (pending) — exclude only explicit rejections (false).
  const { data: sharedManual } = await schema
    .from("manual_account_shares")
    .select("account:manual_accounts(id, name, institution, account_type, balance), owner_user_id, accepted")
    .eq("recipient_user_id", userId)
    .neq("accepted", false);  // show unless explicitly rejected

  // Plaid investment accounts shared with this user
  const { data: sharedPlaid } = await schema
    .from("account_shares")
    .select("account:accounts(id, name, account_type:type, balance:current_balance), owner_user_id")
    .eq("grantee_user_id", userId);

  const manualSuggestions = ((sharedManual ?? []) as any[])
    .filter((r) => r.account)
    .map((r) => ({
      id: r.account.id,
      name: r.account.name,
      institution: r.account.institution ?? null,
      account_type: r.account.account_type ?? "other_investment",
      balance: r.account.balance ?? 0,
      shared_by: "Shared with you",
    }));

  const plaidSuggestions = ((sharedPlaid ?? []) as any[])
    .filter((r) => r.account)
    .map((r) => ({
      id: r.account.id,
      name: r.account.name,
      institution: null,
      account_type: r.account.account_type ?? "brokerage",
      balance: r.account.balance ?? 0,
      shared_by: "Shared with you",
    }));

  return [...manualSuggestions, ...plaidSuggestions];
}

export async function savePlan(data: {
  profile: Partial<RetirementProfile>;
  accounts: RetirementAccount[];
  incomes: RetirementIncome[];
  expenses: RetirementExpense[];
  debts: RetirementDebt[];
  scenario: Partial<RetirementScenario>;
}): Promise<{ ok: true } | { error: string }> {
  const { user } = await requireFinanceAccess();
  const service = createServiceClient();
  const schema = db(service);

  // Strip client-side placeholder timestamps before upserting — the DB sets
  // created_at on insert and we set updated_at explicitly here.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _pid, user_id: _uid, created_at: _pca, updated_at: _pua, ...profileRest } = data.profile as RetirementProfile;
  const profilePayload = {
    ...profileRest,
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };
  const { data: profileRow, error: profileErr } = await schema
    .from("retirement_profiles")
    .upsert(profilePayload, { onConflict: "user_id" })
    .select("id")
    .single();

  if (profileErr) return { error: profileErr.message };
  const profileId = profileRow.id as string;

  // Delete and re-insert child tables atomically
  const [delAcct, delIncome, delExpense, delDebt] = await Promise.all([
    schema.from("retirement_accounts").delete().eq("profile_id", profileId),
    schema.from("retirement_incomes").delete().eq("profile_id", profileId),
    schema.from("retirement_expenses").delete().eq("profile_id", profileId),
    schema.from("retirement_debts").delete().eq("profile_id", profileId),
  ]);

  for (const r of [delAcct, delIncome, delExpense, delDebt]) {
    if (r.error) return { error: r.error.message };
  }

  const inserts: Promise<{ error: any }>[] = [];

  if (data.accounts.length > 0) {
    inserts.push(
      schema.from("retirement_accounts").insert(
        data.accounts.map((a, i) => ({ ...stripId(a), profile_id: profileId, sort_order: i }))
      )
    );
  }
  if (data.incomes.length > 0) {
    inserts.push(
      schema.from("retirement_incomes").insert(
        data.incomes.map((a, i) => ({ ...stripId(a), profile_id: profileId, sort_order: i }))
      )
    );
  }
  if (data.expenses.length > 0) {
    inserts.push(
      schema.from("retirement_expenses").insert(
        data.expenses.map((a, i) => ({ ...stripId(a), profile_id: profileId, sort_order: i }))
      )
    );
  }
  if (data.debts.length > 0) {
    inserts.push(
      schema.from("retirement_debts").insert(
        data.debts.map((a, i) => ({ ...stripId(a), profile_id: profileId, sort_order: i }))
      )
    );
  }

  const insertResults = await Promise.all(inserts);
  for (const r of insertResults) {
    if (r.error) return { error: r.error.message };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _sid, profile_id: _spid, created_at: _sca, updated_at: _sua, ...scenarioRest } = data.scenario as RetirementScenario;
  const scenarioPayload = {
    ...scenarioRest,
    profile_id: profileId,
    updated_at: new Date().toISOString(),
  };
  const { error: scenarioErr } = await schema
    .from("retirement_scenarios")
    .upsert(scenarioPayload, { onConflict: "profile_id" });

  if (scenarioErr) return { error: scenarioErr.message };

  return { ok: true };
}

function stripId(obj: Record<string, any>): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, profile_id, created_at, updated_at, ...rest } = obj;
  return rest;
}

async function verifyOwnership(profileId: string, userId: string): Promise<boolean> {
  const service = createServiceClient();
  const { data } = await (db(service))
    .from("retirement_profiles")
    .select("id")
    .eq("id", profileId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function deleteAccount(id: string): Promise<{ ok: true } | { error: string }> {
  const { user } = await requireFinanceAccess();
  const service = createServiceClient();
  const schema = db(service);

  const { data: acct } = await schema.from("retirement_accounts").select("profile_id").eq("id", id).maybeSingle();
  if (!acct) return { error: "Not found" };
  if (!(await verifyOwnership(acct.profile_id, user.id))) return { error: "Forbidden" };

  const { error } = await schema.from("retirement_accounts").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function deleteIncome(id: string): Promise<{ ok: true } | { error: string }> {
  const { user } = await requireFinanceAccess();
  const service = createServiceClient();
  const schema = db(service);

  const { data: row } = await schema.from("retirement_incomes").select("profile_id").eq("id", id).maybeSingle();
  if (!row) return { error: "Not found" };
  if (!(await verifyOwnership(row.profile_id, user.id))) return { error: "Forbidden" };

  const { error } = await schema.from("retirement_incomes").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<{ ok: true } | { error: string }> {
  const { user } = await requireFinanceAccess();
  const service = createServiceClient();
  const schema = db(service);

  const { data: row } = await schema.from("retirement_expenses").select("profile_id").eq("id", id).maybeSingle();
  if (!row) return { error: "Not found" };
  if (!(await verifyOwnership(row.profile_id, user.id))) return { error: "Forbidden" };

  const { error } = await schema.from("retirement_expenses").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function deleteDebt(id: string): Promise<{ ok: true } | { error: string }> {
  const { user } = await requireFinanceAccess();
  const service = createServiceClient();
  const schema = db(service);

  const { data: row } = await schema.from("retirement_debts").select("profile_id").eq("id", id).maybeSingle();
  if (!row) return { error: "Not found" };
  if (!(await verifyOwnership(row.profile_id, user.id))) return { error: "Forbidden" };

  const { error } = await schema.from("retirement_debts").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}
