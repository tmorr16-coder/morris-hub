"use client";

import { NavBar, Chip, Icons } from "@/components/ios";
import { useState } from "react";

const SUGGESTIONS = ["Top priorities today?", "Anything overdue?", "How are my investments?", "Plan my week"];

type Msg = { from: "ai" | "me"; text: string };

const SEED: Msg[] = [
  { from: "ai", text: "Morning, Terry. I can see across your whole hub — family, health, money, calendar. What can I help with?" },
];

export default function AskScreen({ onBack }: { onBack: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>(SEED);
  const [input, setInput] = useState("");

  function ask(text: string) {
    const t = text.trim();
    if (!t) return;
    const reply = canned(t);
    setMsgs((m) => [...m, { from: "me", text: t }, { from: "ai", text: reply }]);
    setInput("");
  }

  return (
    <>
      <NavBar back={{ label: "Today", onBack }} title="Ask Morris" />

      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 16px 96px" }}>
        {msgs.map((m, i) => (
          <div key={i} className={`ios-bubble ios-bubble--${m.from}`}>{m.text}</div>
        ))}

        {msgs.length <= 1 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {SUGGESTIONS.map((s) => (
              <Chip key={s} small onClick={() => ask(s)}>{s}</Chip>
            ))}
          </div>
        )}
      </div>

      <form
        className="ios-composer"
        onSubmit={(e) => { e.preventDefault(); ask(input); }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Morris anything…" aria-label="Message" />
        <button type="submit" className="ios-send" aria-label="Send">
          <Icons.ChevronRight aria-hidden style={{ width: 18, height: 18, transform: "rotate(-90deg)" }} />
        </button>
      </form>
    </>
  );
}

function canned(q: string): string {
  const l = q.toLowerCase();
  if (l.includes("overdue")) return "One overdue item: your Upper Body workout from Jul 1 was never logged. Want me to reschedule it to tonight at 6?";
  if (l.includes("invest")) return "Your portfolio is $291,500, up 0.4% today. Biggest mover: NVDA +2.1%. Net worth hit a new high of $482,300.";
  if (l.includes("week")) return "This week you have soccer (Emma, Wed 4:30), a dentist visit (Jack, Thu 8 AM), and Emma's biology quiz Saturday. The Duke Energy bill is due today. Want a summary sent to Sarah?";
  return "Your top 3 today: pay the Duke Energy bill (due 5 PM), get to your 6 PM workout, and Emma's quiz is Saturday so she may want to review tonight.";
}
