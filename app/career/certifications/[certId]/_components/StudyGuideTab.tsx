"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { StudySection, KeyTerm } from "@/app/api/student-support/certifications/[id]/study-guide/route";

interface Domain { id: string; name: string; weight_pct: number; }
interface Props {
  examId: string;
  examName: string;
  examCode: string | null;
  domains: Domain[];
  colorTag: string;
  initialSections?: StudySection[];
}

type ViewMode = "read" | "focus";

// ── Audio hook ─────────────────────────────────────────────────────────────────
function useAudio() {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused]     = useState(false);
  const [rate, setRate]         = useState(1.0);
  const [voice, setVoice]       = useState<SpeechSynthesisVoice | null>(null);
  const [voices, setVoices]     = useState<SpeechSynthesisVoice[]>([]);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const load = () => {
      const v = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
      setVoices(v);
      const preferred = v.find((v) => v.name.includes("Google US English") || v.name.includes("Samantha") || v.name.includes("Alex")) ?? v[0] ?? null;
      setVoice(preferred);
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    if (voice) u.voice = voice;
    u.onstart = () => { setSpeaking(true); setPaused(false); };
    u.onend   = () => { setSpeaking(false); setPaused(false); utterRef.current = null; onEnd?.(); };
    u.onerror = () => { setSpeaking(false); setPaused(false); };
    utterRef.current = u;
    window.speechSynthesis.speak(u);
  }, [rate, voice]);

  const pause  = () => { window.speechSynthesis.pause();  setPaused(true); };
  const resume = () => { window.speechSynthesis.resume(); setPaused(false); };
  const stop   = () => { window.speechSynthesis.cancel(); setSpeaking(false); setPaused(false); };

  return { speaking, paused, rate, setRate, voice, setVoice, voices, speak, pause, resume, stop };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sectionToSpeech(s: StudySection): string {
  const parts: string[] = [
    `${s.domain_name}. ${s.title}.`,
    ...s.paragraphs,
    "Key terms.",
    ...s.key_terms.map((t) => `${t.term}. ${t.definition}.${t.exam_tip ? " Exam tip: " + t.exam_tip : ""}`),
    "Key takeaways.",
    ...s.takeaways,
    s.self_test.question ? `Test yourself. ${s.self_test.question}` : "",
  ];
  return parts.filter(Boolean).join(" ");
}

const STORAGE_KEY = (examId: string) => `cert_study_progress_${examId}`;

function loadProgress(examId: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY(examId)) ?? "[]")); }
  catch { return new Set(); }
}
function saveProgress(examId: string, completed: Set<string>) {
  localStorage.setItem(STORAGE_KEY(examId), JSON.stringify([...completed]));
}

// ── Main component ────────────────────────────────────────────────────────────
type RegenerateScope = "all" | "current" | "select";

export default function StudyGuideTab({ examId, examName, examCode, domains, colorTag, initialSections = [] }: Props) {
  const [sections, setSections]       = useState<StudySection[]>(initialSections);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(initialSections[0]?.id ?? null);
  const [mode, setMode]               = useState<ViewMode>("read");
  const [showSelfTestAnswer, setShowSelfTestAnswer] = useState(false);
  const [completed, setCompleted]     = useState<Set<string>>(new Set());
  // Regeneration scope modal state
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenScope, setRegenScope]   = useState<RegenerateScope>("current");
  const [regenDomainIds, setRegenDomainIds] = useState<string[]>([]);
  const audio = useAudio();

  // Load progress from localStorage on mount
  useEffect(() => { setCompleted(loadProgress(examId)); }, [examId]);

  const activeSection = sections.find((s) => s.id === activeSectionId) ?? sections[0] ?? null;

  async function generate(domainIds?: string[]) {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/student-support/certifications/${examId}/study-guide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainIds: domainIds ?? domains.map((d) => d.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      // Merge new sections into existing ones (replace matching domains, keep others)
      setSections((prev) => {
        const incoming = data.sections as StudySection[];
        const incomingIds = new Set(incoming.map((s) => s.id));
        const kept = prev.filter((s) => !incomingIds.has(s.id));
        return [...kept, ...incoming].sort((a, b) => {
          const ai = domains.findIndex((d) => d.id === a.id);
          const bi = domains.findIndex((d) => d.id === b.id);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
      });
      if (sections.length === 0) setActiveSectionId(data.sections[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function openRegenModal() {
    setRegenScope("current");
    setRegenDomainIds(activeSection ? [activeSection.id] : []);
    setShowRegenModal(true);
  }

  async function confirmRegen() {
    setShowRegenModal(false);
    let ids: string[] | undefined;
    if (regenScope === "all")     ids = undefined; // all domains
    if (regenScope === "current") ids = activeSection ? [activeSection.id] : undefined;
    if (regenScope === "select")  ids = regenDomainIds.length > 0 ? regenDomainIds : undefined;
    await generate(ids);
  }

  function markComplete(id: string) {
    const next = new Set(completed);
    if (next.has(id)) next.delete(id); else next.add(id);
    setCompleted(next);
    saveProgress(examId, next);
  }

  function playSection(s: StudySection) {
    audio.speak(sectionToSpeech(s));
  }

  function goNext() {
    if (!activeSection) return;
    const idx = sections.findIndex((s) => s.id === activeSection.id);
    if (idx < sections.length - 1) {
      setActiveSectionId(sections[idx + 1].id);
      setShowSelfTestAnswer(false);
      audio.stop();
    }
  }

  function goPrev() {
    if (!activeSection) return;
    const idx = sections.findIndex((s) => s.id === activeSection.id);
    if (idx > 0) {
      setActiveSectionId(sections[idx - 1].id);
      setShowSelfTestAnswer(false);
      audio.stop();
    }
  }

  const pct = sections.length > 0 ? Math.round((completed.size / sections.length) * 100) : 0;
  const currentIdx = sections.findIndex((s) => s.id === activeSectionId);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (sections.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📖</div>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, marginBottom: 8 }}>Study Guide</h3>
        <p style={{ fontSize: 14, color: "var(--color-ink-3)", lineHeight: 1.6, maxWidth: 420, marginBottom: 28 }}>
          Claude will generate a complete study guide for {examName}{examCode ? ` (${examCode})` : ""} — organized by domain with key concepts, explanations, and audio playback.
        </p>
        {error && <div style={{ background: "rgba(154,59,42,0.08)", border: "1px solid rgba(154,59,42,0.3)", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "var(--color-red)", marginBottom: 16, maxWidth: 420 }}>{error}</div>}
        <button onClick={() => generate()} disabled={loading} style={{ padding: "12px 32px", borderRadius: 10, border: "none", background: loading ? "var(--color-bg-sunk)" : colorTag, color: "white", fontSize: 15, fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? `Generating guide${domains.length > 1 ? ` (${domains.length} domains)` : ""}…` : "Generate Study Guide"}
        </button>
        {loading && <p style={{ fontSize: 12, color: "var(--color-ink-4)", marginTop: 12 }}>This takes 20–40 seconds. Each domain gets a full section.</p>}
      </div>
    );
  }

  // ── Focus mode overlay ────────────────────────────────────────────────────
  if (mode === "focus" && activeSection) {
    return (
      <FocusMode
        section={activeSection}
        sections={sections}
        currentIdx={currentIdx}
        completed={completed}
        audio={audio}
        colorTag={colorTag}
        onClose={() => setMode("read")}
        onNext={goNext}
        onPrev={goPrev}
        onMarkComplete={markComplete}
        showAnswer={showSelfTestAnswer}
        onToggleAnswer={() => setShowSelfTestAnswer((v) => !v)}
      />
    );
  }

  // ── Reader mode ───────────────────────────────────────────────────────────
  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24, alignItems: "start" }}>

      {/* Left: section nav */}
      <div style={{ position: "sticky", top: 80 }}>
        {/* Progress */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: "var(--color-ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            <span>Progress</span><span style={{ color: pct === 100 ? "var(--color-moss)" : "var(--color-ink-3)" }}>{pct}%</span>
          </div>
          <div style={{ height: 4, background: "var(--color-line)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "var(--color-moss)" : colorTag, borderRadius: 4, transition: "width 400ms ease" }} />
          </div>
        </div>

        {sections.map((s, i) => {
          const isActive = s.id === activeSectionId;
          const isDone   = completed.has(s.id);
          return (
            <button
              key={s.id}
              onClick={() => { setActiveSectionId(s.id); setShowSelfTestAnswer(false); audio.stop(); }}
              style={{ display: "flex", alignItems: "flex-start", gap: 8, width: "100%", padding: "10px 12px", borderRadius: 8, textAlign: "left", border: `1px solid ${isActive ? colorTag : "transparent"}`, background: isActive ? `${colorTag}12` : "transparent", cursor: "pointer", marginBottom: 4 }}
            >
              <span style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${isDone ? "var(--color-moss)" : isActive ? colorTag : "var(--color-line-2)"}`, background: isDone ? "var(--color-moss)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, fontSize: 10, color: "white" }}>
                {isDone ? "✓" : <span style={{ color: isActive ? colorTag : "var(--color-ink-4)", fontWeight: 700, fontSize: 9 }}>{i + 1}</span>}
              </span>
              <div>
                <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? colorTag : "var(--color-ink-2)", lineHeight: 1.3 }}>{s.domain_name}</div>
                <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginTop: 1 }}>{s.estimated_minutes} min</div>
              </div>
            </button>
          );
        })}

        <button onClick={openRegenModal} disabled={loading} style={{ width: "100%", marginTop: 12, padding: "7px 12px", borderRadius: 7, border: `1px solid ${colorTag}50`, background: "transparent", color: colorTag, fontSize: 11, fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Regenerating…" : "↺ Regenerate"}
        </button>
      </div>

      {/* Regeneration scope modal */}
      {showRegenModal && (
        <>
          <div onClick={() => setShowRegenModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 201, background: "#fff", borderRadius: 16, padding: "28px 28px 24px", width: "min(460px, calc(100vw - 32px))", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "#111827" }}>Regenerate study guide</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>Choose what to regenerate. Saved content will be replaced for the selected sections.</p>

            {/* Scope options */}
            {[
              { value: "current" as RegenerateScope, label: `Current section only`, sub: activeSection ? `"${activeSection.domain_name}"` : "active section" },
              { value: "all" as RegenerateScope, label: "Full guide", sub: `All ${sections.length || domains.length} domains` },
              { value: "select" as RegenerateScope, label: "Select specific domains", sub: "Choose below" },
            ].map((opt) => (
              <button key={opt.value} onClick={() => setRegenScope(opt.value)} style={{ display: "flex", gap: 12, alignItems: "flex-start", width: "100%", padding: "12px 14px", borderRadius: 10, border: `2px solid ${regenScope === opt.value ? colorTag : "#e5e7eb"}`, background: regenScope === opt.value ? `${colorTag}0C` : "#f9fafb", cursor: "pointer", marginBottom: 8, textAlign: "left", fontFamily: "inherit" }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${regenScope === opt.value ? colorTag : "#d1d5db"}`, background: regenScope === opt.value ? colorTag : "transparent", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{opt.sub}</div>
                </div>
              </button>
            ))}

            {/* Domain checkboxes for "select" scope */}
            {regenScope === "select" && domains.length > 0 && (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", marginTop: 4, marginBottom: 4, maxHeight: 200, overflowY: "auto" }}>
                {domains.map((d) => (
                  <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", cursor: "pointer", borderBottom: "1px solid #f3f4f6" }}>
                    <input type="checkbox" checked={regenDomainIds.includes(d.id)}
                      onChange={() => setRegenDomainIds((prev) => prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id])}
                      style={{ width: 15, height: 15, accentColor: colorTag }} />
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{d.name}</span>
                      {d.weight_pct > 0 && <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 6 }}>{d.weight_pct}%</span>}
                      {sections.find((s) => s.id === d.id) && <span style={{ fontSize: 10, color: colorTag, marginLeft: 6, fontWeight: 600 }}>saved</span>}
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowRegenModal(false)} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid #e5e7eb", background: "transparent", cursor: "pointer", fontSize: 14, color: "#374151", fontFamily: "inherit" }}>
                Cancel
              </button>
              <button
                onClick={confirmRegen}
                disabled={regenScope === "select" && regenDomainIds.length === 0}
                style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", background: regenScope === "select" && regenDomainIds.length === 0 ? "#e5e7eb" : colorTag, color: regenScope === "select" && regenDomainIds.length === 0 ? "#9ca3af" : "#fff", cursor: regenScope === "select" && regenDomainIds.length === 0 ? "default" : "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit" }}
              >
                Regenerate
              </button>
            </div>
          </div>
        </>
      )}

      {/* Right: reader */}
      {activeSection && (
        <SectionReader
          section={activeSection}
          isFirst={currentIdx === 0}
          isLast={currentIdx === sections.length - 1}
          completed={completed.has(activeSection.id)}
          audio={audio}
          colorTag={colorTag}
          onNext={goNext}
          onPrev={goPrev}
          onMarkComplete={() => markComplete(activeSection.id)}
          onFocusMode={() => setMode("focus")}
          onPlay={() => playSection(activeSection)}
          showAnswer={showSelfTestAnswer}
          onToggleAnswer={() => setShowSelfTestAnswer((v) => !v)}
        />
      )}
    </div>
  );
}

// ── Section reader ────────────────────────────────────────────────────────────

interface ReaderProps {
  section: StudySection;
  isFirst: boolean;
  isLast: boolean;
  completed: boolean;
  audio: ReturnType<typeof useAudio>;
  colorTag: string;
  onNext: () => void;
  onPrev: () => void;
  onMarkComplete: () => void;
  onFocusMode: () => void;
  onPlay: () => void;
  showAnswer: boolean;
  onToggleAnswer: () => void;
}

function SectionReader({ section, isFirst, isLast, completed, audio, colorTag, onNext, onPrev, onMarkComplete, onFocusMode, onPlay, showAnswer, onToggleAnswer }: ReaderProps) {
  return (
    <div>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: colorTag, marginBottom: 4 }}>{section.domain_name}</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 400, margin: 0, color: "var(--color-ink)", lineHeight: 1.2 }}>{section.title}</h2>
          <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 6 }}>~{section.estimated_minutes} min read</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={onFocusMode} title="Focus mode" style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--color-line)", background: "var(--color-bg-raised)", cursor: "pointer", fontSize: 14 }}>⛶</button>
          <AudioControls audio={audio} onPlay={onPlay} colorTag={colorTag} />
        </div>
      </div>

      {/* Body paragraphs */}
      <div style={{ marginBottom: 28 }}>
        {section.paragraphs.map((p, i) => (
          <p key={i} style={{ fontSize: 15, lineHeight: 1.8, color: "var(--color-ink)", marginBottom: 16 }}>{p}</p>
        ))}
      </div>

      {/* Key terms */}
      {section.key_terms.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", marginBottom: 14 }}>Key Terms</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {section.key_terms.map((t, i) => <KeyTermCard key={i} term={t} colorTag={colorTag} />)}
          </div>
        </div>
      )}

      {/* Takeaways */}
      {section.takeaways.length > 0 && (
        <div style={{ background: `${colorTag}0C`, border: `1px solid ${colorTag}30`, borderRadius: 12, padding: "16px 20px", marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: colorTag, marginBottom: 12 }}>Key Takeaways</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {section.takeaways.map((t, i) => <li key={i} style={{ fontSize: 13, color: "var(--color-ink-2)", lineHeight: 1.5 }}>{t}</li>)}
          </ul>
        </div>
      )}

      {/* Self-test */}
      {section.self_test.question && (
        <div style={{ background: "var(--color-bg-raised)", border: "1px solid var(--color-line)", borderRadius: 12, padding: "16px 20px", marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", marginBottom: 10 }}>Test Yourself</div>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-ink)", marginBottom: 12 }}>{section.self_test.question}</p>
          <button onClick={onToggleAnswer} style={{ fontSize: 12, color: colorTag, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "inherit" }}>
            {showAnswer ? "Hide answer ↑" : "Reveal answer ↓"}
          </button>
          {showAnswer && (
            <div style={{ marginTop: 12, padding: "12px 16px", background: `${colorTag}0A`, borderLeft: `3px solid ${colorTag}`, borderRadius: "0 8px 8px 0", fontSize: 13, color: "var(--color-ink-2)", lineHeight: 1.6 }}>
              {section.self_test.answer}
            </div>
          )}
        </div>
      )}

      {/* Footer nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "1px solid var(--color-line)" }}>
        <button onClick={onPrev} disabled={isFirst} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--color-line)", background: "transparent", color: isFirst ? "var(--color-ink-4)" : "var(--color-ink-2)", cursor: isFirst ? "default" : "pointer", fontSize: 13, fontFamily: "inherit", opacity: isFirst ? 0.4 : 1 }}>
          ← Previous
        </button>
        <button onClick={onMarkComplete} style={{ padding: "9px 20px", borderRadius: 8, border: `1px solid ${completed ? "var(--color-moss)" : colorTag}`, background: completed ? "rgba(74,107,58,0.08)" : "transparent", color: completed ? "var(--color-moss)" : colorTag, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
          {completed ? "✓ Completed" : "Mark complete"}
        </button>
        <button onClick={onNext} disabled={isLast} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: isLast ? "var(--color-bg-sunk)" : colorTag, color: isLast ? "var(--color-ink-4)" : "white", cursor: isLast ? "default" : "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", opacity: isLast ? 0.4 : 1 }}>
          Next →
        </button>
      </div>
    </div>
  );
}

// ── Key term card ──────────────────────────────────────────────────────────────
function KeyTermCard({ term, colorTag }: { term: KeyTerm; colorTag: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: "var(--color-bg-raised)", border: "1px solid var(--color-line)", borderRadius: 8, overflow: "hidden" }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>{term.term}</span>
        <span style={{ fontSize: 12, color: "var(--color-ink-4)", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 12px" }}>
          <p style={{ fontSize: 13, color: "var(--color-ink-2)", lineHeight: 1.55, margin: "0 0 8px 0" }}>{term.definition}</p>
          {term.exam_tip && (
            <div style={{ display: "flex", gap: 6, alignItems: "flex-start", background: `${colorTag}0C`, border: `1px solid ${colorTag}30`, borderRadius: 6, padding: "6px 10px" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: colorTag, flexShrink: 0, marginTop: 1 }}>EXAM TIP</span>
              <span style={{ fontSize: 12, color: "var(--color-ink-2)", lineHeight: 1.5 }}>{term.exam_tip}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Audio controls ─────────────────────────────────────────────────────────────
function AudioControls({ audio, onPlay, colorTag }: { audio: ReturnType<typeof useAudio>; onPlay: () => void; colorTag: string }) {
  const [showOptions, setShowOptions] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!showOptions) return;
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowOptions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showOptions]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {audio.speaking ? (
          <>
            <button onClick={audio.paused ? audio.resume : audio.pause} style={{ padding: "7px 10px", borderRadius: 7, border: `1px solid ${colorTag}`, background: `${colorTag}12`, color: colorTag, cursor: "pointer", fontSize: 14 }}>
              {audio.paused ? "▶" : "⏸"}
            </button>
            <button onClick={audio.stop} style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--color-line)", background: "transparent", color: "var(--color-ink-3)", cursor: "pointer", fontSize: 12 }}>■</button>
          </>
        ) : (
          <button onClick={onPlay} title="Listen to this section" style={{ padding: "7px 12px", borderRadius: 7, border: `1px solid ${colorTag}`, background: `${colorTag}12`, color: colorTag, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            🔊 Listen
          </button>
        )}
        <button
          onClick={() => setShowOptions((v) => !v)}
          style={{ padding: "7px 8px", borderRadius: 7, border: `1px solid ${showOptions ? colorTag : "var(--color-line)"}`, background: showOptions ? `${colorTag}12` : "transparent", color: showOptions ? colorTag : "var(--color-ink-3)", cursor: "pointer", fontSize: 11 }}
        >
          ⚙
        </button>
      </div>

      {showOptions && (
        <>
          {/* Invisible full-screen backdrop so tapping outside closes it */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 39 }}
            onClick={() => setShowOptions(false)}
          />
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 8px)",
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: 12,
            padding: "16px 18px",
            zIndex: 40,
            minWidth: 240,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Audio Settings
              </span>
              <button
                onClick={() => setShowOptions(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#9ca3af", lineHeight: 1, padding: "0 2px" }}
              >
                ✕
              </button>
            </div>

            {/* Speed */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>Speed</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[0.75, 1.0, 1.25, 1.5].map((r) => (
                  <button
                    key={r}
                    onClick={() => audio.setRate(r)}
                    style={{
                      flex: 1, padding: "7px 0", borderRadius: 7,
                      border: `1.5px solid ${audio.rate === r ? colorTag : "#e5e7eb"}`,
                      background: audio.rate === r ? colorTag : "#f9fafb",
                      color: audio.rate === r ? "#fff" : "#374151",
                      fontSize: 12, fontWeight: audio.rate === r ? 700 : 400,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {r}×
                  </button>
                ))}
              </div>
            </div>

            {/* Voice */}
            {audio.voices.length > 1 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>Voice</div>
                <select
                  value={audio.voice?.name ?? ""}
                  onChange={(e) => audio.setVoice(audio.voices.find((v) => v.name === e.target.value) ?? null)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#111827", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}
                >
                  {audio.voices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Focus mode ─────────────────────────────────────────────────────────────────
interface FocusProps {
  section: StudySection;
  sections: StudySection[];
  currentIdx: number;
  completed: Set<string>;
  audio: ReturnType<typeof useAudio>;
  colorTag: string;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onMarkComplete: (id: string) => void;
  showAnswer: boolean;
  onToggleAnswer: () => void;
}

function FocusMode({ section, sections, currentIdx, completed, audio, colorTag, onClose, onNext, onPrev, onMarkComplete, showAnswer, onToggleAnswer }: FocusProps) {
  const isFirst = currentIdx === 0;
  const isLast  = currentIdx === sections.length - 1;
  const isDone  = completed.has(section.id);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape")       onClose();
      if (e.key === "ArrowRight")   onNext();
      if (e.key === "ArrowLeft")    onPrev();
      if (e.key === " ") { e.preventDefault(); audio.speaking ? (audio.paused ? audio.resume() : audio.pause()) : audio.speak(sectionToSpeech(section)); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, audio.speaking, audio.paused]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "var(--color-bg)", display: "flex", flexDirection: "column" }}>
      {/* Focus header */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--color-line)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--color-bg-raised)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={onClose} style={{ fontSize: 13, color: "var(--color-ink-3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>✕ Exit focus</button>
          <span style={{ fontSize: 12, color: "var(--color-ink-4)" }}>{currentIdx + 1} / {sections.length}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AudioControls audio={audio} onPlay={() => audio.speak(sectionToSpeech(section))} colorTag={colorTag} />
          <span style={{ fontSize: 11, color: "var(--color-ink-4)" }}>Space=play · ← → navigate · Esc=exit</span>
        </div>
      </div>

      {/* Focus body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "40px max(32px, calc(50vw - 380px))" }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: colorTag, marginBottom: 8 }}>{section.domain_name}</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 400, marginBottom: 24, color: "var(--color-ink)", lineHeight: 1.2 }}>{section.title}</h1>

        {section.paragraphs.map((p, i) => (
          <p key={i} style={{ fontSize: 16, lineHeight: 1.9, color: "var(--color-ink)", marginBottom: 20 }}>{p}</p>
        ))}

        {section.key_terms.length > 0 && (
          <div style={{ marginTop: 32, marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", marginBottom: 16 }}>Key Terms</div>
            {section.key_terms.map((t, i) => (
              <div key={i} style={{ marginBottom: 14, paddingLeft: 16, borderLeft: `3px solid ${colorTag}50` }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", marginBottom: 3 }}>{t.term}</div>
                <div style={{ fontSize: 13, color: "var(--color-ink-2)", lineHeight: 1.5, marginBottom: t.exam_tip ? 4 : 0 }}>{t.definition}</div>
                {t.exam_tip && <div style={{ fontSize: 11, color: colorTag, fontWeight: 600 }}>EXAM TIP: {t.exam_tip}</div>}
              </div>
            ))}
          </div>
        )}

        {section.takeaways.length > 0 && (
          <div style={{ background: `${colorTag}0C`, border: `1px solid ${colorTag}30`, borderRadius: 12, padding: "16px 20px", marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: colorTag, marginBottom: 10 }}>Key Takeaways</div>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              {section.takeaways.map((t, i) => <li key={i} style={{ fontSize: 14, color: "var(--color-ink-2)", lineHeight: 1.5 }}>{t}</li>)}
            </ul>
          </div>
        )}

        {section.self_test.question && (
          <div style={{ background: "var(--color-bg-raised)", border: "1px solid var(--color-line)", borderRadius: 12, padding: "18px 22px", marginBottom: 40 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", marginBottom: 10 }}>Test Yourself</div>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--color-ink)", marginBottom: 12 }}>{section.self_test.question}</p>
            <button onClick={onToggleAnswer} style={{ fontSize: 13, color: colorTag, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "inherit" }}>
              {showAnswer ? "Hide answer ↑" : "Reveal answer ↓"}
            </button>
            {showAnswer && (
              <div style={{ marginTop: 12, padding: "14px 18px", background: `${colorTag}0A`, borderLeft: `3px solid ${colorTag}`, borderRadius: "0 8px 8px 0", fontSize: 14, color: "var(--color-ink-2)", lineHeight: 1.65 }}>
                {section.self_test.answer}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Focus footer */}
      <div style={{ padding: "14px 24px", borderTop: "1px solid var(--color-line)", background: "var(--color-bg-raised)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <button onClick={onPrev} disabled={isFirst} style={{ padding: "9px 22px", borderRadius: 8, border: "1px solid var(--color-line)", background: "transparent", color: isFirst ? "var(--color-ink-4)" : "var(--color-ink-2)", cursor: isFirst ? "default" : "pointer", fontSize: 13, fontFamily: "inherit", opacity: isFirst ? 0.4 : 1 }}>← Previous</button>
        <button onClick={() => onMarkComplete(section.id)} style={{ padding: "9px 22px", borderRadius: 8, border: `1px solid ${isDone ? "var(--color-moss)" : colorTag}`, background: isDone ? "rgba(74,107,58,0.08)" : "transparent", color: isDone ? "var(--color-moss)" : colorTag, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
          {isDone ? "✓ Completed" : "Mark complete"}
        </button>
        <button onClick={onNext} disabled={isLast} style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: isLast ? "var(--color-bg-sunk)" : colorTag, color: isLast ? "var(--color-ink-4)" : "white", cursor: isLast ? "default" : "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", opacity: isLast ? 0.4 : 1 }}>Next →</button>
      </div>
    </div>
  );
}
