export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PlatformMenu from "@/components/PlatformMenu";
import CareerSubNav from "../_components/CareerSubNav";
import CareerSettingsClient from "./_components/CareerSettingsClient";

export default async function CareerSettingsPage({ searchParams }: { searchParams: { linkedin?: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data: profile } = await service
    .schema("career").from("career_profile")
    .select("linkedin_url, linkedin_connected, linkedin_connected_at, linkedin_name, linkedin_picture_url, career_interests, target_roles")
    .eq("user_id", user.id).maybeSingle();

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
  };

  const linkedinStatus = searchParams.linkedin;

  return (
    <div>
      <PlatformMenu currentApp="career" user={menuUser} />
      <CareerSubNav />
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "32px 28px 80px" }}>
        <Link href="/career" style={{ fontSize: 12, color: "var(--color-ink-3)", textDecoration: "none", marginBottom: 20, display: "inline-block" }}>← Career</Link>
        <h1 className="serif" style={{ fontSize: 32, marginBottom: 6 }}>
          Career Settings
        </h1>
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
      </main>
    </div>
  );
}
