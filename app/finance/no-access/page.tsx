"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";

export default function NoAccessPage() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null);
    });
  }, []);

  async function handleSignOut() {
    await createClient().auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="ios-scroll">
      <LargeTitle title="No access" subtitle="Finance isn't enabled for your account" />

      <Group
        footer={`Your account isn't enabled for the Finance app. An admin can grant access from the platform admin panel.${email ? ` Signed in as ${email}.` : ""}`}
      >
        <Cell
          chevron={false}
          lead={<IconBadge color="var(--ios-finance)"><Icons.WalletIcon /></IconBadge>}
          title="Finance locked"
          subtitle="Access not granted"
        />
      </Group>

      <Group>
        <Cell
          lead={<IconBadge color="var(--ios-tint)"><Icons.HomeIcon /></IconBadge>}
          title="Back to morrisai.family"
          onClick={() => { window.location.href = "https://morrisai.family"; }}
        />
        <Cell
          lead={<IconBadge color="var(--ios-red)"><Icons.PersonIcon /></IconBadge>}
          title="Sign out"
          onClick={handleSignOut}
        />
      </Group>

      <div style={{ height: 12 }} />
    </div>
  );
}
