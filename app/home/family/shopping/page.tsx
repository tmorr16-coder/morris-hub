export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { IOSScreen, LargeTitle, TabBar } from "@/components/ios";
import { circleContext } from "@/lib/family/circle";
import ShoppingList from "../_components/ShoppingList";

export default async function FamilyShoppingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { circleIds, nameMap } = await circleContext(service, user.id);
  const { data: items } = await service.schema("hub").from("shopping_items")
    .select("id, item, quantity, checked, added_by, created_at")
    .in("circle_owner_id", circleIds)
    .order("created_at", { ascending: true });

  return (
    <IOSScreen>
      <LargeTitle title="Shopping list" subtitle="Shared with your family circle" />
      <div style={{ padding: "0 16px" }}>
        <ShoppingList initialItems={items ?? []} userId={user.id} nameMap={nameMap} />
      </div>
      <div style={{ height: 12 }} />
      <TabBar current="family" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
