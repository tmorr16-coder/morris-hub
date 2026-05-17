"use client";

import { useState, useTransition } from "react";
import { addTodo, toggleTodo, deleteTodo, updateTodo, type Todo, type Priority } from "../actions";

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_COLOR: Record<Priority, string> = {
  high: "#9A3B2A",
  medium: "#B88A2E",
  low: "#6B6258",
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
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: "#9A3B2A" };
  if (days === 0) return { text: "today", color: "#B88A2E" };
  if (days === 1) return { text: "tomorrow", color: "#6B6258" };
  if (days <= 7) return { text: `in ${days}d`, color: "#6B6258" };
  const d = new Date(dateStr + "T00:00:00");
  return { text: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), color: "#8A8278" };
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
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="serif" style={{ fontSize: 20 }}>To-dos</h2>
        <span style={{ fontSize: 10, color: "var(--color-ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {open.length} open · {done.length} done
        </span>
      </div>

      <form onSubmit={handleAdd} style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
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
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--color-accent-dark)",
              background: "var(--color-accent)",
              color: "#FFFDF8",
              fontSize: 13,
              fontWeight: 500,
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
            <div style={{ display: "flex", gap: 4 }}>
              {(["high", "medium", "low"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(priority === p ? null : p)}
                  style={{
                    padding: "3px 9px",
                    borderRadius: 12,
                    border: `1px solid ${priority === p ? PRIORITY_COLOR[p] : "var(--color-rule)"}`,
                    background: priority === p ? PRIORITY_COLOR[p] : "transparent",
                    color: priority === p ? "#FFFDF8" : PRIORITY_COLOR[p],
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
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
              style={{ ...inputStyle, padding: "5px 8px", fontSize: 11, width: 130 }}
            />
          </div>
        )}
      </form>

      {todos.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--color-ink-4)", padding: "20px 0", textAlign: "center" }}>
          Nothing yet. Add your first one above.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", maxHeight: 320, overflowY: "auto" }}>
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
    <div
      style={{
        padding: "8px 0",
        borderTop: "1px solid var(--color-rule-soft)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={onToggle}
          aria-label={todo.completed ? "Mark incomplete" : "Mark complete"}
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            border: `1.5px solid ${todo.completed ? "var(--color-accent)" : "var(--color-rule)"}`,
            background: todo.completed ? "var(--color-accent)" : "transparent",
            color: "#FFFDF8",
            cursor: "pointer",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            flexShrink: 0,
          }}
        >
          {todo.completed && "✓"}
        </button>

        {todo.priority && !todo.completed && (
          <span
            style={{
              width: 6,
              height: 6,
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
          style={{
            flex: 1,
            fontSize: 13,
            color: todo.completed ? "var(--color-ink-4)" : "var(--color-ink)",
            textDecoration: todo.completed ? "line-through" : undefined,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            cursor: todo.completed ? "default" : "pointer",
          }}
        >
          {todo.title}
        </span>

        {due && !todo.completed && (
          <span style={{ fontSize: 10, color: due.color, whiteSpace: "nowrap", fontWeight: 500 }}>
            {due.text}
          </span>
        )}

        <button
          onClick={onDelete}
          aria-label="Delete"
          style={{
            background: "none",
            border: "none",
            color: "var(--color-ink-4)",
            fontSize: 14,
            cursor: "pointer",
            padding: "2px 4px",
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {editing && !todo.completed && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, marginLeft: 28, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 3 }}>
            {(["high", "medium", "low"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onSetPriority(todo.priority === p ? null : p)}
                style={{
                  padding: "2px 7px",
                  borderRadius: 10,
                  border: `1px solid ${todo.priority === p ? PRIORITY_COLOR[p] : "var(--color-rule)"}`,
                  background: todo.priority === p ? PRIORITY_COLOR[p] : "transparent",
                  color: todo.priority === p ? "#FFFDF8" : PRIORITY_COLOR[p],
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
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
            style={{ ...inputStyle, padding: "4px 7px", fontSize: 11, width: 130 }}
          />
          {todo.due_date && (
            <button
              type="button"
              onClick={() => onSetDue(null)}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-ink-3)",
                fontSize: 11,
                cursor: "pointer",
              }}
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
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-rule)",
  borderRadius: 12,
  padding: "18px 20px",
  boxShadow: "var(--shadow-card)",
  minHeight: 200,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  border: "1px solid var(--color-rule)",
  borderRadius: 8,
  background: "var(--color-bg)",
  color: "var(--color-ink)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
