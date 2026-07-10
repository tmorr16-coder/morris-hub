"use client";

import { useState } from "react";

interface Person {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  in_circle: boolean;
  circle_id: string | null;
}

export default function FamilyCircleClient({ initialEveryone }: { initialEveryone: Person[] }) {
  const [people, setPeople] = useState(initialEveryone);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const inCircle = people.filter((p) => p.in_circle);
  const notInCircle = people.filter((p) => !p.in_circle);

  async function add(person: Person) {
    setPending((s) => new Set(s).add(person.id));
    setPeople((prev) => prev.map((p) => p.id === person.id ? { ...p, in_circle: true } : p));
    await fetch("/api/family/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_user_id: person.id }),
    });
    setPending((s) => { const n = new Set(s); n.delete(person.id); return n; });
  }

  async function remove(person: Person) {
    setPending((s) => new Set(s).add(person.id));
    setPeople((prev) => prev.map((p) => p.id === person.id ? { ...p, in_circle: false, circle_id: null } : p));
    await fetch("/api/family/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_user_id: person.id }),
    });
    setPending((s) => { const n = new Set(s); n.delete(person.id); return n; });
  }

  function initials(p: Person): string {
    const name = p.full_name ?? p.email ?? "?";
    return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Current circle */}
      <section>
        <div className="ios-group-header" style={{ padding: "0 4px 7px" }}>
          Your circle ({inCircle.length})
        </div>
        {inCircle.length === 0 ? (
          <div className="ios-list" style={{ margin: 0 }}>
            <div className="ios-cell">
              <span className="ios-cell-body">
                <span className="ios-cell-sub" style={{ marginTop: 0 }}>No one in your circle yet. Add people from the platform below.</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="ios-list" style={{ margin: 0 }}>
            {inCircle.map((p) => (
              <div key={p.id} className="ios-cell">
                <span className="ios-cell-lead">
                  <span style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--ios-fill)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "var(--ios-tint)", flexShrink: 0 }}>
                    {initials(p)}
                  </span>
                </span>
                <span className="ios-cell-body">
                  <span className="ios-cell-title" style={{ fontWeight: 600 }}>{p.full_name ?? "—"}</span>
                  <span className="ios-cell-sub">{p.email}</span>
                </span>
                <span className="ios-cell-trail">
                  <button
                    onClick={() => remove(p)}
                    disabled={pending.has(p.id)}
                    className="ios-chip ios-chip--sm"
                    style={{ opacity: pending.has(p.id) ? 0.5 : 1 }}
                  >
                    {pending.has(p.id) ? "…" : "Remove"}
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add more */}
      {notInCircle.length > 0 && (
        <section>
          <div className="ios-group-header" style={{ padding: "0 4px 7px" }}>
            Add to circle
          </div>
          <div className="ios-list" style={{ margin: 0 }}>
            {notInCircle.map((p) => (
              <div key={p.id} className="ios-cell">
                <span className="ios-cell-lead">
                  <span style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--ios-fill)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "var(--ios-label-2)", flexShrink: 0 }}>
                    {initials(p)}
                  </span>
                </span>
                <span className="ios-cell-body">
                  <span className="ios-cell-title">{p.full_name ?? "—"}</span>
                  <span className="ios-cell-sub">{p.email}</span>
                </span>
                <span className="ios-cell-trail">
                  <button
                    onClick={() => add(p)}
                    disabled={pending.has(p.id)}
                    className="ios-chip ios-chip--sm is-selected"
                    style={{ opacity: pending.has(p.id) ? 0.5 : 1 }}
                  >
                    {pending.has(p.id) ? "Adding…" : "Add"}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {people.length === 0 && (
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textAlign: "center", padding: "40px 0" }}>
          No other platform members found.
        </div>
      )}

      <div className="ios-footnote" style={{ padding: "14px 16px", background: "var(--ios-fill-2)", borderRadius: "var(--ios-radius-card)", color: "var(--ios-label-2)", lineHeight: 1.5 }}>
        <strong style={{ color: "var(--ios-label)" }}>How family circles work:</strong> Adding someone to your circle lets you share specific accounts or data with them when you choose. Each person controls what they share — adding them here doesn&rsquo;t give them access to anything automatically.
      </div>
    </div>
  );
}
