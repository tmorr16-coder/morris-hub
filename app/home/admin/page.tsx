export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { IOSScreen, LargeTitle, Group, Cell, IconBadge, TabBar, Icons } from "@/components/ios";
import AdminClient, {
  type AdminUser,
  type Invitation,
  type IntegrationRequest,
  type PendingUser,
  type SupportTicket,
  type AccessRequest,
} from "./_components/AdminClient";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Admin gate
  const { data: currentProfile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((currentProfile as { role: string } | null)?.role !== "admin") {
    redirect("/home");
  }

  // Fetch all auth users
  const { data: { users: authUsers } } = await db.auth.admin.listUsers({ perPage: 200 });

  // Fetch all profiles
  const { data: profileRows } = await db
    .from("profiles")
    .select("id, email, full_name, role, app_access, created_at");

  type ProfileRow = {
    id: string;
    email: string | null;
    full_name: string | null;
    role: string;
    app_access: string[] | null;
    created_at: string;
  };
  const profileMap = new Map<string, ProfileRow>(
    ((profileRows as ProfileRow[]) ?? []).map((p) => [p.id, p])
  );

  type AuthUser = {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
    user_metadata: Record<string, string>;
  };
  const users: AdminUser[] = ((authUsers as AuthUser[]) ?? [])
    .filter((u) => u.last_sign_in_at || profileMap.has(u.id))
    .map((u) => {
      const p = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email ?? p?.email ?? "",
        name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? p?.full_name ?? "",
        avatarUrl: u.user_metadata?.avatar_url ?? u.user_metadata?.picture ?? null,
        role: (p?.role as "admin" | "standard") ?? "standard",
        appAccess: (p?.app_access ?? []) as import("./_components/AdminClient").AdminUser["appAccess"],
        createdAt: u.created_at,
        isCurrentUser: u.id === user.id,
      };
    });

  // Pending invitations
  const { data: inviteRows } = await db
    .from("invitations")
    .select("id, email, role, invited_at, accepted_at")
    .is("accepted_at", null)
    .order("invited_at", { ascending: false });
  type InviteRow = { id: string; email: string; role: string; invited_at: string; accepted_at: string | null };
  const invitations: Invitation[] = ((inviteRows as InviteRow[]) ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role as "standard" | "admin",
    invitedAt: r.invited_at,
  }));

  // Pending users
  type PendingRow = { id: string; email: string | null; full_name: string | null; created_at: string };
  let pendingUsers: PendingUser[] = [];
  try {
    const { data: pendingRows } = await db
      .from("profiles")
      .select("id, email, full_name, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    const authUserMap = new Map<string, AuthUser>(((authUsers as AuthUser[]) ?? []).map((u) => [u.id, u]));
    pendingUsers = ((pendingRows as PendingRow[]) ?? []).map((p) => {
      const au = authUserMap.get(p.id);
      return {
        id: p.id,
        email: au?.email ?? p.email ?? "",
        name: au?.user_metadata?.full_name ?? au?.user_metadata?.name ?? p.full_name ?? "",
        avatarUrl: au?.user_metadata?.avatar_url ?? au?.user_metadata?.picture ?? null,
        createdAt: p.created_at,
      };
    });
  } catch { /* ignore */ }

  // Support tickets
  type TicketRow = { id: string; user_name: string | null; user_email: string | null; type: string; subject: string; description: string; status: string; created_at: string };
  let supportTickets: SupportTicket[] = [];
  try {
    const { data: ticketRows } = await db
      .from("support_tickets")
      .select("id, user_name, user_email, type, subject, description, status, created_at")
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false });
    supportTickets = ((ticketRows as TicketRow[]) ?? []).map((t) => ({
      id: t.id,
      userName: t.user_name ?? "",
      userEmail: t.user_email ?? "",
      type: t.type as SupportTicket["type"],
      subject: t.subject,
      description: t.description,
      status: t.status as SupportTicket["status"],
      createdAt: t.created_at,
    }));
  } catch { /* ignore */ }

  // Integration requests
  type ReqRow = { id: string; user_name: string | null; user_email: string | null; integration: string; description: string | null; status: string; created_at: string };
  let integrationRequests: IntegrationRequest[] = [];
  try {
    const { data: reqRows } = await db
      .from("integration_requests")
      .select("id, user_name, user_email, integration, description, status, created_at")
      .in("status", ["pending", "planned"])
      .order("created_at", { ascending: false });
    integrationRequests = ((reqRows as ReqRow[]) ?? []).map((r) => ({
      id: r.id,
      userName: r.user_name ?? "",
      userEmail: r.user_email ?? "",
      integration: r.integration,
      description: r.description ?? "",
      status: r.status as IntegrationRequest["status"],
      createdAt: r.created_at,
    }));
  } catch { /* ignore */ }

  // Access requests (public landing-page waitlist → hub.waitlist).
  // Degrade gracefully: if the table is missing we surface an empty state note
  // rather than crashing the whole admin page.
  type WaitlistRow = { id: string; name: string | null; email: string; note: string | null; created_at: string };
  let accessRequests: AccessRequest[] = [];
  let waitlistAvailable = true;
  try {
    const { data: waitlistRows, error: waitlistError } = await db
      .schema("hub")
      .from("waitlist")
      .select("id, name, email, note, created_at")
      .order("created_at", { ascending: true });
    if (waitlistError) {
      waitlistAvailable = false;
    } else {
      accessRequests = ((waitlistRows as WaitlistRow[]) ?? []).map((r) => ({
        id: r.id,
        name: r.name ?? "",
        email: r.email,
        note: r.note ?? "",
        createdAt: r.created_at,
      }));
    }
  } catch {
    waitlistAvailable = false;
  }

  return (
    <IOSScreen>
      <Link href="/home" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ios-tint)", padding: "6px 16px 0", fontWeight: 500 }} className="ios-subhead">
        <Icons.ChevronLeft style={{ width: 16, height: 16 }} /> Home
      </Link>
      <LargeTitle
        title="Admin"
        subtitle="Users, per-app access, support tickets & integration requests"
        trailing={<Icons.GearIcon style={{ width: 26, height: 26, color: "var(--ios-label-2)" }} />}
      />

      <Group header="Platform">
        <Cell
          lead={<IconBadge color="var(--ios-tint)"><Icons.ChartIcon /></IconBadge>}
          title="Usage & costs"
          subtitle="Daily activity trends & cost breakdown"
          href="/home/admin/analytics"
        />
      </Group>

      <div style={{ padding: "8px 16px 0" }}>
        <AdminClient
          users={users}
          invitations={invitations}
          integrationRequests={integrationRequests}
          pendingUsers={pendingUsers}
          supportTickets={supportTickets}
          accessRequests={accessRequests}
          waitlistAvailable={waitlistAvailable}
        />
      </div>

      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
