export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

// A child's front door: the link on their own iPad's home screen.
//
// Three states, decided by the device rather than by a sign-in:
//   not set up  → a short screen for the grown-up to enter a pairing code
//   locked      → a big four-digit keypad with the child's name on it
//   unlocked    → the child's own screen, the same one parents open from the
//                 workspace, for that one child only
//
// It lives outside /children on purpose: everything under /children asks for
// a parent's account, and this page must work on a device that has none.

import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { currentKidDevice, touchKidDevice } from "@/app/children/_lib/kid-device";
import { loadLearning } from "@/app/children/_lib/learning";
import KidClient from "@/app/children/_components/KidClient";
import { availableCloudVoices } from "@/lib/buddy-voice";
import KidPair from "./KidPair";
import KidPinPad from "./KidPinPad";

export const metadata: Metadata = {
  title: "My Learning",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Learn", statusBarStyle: "default" },
};

export default async function KidFrontDoor({ searchParams }: { searchParams: Promise<{ code?: string; open?: string }> }) {
  const { code, open } = await searchParams;
  const device = await currentKidDevice();
  if (!device) return <div data-ui="ios"><KidPair initialCode={code ?? ""} /></div>;

  const svc = createServiceClient() as any;
  const { data: child } = await svc.schema("hub").from("family_members")
    .select("id, display_name, birth_year, role").eq("id", device.childId).maybeSingle();
  if (!child || child.role !== "child") return <div data-ui="ios"><KidPair initialCode="" /></div>;
  const first = (child.display_name ?? "friend").split(" ")[0];

  if (!device.unlocked) {
    return <div data-ui="ios"><KidPinPad first={first} lockedSeconds={device.lockedSeconds} /></div>;
  }

  await touchKidDevice(device.id);

  const L = await loadLearning(svc, child.id, child.birth_year, new Date());
  return (
    <div data-ui="ios">
      <KidClient
        childId={child.id}
        name={child.display_name ?? "Friend"}
        gradeLabel={L?.gradeLabel ?? null}
        tasks={L?.tasks ?? []}
        exercises={(L?.exercises ?? []).map((e) => ({ id: e.id, title: e.title, steps: e.steps, minutes: e.minutes }))}
        spelling={L?.spellingWeek ? { weekId: L.spellingWeek.id, words: L.spellingWeek.words, sightWords: L.spellingWeek.sightWords, pattern: L.spellingWeek.pattern } : null}
        stars={L?.stars ?? { total: 0, week: 0 }}
        openTo={open === "buddy" ? "buddy" : "home"}
        cloudVoices={availableCloudVoices()}
        kidMode
      />
    </div>
  );
}
