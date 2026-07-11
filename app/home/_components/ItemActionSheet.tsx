"use client";

// iOS-style action sheet for a single Today item (reminder / to-do / course
// reminder / etc). Lists the actions valid for the item's `kind` — Complete,
// Snooze (reminders only), Edit, Open, Delete — and hosts a minimal inline
// edit form. Reuses the shared .ios-sheet surface (see app/ios.css) so it
// matches Quick Capture. All mutations are handed back to the parent
// (HomeClient) via the callbacks, which apply them optimistically.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ItemKind } from "./TodayHubIOS";

export interface SheetTarget {
  kind: ItemKind;
  actionId: string;
  title: string;
  href?: string;
}

// Per-kind capabilities. `dateOnly` edit forms show just a date (to-dos);
// reminders also get a time. Only reminders can be snoozed.
const CAP: Record<ItemKind, { complete: boolean; snooze: boolean; edit: boolean; del: boolean; dateOnly: boolean }> = {
  reminder:        { complete: true,  snooze: true,  edit: true,  del: true,  dateOnly: false },
  course_reminder: { complete: true,  snooze: false, edit: false, del: false, dateOnly: true },
  todo:            { complete: true,  snooze: false, edit: true,  del: true,  dateOnly: true },
  workout:         { complete: false, snooze: false, edit: false, del: false, dateOnly: true },
  conflict:        { complete: false, snooze: false, edit: false, del: false, dateOnly: true },
  other:           { complete: false, snooze: false, edit: false, del: false, dateOnly: true },
};

/** True when the item has at least one action worth a tap. */
export function isActionable(kind: ItemKind): boolean {
  const c = CAP[kind];
  return c.complete || c.edit || c.del;
}

// Snooze to N days out at 9am local. Runs in an event handler, so `Date` is fine.
function snoozeIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

function SheetButton({
  children, onClick, destructive,
}: { children: React.ReactNode; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left", padding: "14px 16px", borderRadius: 12,
        background: "var(--ios-cell)", fontSize: 17,
        fontWeight: destructive ? 600 : 400,
        color: destructive ? "var(--ios-red)" : "var(--ios-label)",
      }}
    >
      {children}
    </button>
  );
}

export default function ItemActionSheet({
  target, onClose, onComplete, onDelete, onSnooze, onEdit,
}: {
  target: SheetTarget;
  onClose: () => void;
  onComplete: (kind: ItemKind, actionId: string) => void;
  onDelete: (kind: ItemKind, actionId: string) => void;
  onSnooze: (actionId: string, until: string) => void;
  onEdit: (kind: ItemKind, actionId: string, patch: { title?: string; due?: string | null }) => void;
}) {
  const router = useRouter();
  const cap = CAP[target.kind];
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  // Edit form state
  const [title, setTitle] = useState(target.title);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");

  function saveEdit() {
    const patch: { title?: string; due?: string | null } = {};
    const t = title.trim();
    if (t && t !== target.title) patch.title = t;
    if (date) patch.due = cap.dateOnly ? date : new Date(`${date}T${time}:00`).toISOString();
    if (patch.title !== undefined || patch.due !== undefined) {
      onEdit(target.kind, target.actionId, patch);
    }
    onClose();
  }

  return (
    <>
      <div className="ios-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="ios-sheet" role="dialog" aria-modal="true" aria-label={editing ? "Edit item" : target.title}>
        <div className="ios-grabber" />

        {editing ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <button className="ios-btn--plain" onClick={() => setEditing(false)}>Back</button>
              <span className="ios-headline">Edit</span>
              <button className="ios-btn--plain" onClick={saveEdit}>Save</button>
            </div>

            <textarea
              className="ios-field"
              rows={1}
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div className="ios-group-header" style={{ padding: "10px 0 8px" }}>Due</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="ios-chip ios-chip--sm"
                style={{ colorScheme: "light dark" }}
                aria-label="Due date"
              />
              {!cap.dateOnly && (
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="ios-chip ios-chip--sm"
                  aria-label="Due time"
                />
              )}
            </div>
            <p className="ios-footnote" style={{ padding: "10px 0 0", color: "var(--ios-label-2)" }}>
              Leave the date blank to keep the current schedule.
            </p>

            <button className="ios-btn ios-btn--primary" style={{ marginTop: 22 }} onClick={saveEdit}>
              Save changes
            </button>
          </>
        ) : (
          <>
            <div className="ios-group-header" style={{ padding: "2px 0 12px" }}>{target.title}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cap.complete && (
                <SheetButton onClick={() => { onComplete(target.kind, target.actionId); onClose(); }}>
                  Complete
                </SheetButton>
              )}
              {cap.snooze && (
                <>
                  <SheetButton onClick={() => { onSnooze(target.actionId, snoozeIso(1)); onClose(); }}>
                    Snooze · Tomorrow
                  </SheetButton>
                  <SheetButton onClick={() => { onSnooze(target.actionId, snoozeIso(7)); onClose(); }}>
                    Snooze · Next week
                  </SheetButton>
                </>
              )}
              {cap.edit && <SheetButton onClick={() => setEditing(true)}>Edit</SheetButton>}
              {target.href && (
                <SheetButton onClick={() => { onClose(); router.push(target.href!); }}>
                  Open
                </SheetButton>
              )}
              {cap.del && (
                <SheetButton
                  destructive
                  onClick={() => {
                    if (confirmDel) { onDelete(target.kind, target.actionId); onClose(); }
                    else setConfirmDel(true);
                  }}
                >
                  {confirmDel ? "Tap again to delete" : "Delete"}
                </SheetButton>
              )}
            </div>
            <button className="ios-btn ios-btn--plain" style={{ width: "100%", marginTop: 10 }} onClick={onClose}>
              Cancel
            </button>
          </>
        )}
      </div>
    </>
  );
}
