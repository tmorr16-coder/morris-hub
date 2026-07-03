"use client";

import { useState, useTransition } from "react";
import { addTodo, toggleTodo, deleteTodo, updateTodo, type Todo, type Priority } from "../actions";

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_COLOR: Record<Priority, string> = {
  high: "var(--ios-red)",
  medium: "var(--ios-orange)",
  low: "var(--ios-label-2)",
};

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

function todayLocal(): string {
  return new Date().toLocaleDateString("sv"); // YYYY-MM-DD
}

function daysFromNow(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

function dueLabel(dateStr: string): { text: string; color: string } {
  const days = daysFromNow(dateStr);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: "var(--ios-red)" };
  if (days === 0) return { text: "today", color: "var(--ios-orange)" };
  if (days === 1) return { text: "tomorrow", color: "var(--ios-label-2)" };
  if (days <= 7) return { text: `in ${days}d`, color: "var(--ios-label-2)" };
  const d = new Date(dateStr + "T00:00:00");
  return { text: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), color: "var(--ios-label-3)" };
}

function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    // Open first
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.completed) {
      // Completed: most recent first
      return a.created_at < b.created_at ? 1 : -1;
    }
    // Open: priority first, then due_date, then created_at desc
    const pa = a.priority ? PRIORITY_RANK[a.priority] : 99;
    const pb = b.priority ? PRIORITY_RANK[b.priority] : 99;
    if (pa !== pb) return pa - pb;
    if (a.due_date && b.due_date) return a.due_date < b.due_date ? -1 : 1;
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return a.created_at < b.created_at ? 1 : -1;
  });
}

export default function TodosWidget({ initialTodos }: { initialTodos: Todo[] }) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [input, setInput] = useState("");
  const [priority, setPriority] = useState<Priority | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [pending, startTransition] = useTransition();

  const open = todos.filter((t) => !t.completed);
  const done = todos.filter((t) => t.completed);
  const sorted = sortTodos(todos);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = input.trim();
    if (!title) return;
    setInput("");
    const captured = { priority, due_date: dueDate || null };
    setPriority(null);
    setDueDate("");
    setShowOptions(false);
    startTransition(async () => {
      const result = await addTodo({ title, ...captured });
      if (result.todo) setTodos((prev) => [result.todo!, ...prev]);
    });
  }

  function handleToggle(todo: Todo) {
    const newCompleted = !todo.completed;
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, completed: newCompleted } : t)));
    startTransition(async () => {
      await toggleTodo(todo.id, newCompleted);
    });
  }

  function handleDelete(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    startTransition(async () => {
      await deleteTodo(id);
    });
  }

  function handleSetPriority(id: string, newP: Priority | null) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, priority: newP } : t)));
    startTransition(async () => {
      await updateTodo(id, { priority: newP });
    });
  }

  function handleSetDue(id: string, newDate: string | null) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, due_date: newDate } : t)));
    startTransition(async () => {
      await updateTodo(id, { due_date: newDate });
    });
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, padding: "12px 16px 6px" }}>
        <span className="ios-headline">To-dos</span>
        <span className="ios-footnote ios-num" style={{ color: "var(--ios-label-2)" }}>
          {open.length} open · {done.length} done
        </span>
      </div>

      <form onSubmit={handleAdd} style={{ padding: "6px 16px 12px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add a to-do…"
            disabled={pending}
            onFocus={() => setShowOptions(true)}
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            style={{
              padding: "0 16px",
              borderRadius: 10,
              border: "none",
              background: "var(--ios-tint)",
              color: "var(--ios-on-tint)",
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: pending || !input.trim() ? "not-allowed" : "pointer",
              opacity: pending || !input.trim() ? 0.5 : 1,
            }}
          >
            Add
          </button>
        </div>

        {(showOptions || priority || dueDate) && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {(["high", "medium", "low"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(priority === p ? null : p)}
                  style={priorityChip(priority === p, PRIORITY_COLOR[p])}
                >
                  {PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={todayLocal()}
              style={{ ...inputStyle, flex: "0 0 auto", padding: "7px 10px", fontSize: 13, width: 140 }}
            />
          </div>
        )}
      </form>

      {todos.length === 0 ? (
        <p className="ios-footnote" style={{ color: "var(--ios-label-3)", padding: "16px", textAlign: "center" }}>
          Nothing yet. Add your first one above.
        </p>
      ) : (
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {sorted.map((t) => (
            <TodoRow
              key={t.id}
              todo={t}
              onToggle={() => handleToggle(t)}
              onDelete={() => handleDelete(t.id)}
              onSetPriority={(p) => handleSetPriority(t.id, p)}
              onSetDue={(d) => handleSetDue(t.id, d)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TodoRow({
  todo,
  onToggle,
  onDelete,
  onSetPriority,
  onSetDue,
}: {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
  onSetPriority: (p: Priority | null) => void;
  onSetDue: (d: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const due = todo.due_date ? dueLabel(todo.due_date) : null;

  return (
    <div className="ios-cell" style={{ flexDirection: "column", alignItems: "stretch", gap: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onToggle}
          aria-label={todo.completed ? "Mark incomplete" : "Mark complete"}
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: `1.6px solid ${todo.completed ? "var(--ios-green)" : "var(--ios-label-3)"}`,
            background: todo.completed ? "var(--ios-green)" : "transparent",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            flexShrink: 0,
          }}
        >
          {todo.completed && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" width={13} height={13} aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 6.5" />
            </svg>
          )}
        </button>

        {todo.priority && !todo.completed && (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: PRIORITY_COLOR[todo.priority],
              display: "inline-block",
              flexShrink: 0,
            }}
            aria-label={`${PRIORITY_LABEL[todo.priority]} priority`}
          />
        )}

        <span
          onClick={() => !todo.completed && setEditing(!editing)}
          className="ios-cell-title ios-truncate"
          style={{
            flex: 1,
            color: todo.completed ? "var(--ios-label-3)" : "var(--ios-label)",
            textDecoration: todo.completed ? "line-through" : undefined,
            cursor: todo.completed ? "default" : "pointer",
          }}
        >
          {todo.title}
        </span>

        {due && !todo.completed && (
          <span className="ios-caption ios-num" style={{ color: due.color, whiteSpace: "nowrap", fontWeight: 500 }}>
            {due.text}
          </span>
        )}

        <button onClick={onDelete} aria-label="Delete" style={iconBtn}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15} aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {editing && !todo.completed && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, marginLeft: 34, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {(["high", "medium", "low"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onSetPriority(todo.priority === p ? null : p)}
                style={priorityChip(todo.priority === p, PRIORITY_COLOR[p])}
              >
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={todo.due_date ?? ""}
            onChange={(e) => onSetDue(e.target.value || null)}
            min={todayLocal()}
            style={{ ...inputStyle, flex: "0 0 auto", padding: "6px 9px", fontSize: 13, width: 140 }}
          />
          {todo.due_date && (
            <button
              type="button"
              onClick={() => onSetDue(null)}
              className="ios-caption"
              style={{ background: "none", border: "none", color: "var(--ios-tint)", cursor: "pointer" }}
            >
              clear date
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ios-cell)",
  borderRadius: "var(--ios-radius-card)",
  overflow: "hidden",
  minHeight: 320,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "10px 12px",
  border: "var(--ios-hair) solid var(--ios-separator)",
  borderRadius: 10,
  background: "var(--ios-bg)",
  color: "var(--ios-label)",
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const iconBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--ios-label-3)",
  cursor: "pointer",
  padding: "2px 4px",
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
};

function priorityChip(selected: boolean, color: string): React.CSSProperties {
  return {
    padding: "5px 12px",
    borderRadius: 999,
    border: "none",
    background: selected ? color : "var(--ios-fill)",
    color: selected ? "#fff" : "var(--ios-label)",
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "inherit",
    cursor: "pointer",
    lineHeight: 1,
  };
}
