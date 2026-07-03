export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LargeTitle, Icons } from "@/components/ios";
import CareerSettingsClient from "./_components/CareerSettingsClient";
import LsatSettingsClient from "./_components/LsatSettingsClient";

// Career layout already provides PlatformMenu + CareerSubNav + container padding
export default async function CareerSettingsPage({ searchParams }: { searchParams: Promise<{ linkedin?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data: profile } = await service
    .schema("career").from("career_profile")
    .select("linkedin_url, linkedin_connected, linkedin_connected_at, linkedin_name, linkedin_picture_url")
    .eq("user_id", user.id).maybeSingle();

  const { data: studentSettings } = await service
    .schema("student_support").from("student_settings")
    .select("lsat_enabled, lsat_target_score")
    .eq("user_id", user.id).maybeSingle();

  const params = await searchParams;
  const linkedinStatus = params.linkedin;

  return (
    <div className="ios-scroll">
      <Link href="/career" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ios-tint)", padding: "6px 16px 0", fontWeight: 500 }} className="ios-subhead">
        <Icons.ChevronLeft style={{ width: 16, height: 16 }} /> Career
      </Link>
      <LargeTitle title="Settings" subtitle="LinkedIn, notifications & privacy" trailing={<Icons.GearIcon style={{ width: 26, height: 26, color: "var(--ios-label-2)" }} />} />
      <CareerSettingsClient
        linkedinConnected={!!profile?.linkedin_connected}
        linkedinName={profile?.linkedin_name ?? null}
        linkedinPictureUrl={profile?.linkedin_picture_url ?? null}
        linkedinConnectedAt={profile?.linkedin_connected_at ?? null}
        linkedinUrl={profile?.linkedin_url ?? ""}
        flashMessage={linkedinStatus === "connected" ? "LinkedIn connected — profile data imported." : linkedinStatus === "error" ? "LinkedIn connection failed. Try again." : null}
        flashType={linkedinStatus === "connected" ? "success" : "error"}
        linkedinConfigured={!!process.env.LINKEDIN_CLIENT_ID}
      />
      <LsatSettingsClient
        lsatEnabled={!!studentSettings?.lsat_enabled}
        lsatTargetScore={studentSettings?.lsat_target_score ?? null}
      />
    </div>
  );
}
