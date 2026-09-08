import Link from "next/link";
import { Icons } from "@/components/ios";
import type { PinnedChildSummary } from "@/app/children/_lib/pinned";

/**
 * One child's week, on Today.
 *
 * Deliberately not a Group of Cells. Today is already a stack of grouped
 * lists, and a child rendered as one more list reads as one more category of
 * admin. This is a single card with a name on it, which is what it is.
 *
 * Two ways in and no more: Buddy, because that is the thing a child asks for
 * and it should never be more than a tap from anywhere; and the workspace, for
 * the parent. Everything else about the week lives there.
 */

function fmtDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 1 && days < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PinnedChildCard({ child }: { child: PinnedChildSummary }) {
  const { first, gradeLabel, done, total, next, testOn, starsWeek, childId } = child;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const allDone = total > 0 && done === total;

  return (
    <section className="ios-group" aria-label={`${first}'s week`}>
      <div
        className="ios-list"
        style={{ margin: "0 var(--ios-gutter)", padding: "14px 16px 12px" }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
            {first}
          </h2>
          <span
            className="ios-subhead"
            style={{ fontWeight: 700, whiteSpace: "nowrap", color: allDone ? "var(--ios-green)" : "var(--ios-label-2)" }}
          >
            {total === 0 ? "—" : allDone ? "All done 🎉" : `${done} of ${total}`}
          </span>
        </div>

        <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 1 }}>
          {[gradeLabel, testOn ? `spelling test ${fmtDay(testOn)}` : null, starsWeek > 0 ? `${starsWeek} ⭐ this week` : null]
            .filter(Boolean)
            .join(" · ")}
        </div>

        {total > 0 && (
          <div
            aria-hidden
            style={{ height: 6, borderRadius: 999, background: "var(--ios-fill)", marginTop: 10, overflow: "hidden" }}
          >
            <div
              style={{
                height: "100%", width: `${pct}%`, borderRadius: 999,
                background: allDone ? "var(--ios-green)" : "var(--ios-tint)",
              }}
            />
          </div>
        )}

        <div
          className="ios-subhead"
          style={{
            marginTop: 10, color: next ? "var(--ios-label)" : "var(--ios-label-2)",
            display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden",
          }}
        >
          {next
            ? <><span style={{ color: "var(--ios-label-3)" }}>Next: </span>{next}</>
            : total === 0
              ? "Nothing set for this week yet."
              : "Everything for this week is done."}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Link
            href={`/children/${childId}/kid?open=buddy`}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px 12px", borderRadius: 12, textDecoration: "none",
              background: "linear-gradient(135deg, #FFB13A, #FF7A59)", color: "#fff",
              fontSize: 15, fontWeight: 700,
            }}
          >
            <span aria-hidden>🦉</span> Ask Buddy
          </Link>
          <Link
            href={`/children/${childId}`}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px 12px", borderRadius: 12, textDecoration: "none",
              background: "var(--ios-fill)", color: "var(--ios-label)",
              fontSize: 15, fontWeight: 700,
            }}
          >
            <Icons.ChecklistIcon aria-hidden style={{ width: 16, height: 16 }} />
            The week
          </Link>
        </div>
      </div>
    </section>
  );
}
