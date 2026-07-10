export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPreferences, ME_DOMAINS } from "@/lib/prefs";
import type { MeDomainKey } from "@/lib/prefs";
import { IOSScreen, LargeTitle, TabBar } from "@/components/ios";
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

  return (
    <IOSScreen>
      <LargeTitle
        brand
        title="Me"
        subtitle="Career, Health, Mind & Spirit — one step at a time"
        avatarInitial={(user.user_metadata?.full_name || user.email || "?")[0]?.toUpperCase()}
      />

      <div style={{ padding: "0 16px" }}>
        <MeDashboardClient
          domains={orderedDomains}
          order={order}
          disabled={disabled}
        />
      </div>

      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
