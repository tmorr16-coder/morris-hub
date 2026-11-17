// A sample of the child's screen with made-up data, for looking at the design
// without a child, a parent account or an iPad. Nothing here is saved: the
// sample child does not exist, so every server call is refused.

import KidClient from "@/app/children/_components/KidClient";

export const metadata = { title: "Buddy sample", robots: { index: false, follow: false } };

const day = new Date().toISOString().slice(0, 10);
const task = (id: string, kind: "exercise" | "spelling" | "reading" | "custom", title: string, done = false, stars = 0, extra: object = {}) => ({
  id, kind, exerciseId: null, title, instructions: null, payload: {}, assignedOn: day, dueOn: null,
  completedAt: done ? new Date().toISOString() : null, stars, childNote: null, ...extra,
});

export default async function BuddySample({ searchParams }: { searchParams: Promise<{ view?: string; empty?: string }> }) {
  const { view, empty } = await searchParams;
  const words = ["pine", "time", "pie", "lie", "tie", "gift", "milk", "find", "mild", "does"];
  return (
    <div data-ui="ios">
      <KidClient
        childId="00000000-0000-4000-8000-000000000000"
        name="Sam Sample"
        gradeLabel="1st grade"
        tasks={empty ? [] : [
          task("t1", "reading", "Read for 10 minutes", true, 2),
          task("t2", "spelling", "Spell this week's words", false, 0, { payload: { words } }),
          task("t3", "exercise", "Long i word sort", false, 0, { instructions: "Sort the words into two piles: silent e (pine, time) and ie (pie, lie, tie)." }),
          task("t4", "custom", "Say Psalm 107:1 out loud"),
        ]}
        exercises={[]}
        spelling={{ weekId: "00000000-0000-4000-8000-000000000001", words, sightWords: [], pattern: "Long i" }}
        stars={{ total: 37, week: 9 }}
        streak={3}
        openTo={view === "tutor" ? "buddy" : "home"}
        cloudVoices={[]}
        kidMode
      />
    </div>
  );
}
