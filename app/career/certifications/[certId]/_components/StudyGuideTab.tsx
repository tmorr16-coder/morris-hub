"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { IconBadge, Icons } from "@/components/ios";
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

// ── Small inline icons (stroke = currentColor) ──────────────────────────────────
function CheckGlyph({ size = 12, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12l5 5L20 6" />
    </svg>
  );
}
function ChevronGlyph({ open }: { open: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function ExpandGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}
function SpeakerGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4zM17 8a4 4 0 010 8M19.5 5.5a8 8 0 010 13" />
    </svg>
  );
}
function PlayGlyph() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 5l12 7-12 7z" /></svg>;
}
function PauseGlyph() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>;
}
function StopGlyph() {
  return <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="5" y="5" width="14" height="14" rx="2" /></svg>;
}
function XGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 10,
  border: "var(--ios-hair) solid var(--ios-separator)",
  background: "var(--ios-cell)", color: "var(--ios-label)",
  fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box", colorScheme: "light dark",
};

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
        <IconBadge color={colorTag}><Icons.BookIcon /></IconBadge>
        <h3 className="ios-title-2" style={{ margin: "16px 0 8px" }}>Study guide</h3>
        <p className="ios-subhead" style={{ color: "var(--ios-label-2)", lineHeight: 1.6, maxWidth: 420, marginBottom: 28 }}>
          Claude will generate a complete study guide for {examName}{examCode ? ` (${examCode})` : ""} — organized by domain with key concepts, explanations, and audio playback.
        </p>
        {error && <p className="ios-footnote" style={{ color: "var(--ios-red)", marginBottom: 16, maxWidth: 420 }}>{error}</p>}
        <button onClick={() => generate()} disabled={loading} className="ios-btn ios-btn--primary" style={{ maxWidth: 320, opacity: loading ? 0.6 : 1 }}>
          {loading ? `Generating guide${domains.length > 1 ? ` (${domains.length} domains)` : ""}…` : "Generate study guide"}
        </button>
        {loading && <p className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 12 }}>This takes 20–40 seconds. Each domain gets a full section.</p>}
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
          <div className="ios-caption" style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            <span>Progress</span><span style={{ color: pct === 100 ? "var(--ios-green)" : "var(--ios-label-2)" }}>{pct}%</span>
          </div>
          <div style={{ height: 4, background: "var(--ios-fill)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "var(--ios-green)" : colorTag, borderRadius: 4, transition: "width 400ms ease" }} />
          </div>
        </div>

        {sections.map((s, i) => {
          const isActive = s.id === activeSectionId;
          const isDone   = completed.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => { setActiveSectionId(s.id); setShowSelfTestAnswer(false); audio.stop(); }}
              style={{ display: "flex", alignItems: "flex-start", gap: 8, width: "100%", padding: "10px 12px", borderRadius: 10, textAlign: "left", border: `1px solid ${isActive ? colorTag : "transparent"}`, background: isActive ? "var(--ios-fill)" : "transparent", cursor: "pointer", marginBottom: 4 }}
            >
              <span style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${isDone ? "var(--ios-green)" : isActive ? colorTag : "var(--ios-separator)"}`, background: isDone ? "var(--ios-green)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, color: "#fff" }}>
                {isDone ? <CheckGlyph size={10} color="#fff" /> : <span className="ios-num" style={{ color: isActive ? colorTag : "var(--ios-label-3)", fontWeight: 700, fontSize: 9 }}>{i + 1}</span>}
              </span>
              <div>
                <div className="ios-footnote" style={{ fontWeight: isActive ? 600 : 400, color: isActive ? colorTag : "var(--ios-label)", lineHeight: 1.3 }}>{s.domain_name}</div>
                <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 1 }}>{s.estimated_minutes} min</div>
              </div>
            </button>
          );
        })}

        <button onClick={openRegenModal} disabled={loading} className="ios-btn--plain" style={{ width: "100%", marginTop: 12, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Regenerating…" : "Regenerate"}
        </button>
      </div>

      {/* Regeneration scope sheet */}
      {showRegenModal && (
        <>
          <div className="ios-sheet-backdrop" onClick={() => setShowRegenModal(false)} aria-hidden="true" />
          <div className="ios-sheet" role="dialog" aria-modal="true" aria-label="Regenerate study guide">
            <div className="ios-grabber" />
            <h3 className="ios-headline" style={{ margin: "0 0 4px" }}>Regenerate study guide</h3>
            <p className="ios-footnote" style={{ margin: "0 0 18px", color: "var(--ios-label-2)", lineHeight: 1.5 }}>Choose what to regenerate. Saved content will be replaced for the selected sections.</p>

            {/* Scope options */}
            {[
              { value: "current" as RegenerateScope, label: `Current section only`, sub: activeSection ? `"${activeSection.domain_name}"` : "active section" },
              { value: "all" as RegenerateScope, label: "Full guide", sub: `All ${sections.length || domains.length} domains` },
              { value: "select" as RegenerateScope, label: "Select specific domains", sub: "Choose below" },
            ].map((opt) => {
              const sel = regenScope === opt.value;
              return (
                <button key={opt.value} type="button" onClick={() => setRegenScope(opt.value)} style={{ display: "flex", gap: 12, alignItems: "flex-start", width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${sel ? colorTag : "var(--ios-separator)"}`, background: sel ? "var(--ios-fill)" : "var(--ios-cell)", cursor: "pointer", marginBottom: 8, textAlign: "left", fontFamily: "inherit" }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${sel ? colorTag : "var(--ios-separator)"}`, background: sel ? colorTag : "transparent", flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div className="ios-subhead" style={{ fontWeight: 600, color: "var(--ios-label)" }}>{opt.label}</div>
                    <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 2 }}>{opt.sub}</div>
                  </div>
                </button>
              );
            })}

            {/* Domain checkboxes for "select" scope */}
            {regenScope === "select" && domains.length > 0 && (
              <div style={{ border: "var(--ios-hair) solid var(--ios-separator)", borderRadius: 12, padding: "6px 14px", marginTop: 4, marginBottom: 4, maxHeight: 200, overflowY: "auto" }}>
                {domains.map((d) => (
                  <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer", borderBottom: "var(--ios-hair) solid var(--ios-separator)" }}>
                    <input type="checkbox" checked={regenDomainIds.includes(d.id)}
                      onChange={() => setRegenDomainIds((prev) => prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id])}
                      style={{ width: 16, height: 16, accentColor: colorTag }} />
                    <div>
                      <span className="ios-subhead" style={{ color: "var(--ios-label)" }}>{d.name}</span>
                      {d.weight_pct > 0 && <span className="ios-caption" style={{ color: "var(--ios-label-3)", marginLeft: 6 }}>{d.weight_pct}%</span>}
                      {sections.find((s) => s.id === d.id) && <span className="ios-caption" style={{ color: colorTag, marginLeft: 6, fontWeight: 600 }}>saved</span>}
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button type="button" onClick={() => setShowRegenModal(false)} className="ios-btn--plain" style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRegen}
                disabled={regenScope === "select" && regenDomainIds.length === 0}
                className="ios-btn ios-btn--primary"
                style={{ flex: 1, opacity: regenScope === "select" && regenDomainIds.length === 0 ? 0.5 : 1 }}
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
  const iconBtn: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 10px", borderRadius: 10, border: "var(--ios-hair) solid var(--ios-separator)", background: "var(--ios-cell)", color: "var(--ios-label)", cursor: "pointer" };
  return (
    <div>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
        <div>
          <div className="ios-caption" style={{ fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: colorTag, marginBottom: 4 }}>{section.domain_name}</div>
          <h2 className="ios-title-1" style={{ margin: 0, color: "var(--ios-label)", lineHeight: 1.2 }}>{section.title}</h2>
          <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 6 }}>~{section.estimated_minutes} min read</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={onFocusMode} title="Focus mode" aria-label="Focus mode" style={iconBtn}><ExpandGlyph /></button>
          <AudioControls audio={audio} onPlay={onPlay} colorTag={colorTag} />
        </div>
      </div>

      {/* Body paragraphs */}
      <div style={{ marginBottom: 28 }}>
        {section.paragraphs.map((p, i) => (
          <p key={i} className="ios-body" style={{ lineHeight: 1.8, color: "var(--ios-label)", marginBottom: 16 }}>{p}</p>
        ))}
      </div>

      {/* Key terms */}
      {section.key_terms.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="ios-group-header" style={{ padding: "0 0 12px" }}>Key terms</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {section.key_terms.map((t, i) => <KeyTermCard key={i} term={t} colorTag={colorTag} />)}
          </div>
        </div>
      )}

      {/* Takeaways */}
      {section.takeaways.length > 0 && (
        <div style={{ background: "var(--ios-fill)", borderRadius: 14, padding: "16px 20px", marginBottom: 28 }}>
          <div className="ios-group-header" style={{ padding: "0 0 12px", color: colorTag }}>Key takeaways</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {section.takeaways.map((t, i) => <li key={i} className="ios-footnote" style={{ color: "var(--ios-label)", lineHeight: 1.5 }}>{t}</li>)}
          </ul>
        </div>
      )}

      {/* Self-test */}
      {section.self_test.question && (
        <div style={{ background: "var(--ios-fill)", borderRadius: 14, padding: "16px 20px", marginBottom: 28 }}>
          <div className="ios-group-header" style={{ padding: "0 0 10px" }}>Test yourself</div>
          <p className="ios-callout" style={{ lineHeight: 1.6, color: "var(--ios-label)", marginBottom: 12 }}>{section.self_test.question}</p>
          <button type="button" onClick={onToggleAnswer} className="ios-footnote" style={{ color: colorTag, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600, fontFamily: "inherit" }}>
            {showAnswer ? "Hide answer" : "Reveal answer"}
          </button>
          {showAnswer && (
            <div style={{ marginTop: 12, padding: "12px 16px", background: "var(--ios-cell)", borderLeft: `3px solid ${colorTag}`, borderRadius: "0 8px 8px 0" }}>
              <span className="ios-footnote" style={{ color: "var(--ios-label)", lineHeight: 1.6 }}>{section.self_test.answer}</span>
            </div>
          )}
        </div>
      )}

      {/* Footer nav */}
      <FooterNav isFirst={isFirst} isLast={isLast} completed={completed} colorTag={colorTag} onPrev={onPrev} onNext={onNext} onMarkComplete={onMarkComplete} />
    </div>
  );
}

// ── Footer navigation (shared) ──────────────────────────────────────────────────
function FooterNav({ isFirst, isLast, completed, colorTag, onPrev, onNext, onMarkComplete }: { isFirst: boolean; isLast: boolean; completed: boolean; colorTag: string; onPrev: () => void; onNext: () => void; onMarkComplete: () => void }) {
  const navStyle = (disabled: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 4, padding: "9px 20px", borderRadius: 10,
    border: "var(--ios-hair) solid var(--ios-separator)", background: "var(--ios-cell)",
    color: disabled ? "var(--ios-label-3)" : "var(--ios-label)", fontSize: 15, fontWeight: 500,
    cursor: disabled ? "default" : "pointer", fontFamily: "inherit", opacity: disabled ? 0.5 : 1,
  });
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "var(--ios-hair) solid var(--ios-separator)" }}>
      <button type="button" onClick={onPrev} disabled={isFirst} style={navStyle(isFirst)}>
        <Icons.ChevronLeft style={{ width: 15, height: 15 }} /> Previous
      </button>
      <button type="button" onClick={onMarkComplete} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "9px 20px", borderRadius: 10, border: `1px solid ${completed ? "var(--ios-green)" : colorTag}`, background: "var(--ios-cell)", color: completed ? "var(--ios-green)" : colorTag, cursor: "pointer", fontSize: 15, fontWeight: 600, fontFamily: "inherit" }}>
        {completed ? <><CheckGlyph size={13} /> Completed</> : "Mark complete"}
      </button>
      <button type="button" onClick={onNext} disabled={isLast} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "9px 20px", borderRadius: 10, border: "none", background: isLast ? "var(--ios-fill)" : colorTag, color: isLast ? "var(--ios-label-3)" : "#fff", cursor: isLast ? "default" : "pointer", fontSize: 15, fontWeight: 600, fontFamily: "inherit", opacity: isLast ? 0.6 : 1 }}>
        Next <Icons.ChevronRight style={{ width: 15, height: 15 }} />
      </button>
    </div>
  );
}

// ── Key term card ──────────────────────────────────────────────────────────────
function KeyTermCard({ term, colorTag }: { term: KeyTerm; colorTag: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: "var(--ios-cell)", border: "var(--ios-hair) solid var(--ios-separator)", borderRadius: 12, overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "none", border: "none", cursor: "pointer", gap: 8 }}>
        <span className="ios-subhead" style={{ fontWeight: 600, color: "var(--ios-label)" }}>{term.term}</span>
        <span style={{ color: "var(--ios-label-3)", flexShrink: 0, display: "flex" }}><ChevronGlyph open={open} /></span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 12px" }}>
          <p className="ios-footnote" style={{ color: "var(--ios-label)", lineHeight: 1.55, margin: "0 0 8px 0" }}>{term.definition}</p>
          {term.exam_tip && (
            <div style={{ display: "flex", gap: 6, alignItems: "flex-start", background: "var(--ios-fill)", borderRadius: 8, padding: "8px 10px" }}>
              <span className="ios-caption" style={{ fontWeight: 700, color: colorTag, flexShrink: 0, marginTop: 1, letterSpacing: "0.04em" }}>EXAM TIP</span>
              <span className="ios-footnote" style={{ color: "var(--ios-label)", lineHeight: 1.5 }}>{term.exam_tip}</span>
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

  const tintBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, border: `1px solid ${colorTag}`, background: "var(--ios-fill)", color: colorTag, cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit" };
  const plainBtn: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 10px", borderRadius: 10, border: "var(--ios-hair) solid var(--ios-separator)", background: "var(--ios-cell)", color: "var(--ios-label-2)", cursor: "pointer" };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {audio.speaking ? (
          <>
            <button type="button" onClick={audio.paused ? audio.resume : audio.pause} aria-label={audio.paused ? "Resume" : "Pause"} style={tintBtn}>
              {audio.paused ? <PlayGlyph /> : <PauseGlyph />}
            </button>
            <button type="button" onClick={audio.stop} aria-label="Stop" style={plainBtn}><StopGlyph /></button>
          </>
        ) : (
          <button type="button" onClick={onPlay} title="Listen to this section" style={tintBtn}>
            <SpeakerGlyph /> Listen
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowOptions((v) => !v)}
          aria-label="Audio settings"
          style={{ ...plainBtn, border: `1px solid ${showOptions ? colorTag : "var(--ios-separator)"}`, background: showOptions ? "var(--ios-fill)" : "var(--ios-cell)", color: showOptions ? colorTag : "var(--ios-label-2)" }}
        >
          <Icons.GearIcon style={{ width: 15, height: 15 }} />
        </button>
      </div>

      {showOptions && (
        <>
          {/* Invisible full-screen backdrop so tapping outside closes it */}
          <div style={{ position: "fixed", inset: 0, zIndex: 39 }} onClick={() => setShowOptions(false)} />
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 8px)",
            background: "var(--ios-cell)",
            border: "var(--ios-hair) solid var(--ios-separator)",
            borderRadius: 14,
            padding: "16px 18px",
            zIndex: 40,
            minWidth: 240,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span className="ios-group-header" style={{ padding: 0 }}>Audio settings</span>
              <button type="button" onClick={() => setShowOptions(false)} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ios-label-3)", display: "flex", padding: 0 }}>
                <XGlyph size={15} />
              </button>
            </div>

            {/* Speed */}
            <div style={{ marginBottom: 14 }}>
              <div className="ios-footnote" style={{ fontWeight: 600, color: "var(--ios-label-2)", marginBottom: 8 }}>Speed</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[0.75, 1.0, 1.25, 1.5].map((r) => {
                  const sel = audio.rate === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => audio.setRate(r)}
                      className="ios-num"
                      style={{
                        flex: 1, padding: "7px 0", borderRadius: 8,
                        border: `1.5px solid ${sel ? colorTag : "var(--ios-separator)"}`,
                        background: sel ? colorTag : "var(--ios-fill)",
                        color: sel ? "#fff" : "var(--ios-label)",
                        fontSize: 12, fontWeight: sel ? 700 : 400,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {r}×
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Voice */}
            {audio.voices.length > 1 && (
              <div>
                <div className="ios-footnote" style={{ fontWeight: 600, color: "var(--ios-label-2)", marginBottom: 8 }}>Voice</div>
                <select
                  value={audio.voice?.name ?? ""}
                  onChange={(e) => audio.setVoice(audio.voices.find((v) => v.name === e.target.value) ?? null)}
                  style={{ ...inputStyle, cursor: "pointer" }}
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
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "var(--ios-bg)", display: "flex", flexDirection: "column" }}>
      {/* Focus header */}
      <div style={{ padding: "14px 24px", borderBottom: "var(--ios-hair) solid var(--ios-separator)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--ios-cell)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button type="button" onClick={onClose} className="ios-footnote" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--ios-label-2)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
            <XGlyph size={14} /> Exit focus
          </button>
          <span className="ios-caption ios-num" style={{ color: "var(--ios-label-3)" }}>{currentIdx + 1} / {sections.length}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AudioControls audio={audio} onPlay={() => audio.speak(sectionToSpeech(section))} colorTag={colorTag} />
          <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>Space=play · ← → navigate · Esc=exit</span>
        </div>
      </div>

      {/* Focus body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "40px max(32px, calc(50vw - 380px))" }}>
        <div className="ios-caption" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: colorTag, marginBottom: 8 }}>{section.domain_name}</div>
        <h1 className="ios-large-title" style={{ marginBottom: 24, color: "var(--ios-label)", lineHeight: 1.2 }}>{section.title}</h1>

        {section.paragraphs.map((p, i) => (
          <p key={i} style={{ fontSize: 16, lineHeight: 1.9, color: "var(--ios-label)", marginBottom: 20 }}>{p}</p>
        ))}

        {section.key_terms.length > 0 && (
          <div style={{ marginTop: 32, marginBottom: 32 }}>
            <div className="ios-group-header" style={{ padding: "0 0 16px" }}>Key terms</div>
            {section.key_terms.map((t, i) => (
              <div key={i} style={{ marginBottom: 14, paddingLeft: 16, borderLeft: `3px solid ${colorTag}` }}>
                <div className="ios-headline" style={{ color: "var(--ios-label)", marginBottom: 3 }}>{t.term}</div>
                <div className="ios-footnote" style={{ color: "var(--ios-label)", lineHeight: 1.5, marginBottom: t.exam_tip ? 4 : 0 }}>{t.definition}</div>
                {t.exam_tip && <div className="ios-caption" style={{ color: colorTag, fontWeight: 600 }}>EXAM TIP: {t.exam_tip}</div>}
              </div>
            ))}
          </div>
        )}

        {section.takeaways.length > 0 && (
          <div style={{ background: "var(--ios-fill)", borderRadius: 14, padding: "16px 20px", marginBottom: 28 }}>
            <div className="ios-group-header" style={{ padding: "0 0 10px", color: colorTag }}>Key takeaways</div>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              {section.takeaways.map((t, i) => <li key={i} className="ios-footnote" style={{ color: "var(--ios-label)", lineHeight: 1.5 }}>{t}</li>)}
            </ul>
          </div>
        )}

        {section.self_test.question && (
          <div style={{ background: "var(--ios-fill)", borderRadius: 14, padding: "18px 22px", marginBottom: 40 }}>
            <div className="ios-group-header" style={{ padding: "0 0 10px" }}>Test yourself</div>
            <p className="ios-callout" style={{ lineHeight: 1.7, color: "var(--ios-label)", marginBottom: 12 }}>{section.self_test.question}</p>
            <button type="button" onClick={onToggleAnswer} className="ios-footnote" style={{ color: colorTag, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600, fontFamily: "inherit" }}>
              {showAnswer ? "Hide answer" : "Reveal answer"}
            </button>
            {showAnswer && (
              <div style={{ marginTop: 12, padding: "14px 18px", background: "var(--ios-cell)", borderLeft: `3px solid ${colorTag}`, borderRadius: "0 8px 8px 0" }}>
                <span className="ios-footnote" style={{ color: "var(--ios-label)", lineHeight: 1.65 }}>{section.self_test.answer}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Focus footer */}
      <div style={{ padding: "14px 24px", borderTop: "var(--ios-hair) solid var(--ios-separator)", background: "var(--ios-cell)", flexShrink: 0 }}>
        <FooterNav isFirst={isFirst} isLast={isLast} completed={isDone} colorTag={colorTag} onPrev={onPrev} onNext={onNext} onMarkComplete={() => onMarkComplete(section.id)} />
      </div>
    </div>
  );
}
