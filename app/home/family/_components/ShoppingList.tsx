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
}

export default function ShoppingList({
  initialItems, userId, nameForId,
}: {
  initialItems: ShoppingItem[];
  userId: string;
  nameForId: (id: string) => string;
}) {
  const [items, setItems] = useState(initialItems);
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any;

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setAdding(true);
    const { data, error } = await db.schema("hub").from("shopping_items")
      .insert({ item: text.trim(), circle_owner_id: userId, added_by: userId })
      .select("id, item, quantity, checked, added_by, created_at")
      .single();
    setAdding(false);
    if (!error && data) {
      setItems((prev) => [...prev, data]);
      setText("");
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
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", margin: "0 0 12px", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
        🛒 Shopping list
      </h2>
      <form onSubmit={addItem} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an item…"
          style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--color-rule)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }}
        />
        <button type="submit" disabled={adding || !text.trim()}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Add
        </button>
      </form>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--color-ink-4)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>List is empty.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {[...unchecked, ...checked].map((i) => (
            <div key={i.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 14px",
              background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 8,
              opacity: i.checked ? 0.55 : 1,
            }}>
              <button onClick={() => toggle(i.id, i.checked)} aria-label={i.checked ? "Uncheck" : "Check off"}
                style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: "pointer",
                  border: `2px solid ${i.checked ? "var(--color-accent)" : "var(--color-rule)"}`,
                  background: i.checked ? "var(--color-accent)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                {i.checked && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}
              </button>
              <span style={{
                flex: 1, fontSize: 13, color: "var(--color-ink-2)", fontFamily: "var(--font-geist, system-ui), sans-serif",
                textDecoration: i.checked ? "line-through" : "none",
              }}>
                {i.item}{i.quantity ? ` · ${i.quantity}` : ""}
              </span>
              <span style={{ fontSize: 10, color: "var(--color-ink-4)", flexShrink: 0 }}>{nameForId(i.added_by)}</span>
              <button onClick={() => remove(i.id)} aria-label="Remove"
                style={{ background: "none", border: "none", color: "var(--color-ink-4)", cursor: "pointer", fontSize: 13, flexShrink: 0 }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
