export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { LargeTitle, TabBar } from "@/components/ios";
import { childForGuardian, listChildrenForParent } from "../../_lib/children";
import { inboundAddressFor } from "../../_lib/inbound-address";
import { receivingDomain } from "@/lib/inbound-email";
import LearningImportClient from "../../_components/LearningImportClient";

export default async function ImportSchoolDocumentPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const child = await childForGuardian(createServiceClient() as any, childId, user.id);
  if (!child) notFound();
  const name = child.display_name ?? "your child";
  // The child's email address for forwarded newsletters, when the email door
  // is set up. Siblings who share a first name get the id-tagged form.
  const domain = await receivingDomain();
  const inboundAddress = domain
    ? inboundAddressFor(childId, name, await listChildrenForParent(user.id, new Date()), domain)
    : null;

  return (
    <div data-ui="ios">
      <div className="ios-scroll">
        <LargeTitle title="From school" subtitle={`Photograph what came home in ${name}'s folder`} />
        <LearningImportClient childId={childId} childName={name} inboundAddress={inboundAddress} />
        <div style={{ height: 24 }} />
      </div>
      <TabBar current="more" currentUserId={user.id} sourceApp="children" />
    </div>
  );
}
