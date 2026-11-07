"use client";

import { useEffect, useState } from "react";
import WorkoutShareCard from "@/components/WorkoutShareCard";
import { parseWorkoutShare, workoutShareUrl, facebookShareUrl, type WorkoutShareSummary } from "@/lib/workout-sharing";

export default function ShareWorkout({ summary }: { summary: WorkoutShareSummary }) {
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState("Showing up for myself and my community. Who’s moving today?");
  const [includeVolume, setIncludeVolume] = useState(true);
  const [origin, setOrigin] = useState("");
  const [nativeShare, setNativeShare] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => { setOrigin(window.location.origin); setNativeShare(typeof navigator.share === "function"); }, []);
  const { volume, ...base } = summary;
  const shared = { ...base, ...(includeVolume ? { volume } : {}), caption };
  const safeSummary = parseWorkoutShare(JSON.stringify(shared));
  const url = origin && safeSummary ? workoutShareUrl(safeSummary, origin) : "";
  async function copy() {
    try { await navigator.clipboard.writeText(url); setStatus("Summary link copied."); }
    catch { setStatus("Copy the summary link shown below."); }
  }
  async function share() {
    try { await navigator.share({ title: shared.title, url }); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("Sharing could not open. Use Facebook or copy the link below."); }
  }
  return <section style={{ marginBottom: 20 }}>
    <button type="button" className="ios-btn ios-btn--full" style={{ background: "var(--ios-fill)", color: "var(--ios-tint)" }} aria-expanded={open} onClick={() => setOpen(!open)}>Share workout on Facebook</button>
    {open && <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
      <h2 className="ios-title-3" style={{ margin: 0 }}>Preview your workout post</h2>
      <WorkoutShareCard summary={shared} />
      <label className="ios-body">Add a message
        <textarea value={caption} maxLength={220} onChange={(e) => setCaption(e.target.value)} rows={3} style={{ display: "block", width: "100%", marginTop: 6, padding: 12, borderRadius: 10, background: "var(--ios-fill)", color: "var(--ios-label)", border: "1px solid var(--ios-separator)", font: "inherit" }} />
      </label>
      <label className="ios-body"><input type="checkbox" checked={includeVolume} onChange={(e) => setIncludeVolume(e.target.checked)} /> Include total lifting volume</label>
      <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: 0 }}>Only this card is shared. It has no account details, body measurements, or private workout link. You choose your audience and confirm the post in Facebook.</p>
      {url && <a className="ios-btn ios-btn--primary" style={{ textAlign: "center", textDecoration: "none" }} href={facebookShareUrl(url)} target="_blank" rel="noopener noreferrer">Continue to Facebook</a>}
      <button type="button" className="ios-btn" onClick={copy} disabled={!url}>Copy summary link</button>
      {nativeShare && <button type="button" className="ios-btn" onClick={share}>More sharing options</button>}
      <input aria-label="Workout summary link" readOnly value={url} style={{ width: "100%", padding: 10, fontSize: 12, background: "var(--ios-fill)", color: "var(--ios-label)", borderRadius: 8 }} />
      <p role="status" className="ios-footnote">{status}</p>
      {!safeSummary && <p role="alert" className="ios-footnote">This workout summary is not ready to share.</p>}
    </div>}
  </section>;
}
