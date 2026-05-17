"use client";

import { useState, useTransition } from "react";
import { addTodo, toggleTodo, deleteTodo, type Todo } from "../actions";

export default function TodosWidget({ initialTodos }: { initialTodos: Todo[] }) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();

  const open = todos.filter((t) => !t.completed);
  const done = todos.filter((t) => t.completed);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = input.trim();
    if (!title) return;
    setInput("");
    startTransition(async () => {
      const result = await addTodo(title);
      if (result.todo) setTodos((prev) => [result.todo!, ...prev]);
    });
  }

  function handleToggle(todo: Todo) {
    const newCompleted = !todo.completed;
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, completed: newCompleted } : t))
    );
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

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="serif" style={{ fontSize: 20 }}>To-dos</h2>
        <span style={{ fontSize: 10, color: "var(--color-ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {open.length} open · {done.length} done
        </span>
      </div>

      <form onSubmit={handleAdd} style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a to-do…"
          disabled={pending}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "1px solid var(--color-rule)",
            borderRadius: 8,
            background: "var(--color-bg)",
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
          }}
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
      </form>

      {todos.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--color-ink-4)", padding: "20px 0", textAlign: "center" }}>
          Nothing yet. Add your first one above.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", maxHeight: 240, overflowY: "auto" }}>
          {[...open, ...done].map((t) => (
            <TodoRow key={t.id} todo={t} onToggle={() => handleToggle(t)} onDelete={() => handleDelete(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TodoRow({ todo, onToggle, onDelete }: { todo: Todo; onToggle: () => void; onDelete: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderTop: "1px solid var(--color-rule-soft)",
      }}
    >
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
      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: todo.completed ? "var(--color-ink-4)" : "var(--color-ink)",
          textDecoration: todo.completed ? "line-through" : undefined,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {todo.title}
      </span>
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
        }}
      >
        ×
      </button>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-rule)",
  borderRadius: 12,
  padding: "18px 20px",
  boxShadow: "var(--shadow-card)",
  minHeight: 180,
};
