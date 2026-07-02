export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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
    <div style={{ maxWidth: 620 }}>
      <Link href="/career" style={{ fontSize: 12, color: "var(--color-ink-3)", textDecoration: "none", marginBottom: 20, display: "inline-block" }}>← Career</Link>
      <h1 className="serif" style={{ fontSize: 32, marginBottom: 6 }}>Career Settings</h1>
      <p style={{ fontSize: 13, color: "var(--color-ink-3)", marginBottom: 32 }}>
        Manage LinkedIn, notifications, and privacy for your career module.
      </p>
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
