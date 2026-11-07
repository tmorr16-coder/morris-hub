"use client";

import { useState } from "react";
import { useReadAloud } from "@/hooks/useReadAloud";

export function VoiceControls({ audio }: { audio: ReturnType<typeof useReadAloud> }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label className="ios-body">
        Voice
        <select value={audio.voice} onChange={(e) => { audio.stop(); audio.setVoice(e.target.value); }} className="ios-input" style={{ width: "100%", marginTop: 6 }}>
          <option value="buddy">MAI voice · recommended</option>
          {audio.voices.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </label>
      <label className="ios-body" style={{ display: "grid", gap: 6 }}>
        Speed · {audio.rate.toFixed(2)}×
        <input type="range" min="0.5" max="2" step="0.05" value={audio.rate} onChange={(e) => audio.setRate(Number(e.target.value))} />
      </label>
      <button type="button" className="ios-btn" onClick={() => audio.speaking ? audio.stop() : audio.speak("The Lord is my shepherd; I shall not want.")}>
        {audio.loading ? "Preparing voice… Tap to stop" : audio.speaking ? "Stop preview" : "Preview voice"}
      </button>
      <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: 0 }}>MAI voice uses a calm, natural reading style. Audio is AI generated.</p>
      {audio.error && <p role="alert" className="ios-footnote">{audio.error}</p>}
      {audio.notice && <p role="status" className="ios-footnote">{audio.notice}</p>}
    </div>
  );
}

export default function ReadAloudSettings() {
  const audio = useReadAloud();
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true); setStatus("");
    try {
      const r = await fetch("/api/tts-prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tts_voice: audio.voice, tts_speed: audio.rate }) });
      setStatus(r.ok ? "Voice and speed saved." : "Could not save. Please try again.");
    } catch { setStatus("Could not save. Check your connection and try again."); }
    finally { setSaving(false); }
  }
  return <section style={{ padding: 16 }}>
    <VoiceControls audio={audio} />
    <button onClick={save} disabled={saving} className="ios-btn ios-btn--primary" style={{ marginTop: 16 }}>{saving ? "Saving…" : "Save voice and speed"}</button>
    <p role="status" className="ios-footnote">{status}</p>
  </section>;
}
