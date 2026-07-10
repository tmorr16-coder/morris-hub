import { createClient } from "@supabase/supabase-js";

// Service-role client for health section server actions.
// Bypasses RLS — use only in server-side code.
export function createAdminClient() {
  return createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-service-key"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
