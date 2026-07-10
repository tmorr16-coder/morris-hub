"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ShoppingItem {
  id: string;
  item: string;
  quantity: string | null;
  checked: boolean;
  added_by: string;
  created_at: string;
  assigned_to?: string | null;
}

const memberSelectStyle: React.CSSProperties = {
  padding: "10px 12px", border: "var(--ios-hair) solid var(--ios-separator)",
  borderRadius: 10, background: "var(--ios-cell)", color: "var(--ios-label)", fontSize: 15,
};

export default function ShoppingList({
  initialItems, userId, nameMap, members,
}: {
  initialItems: ShoppingItem[];
  userId: string;
  nameMap: Record<string, string>;
  members: { id: string; name: string }[];
}) {
  const [items, setItems] = useState(initialItems);
  const [text, setText] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [adding, setAdding] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any;

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setAdding(true);
    const fields = { item: text.trim(), circle_owner_id: userId, added_by: userId };
    let res = await db.schema("hub").from("shopping_items")
      .insert({ ...fields, assigned_to: assignTo || null }).select("*").single();
    if (res.error && /assigned_to/.test(res.error.message)) {
      res = await db.schema("hub").from("shopping_items")
        .insert({ ...fields }).select("*").single();
    }
    setAdding(false);
    if (!res.error && res.data) {
      setItems((prev) => [...prev, res.data]);
      setText("");
      setAssignTo("");
    }
  }

  async function toggle(id: string, checked: boolean) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !checked } : i)));
    await db.schema("hub").from("shopping_items").update({ checked: !checked }).eq("id", id);
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await db.schema("hub").from("shopping_items").delete().eq("id", id);
  }

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  return (
    <section className="ios-group">
      <h2 className="ios-group-header">Shopping list</h2>
      <form onSubmit={addItem} style={{ display: "flex", gap: 8, margin: "0 var(--ios-gutter) 10px", flexWrap: "wrap" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an item…"
          style={{ flex: 1, minWidth: 140, padding: "10px 14px", border: "var(--ios-hair) solid var(--ios-separator)", borderRadius: 10, background: "var(--ios-cell)", color: "var(--ios-label)", fontSize: 16 }}
        />
        <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} aria-label="Assign to" style={memberSelectStyle}>
          <option value="">Everyone</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button type="submit" disabled={adding || !text.trim()} className="ios-btn ios-btn--primary" style={{ width: "auto", minHeight: 0, padding: "10px 18px", fontSize: 15, opacity: adding || !text.trim() ? 0.5 : 1 }}>
          Add
        </button>
      </form>
      {items.length === 0 ? (
        <p className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "0 var(--ios-gutter)" }}>List is empty.</p>
      ) : (
        <div className="ios-list">
          {[...unchecked, ...checked].map((i) => (
            <div key={i.id} className="ios-cell">
              <span className="ios-cell-lead">
                <button onClick={() => toggle(i.id, i.checked)} aria-label={i.checked ? "Uncheck" : "Check off"}
                  style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                    border: `2px solid ${i.checked ? "var(--ios-green)" : "var(--ios-label-3)"}`,
                    background: i.checked ? "var(--ios-green)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  {i.checked && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5L20 7" /></svg>}
                </button>
              </span>
              <span className="ios-cell-body">
                <span className="ios-cell-title ios-subhead" style={{
                  textDecoration: i.checked ? "line-through" : "none",
                  color: i.checked ? "var(--ios-label-2)" : "var(--ios-label)",
                }}>
                  {i.item}{i.quantity ? ` · ${i.quantity}` : ""}
                </span>
                {i.assigned_to && (
                  <span className="ios-chip ios-chip--sm ios-caption" style={{ marginTop: 4, alignSelf: "flex-start", color: "var(--ios-tint)" }}>
                    for {nameMap[i.assigned_to] ?? "Member"}
                  </span>
                )}
              </span>
              <span className="ios-caption" style={{ color: "var(--ios-label-3)", flexShrink: 0 }}>{nameMap[i.added_by] ?? "Family"}</span>
              <button onClick={() => remove(i.id)} aria-label="Remove" className="ios-cell-trail" style={{ color: "var(--ios-label-3)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
