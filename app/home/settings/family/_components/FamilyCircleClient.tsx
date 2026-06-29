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
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Current circle */}
      <section>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 12 }}>
          Your circle ({inCircle.length})
        </div>
        {inCircle.length === 0 ? (
          <div style={{ fontSize: 14, color: "var(--color-ink-4)", padding: "20px 0" }}>
            No one in your circle yet. Add people from the platform below.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {inCircle.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--color-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--color-accent)", flexShrink: 0 }}>
                  {initials(p)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>{p.full_name ?? "—"}</div>
                  <div style={{ fontSize: 11, color: "var(--color-ink-4)" }}>{p.email}</div>
                </div>
                <button
                  onClick={() => remove(p)}
                  disabled={pending.has(p.id)}
                  style={{ fontSize: 11, padding: "5px 12px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-3)", cursor: "pointer", fontFamily: "inherit", opacity: pending.has(p.id) ? 0.5 : 1 }}
                >
                  {pending.has(p.id) ? "…" : "Remove"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add more */}
      {notInCircle.length > 0 && (
        <section>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 12 }}>
            Add to circle
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notInCircle.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--color-bg-deep)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--color-ink-3)", flexShrink: 0 }}>
                  {initials(p)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "var(--color-ink)" }}>{p.full_name ?? "—"}</div>
                  <div style={{ fontSize: 11, color: "var(--color-ink-4)" }}>{p.email}</div>
                </div>
                <button
                  onClick={() => add(p)}
                  disabled={pending.has(p.id)}
                  style={{ fontSize: 11, fontWeight: 600, padding: "5px 14px", borderRadius: 8, border: "none", background: "var(--color-accent)", color: "#FFFDF8", cursor: "pointer", fontFamily: "inherit", opacity: pending.has(p.id) ? 0.5 : 1 }}
                >
                  {pending.has(p.id) ? "Adding…" : "+ Add"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {people.length === 0 && (
        <div style={{ fontSize: 14, color: "var(--color-ink-4)", textAlign: "center", padding: "40px 0" }}>
          No other platform members found.
        </div>
      )}

      <div style={{ padding: "14px 16px", background: "var(--color-bg-deep)", borderRadius: 10, fontSize: 12, color: "var(--color-ink-3)", lineHeight: 1.6 }}>
        <strong style={{ color: "var(--color-ink-2)" }}>How family circles work:</strong> Adding someone to your circle lets you share specific accounts or data with them when you choose. Each person controls what they share — adding them here doesn't give them access to anything automatically.
      </div>
    </div>
  );
}
