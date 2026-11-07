"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ReadAloudPlayer, splitSpeech, type SpeechPart, type PlayerState } from "@/lib/read-aloud-player";

export function useReadAloud() {
  const player = useRef<ReadAloudPlayer | null>(null);
  const [state, setState] = useState<PlayerState>({ speaking: false, paused: false, loading: false, error: null, notice: null });
  const [voice, setVoice] = useState("buddy");
  const [rate, setRate] = useState(1);
  const [voices, setVoices] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    let active = true;
    const instance = new ReadAloudPlayer(new Audio(), setState);
    player.current = instance;
    fetch("/api/tts-prefs").then((r) => r.ok ? r.json() : null).then((d) => {
      if (!active || !d) return;
      setVoice(d.tts_voice ?? "buddy");
      if (typeof d.tts_speed === "number") setRate(d.tts_speed);
      setVoices(d.voices ?? []);
    }).catch(() => {});
    return () => { active = false; instance.dispose(); player.current = null; };
  }, []);
  useEffect(() => { player.current?.setRate(rate); }, [rate]);
  const speakParts = useCallback((parts: SpeechPart[], onPart?: (index: number) => void, onEnd?: () => void) => {
    player.current?.speak(parts.flatMap((p) => splitSpeech(p.text).map((text) => ({ text, index: p.index }))), voice, onPart, onEnd);
  }, [voice]);
  const speak = useCallback((text: string, onEnd?: () => void) => speakParts([{ text, index: 0 }], undefined, onEnd), [speakParts]);
  const stop = useCallback(() => player.current?.stop(), []);
  return { ...state, voice, setVoice, voices, rate, setRate, speak, speakParts, stop,
    pause: () => player.current?.pause(), resume: () => player.current?.resume() };
}
