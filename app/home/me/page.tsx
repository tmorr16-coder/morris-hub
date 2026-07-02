export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPreferences, ME_DOMAINS } from "@/lib/prefs";
import type { MeDomainKey } from "@/lib/prefs";
import PlatformMenu from "@/components/PlatformMenu";
import { getMeDomainData } from "./_lib/domains";
import MeDashboardClient from "./_components/MeDashboardClient";

export default async function MePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const prefs = await getPreferences(user.id);
  const domainData = await getMeDomainData(user.id, new Date(), prefs.app_access ?? []);

  const savedOrder = (prefs.me_domain_order?.length ? prefs.me_domain_order : [...ME_DOMAINS]) as MeDomainKey[];
  // A saved order can predate a domain added after the user last customized —
  // append anything present in the actual data but missing from the saved
  // order, instead of silently dropping it.
  const order = [
    ...savedOrder,
    ...domainData.map((d) => d.key).filter((k) => !savedOrder.includes(k)),
  ];
  const disabled = prefs.me_domains_disabled ?? [];

  const orderedDomains = order
    .map((key) => domainData.find((d) => d.key === key))
    .filter((d): d is NonNullable<typeof d> => !!d);

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    appAccess: prefs.app_access ?? null,
  };

  return (
    <div>
      <PlatformMenu currentApp="health" user={menuUser} />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 100px" }}>
        <h1 className="serif" style={{ fontSize: 36, marginBottom: 8, margin: "0 0 8px" }}>Me</h1>
        <p style={{ fontSize: 14, color: "var(--color-ink-3)", marginBottom: 28, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
          Career, Health, Mind, and Spirit — one next step at a time.
        </p>

        <MeDashboardClient
          domains={orderedDomains}
          order={order}
          disabled={disabled}
        />
      </main>
    </div>
  );
}
