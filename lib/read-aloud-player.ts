/** Shared, cancellable cloud narration. Text is split, never rewritten. */
export function splitSpeech(text: string, max = 600): string[] {
  const parts: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const boundary = rest.lastIndexOf(" ", max - 1);
    const end = boundary > 0 ? boundary + 1 : max;
    parts.push(rest.slice(0, end));
    rest = rest.slice(end);
  }
  if (rest) parts.push(rest);
  return parts;
}

export interface SpeechPart { text: string; index: number }
export interface PlayerState { speaking: boolean; paused: boolean; loading: boolean; error: string | null; notice: string | null }
const IDLE: PlayerState = { speaking: false, paused: false, loading: false, error: null, notice: null };
const SILENCE = "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQIAAACAgA==";

export class ReadAloudPlayer {
  private generation = 0;
  private controller: AbortController | null = null;
  private url: string | null = null;
  private state = { ...IDLE };
  private rate = 1;
  private resumePending: (() => void) | null = null;
  private disposed = false;
  private utterance: SpeechSynthesisUtterance | null = null;

  constructor(
    private audio: HTMLAudioElement,
    private onState: (state: PlayerState) => void,
    private request: typeof fetch = (...args) => fetch(...args),
    private speech: SpeechSynthesis | undefined = typeof window === "undefined" ? undefined : window.speechSynthesis,
    private makeUtterance: (text: string) => SpeechSynthesisUtterance = (text) => new SpeechSynthesisUtterance(text),
  ) {}

  private update(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch };
    if (!this.disposed) this.onState(this.state);
  }

  setRate(rate: number) {
    this.rate = Math.max(0.5, Math.min(2, rate));
    this.audio.playbackRate = this.rate;
    if (this.utterance) this.utterance.rate = this.rate;
  }

  /** Call in the tap handler, before awaiting network audio (needed by Safari). */
  speak(parts: SpeechPart[], voice: string, onPart?: (index: number) => void, onEnd?: () => void) {
    this.stop();
    if (!parts.length || this.disposed) return;
    const gen = this.generation;
    this.controller = new AbortController();
    const signal = this.controller.signal;
    this.audio.src = SILENCE;
    void this.audio.play().catch(() => {});
    if (this.speech) {
      // Unlock the offline fallback while the original tap is still active.
      const prime = this.makeUtterance(" ");
      prime.volume = 0;
      this.speech.speak(prime);
    }
    this.update({ speaking: true, loading: true });
    let deviceOnly = false;
    // Attach rejection handling immediately, including to speculative requests.
    const load = async (part: SpeechPart) => {
      try {
        const res = await this.request("/api/tts", {
          method: "POST", headers: { "Content-Type": "application/json" }, signal,
          body: JSON.stringify({ text: part.text, voice }),
        });
        if (!res.ok) throw new Error(res.status === 401 ? "Sign in again to listen." : "The voice is unavailable. Please try again.");
        return { blob: await res.blob(), error: null };
      } catch (error) { return { blob: null, error }; }
    };
    let next = load(parts[0]);
    const finishPart = (position: number) => {
      if (gen !== this.generation) return;
      if (position + 1 < parts.length) {
        this.update({ loading: true });
        void play(position + 1);
      } else { this.stop(); onEnd?.(); }
    };
    const deviceSpeak = (position: number) => {
      if (!this.speech || gen !== this.generation) return;
      const utterance = this.makeUtterance(parts[position].text);
      this.utterance = utterance;
      utterance.rate = this.rate;
      utterance.voice = this.speech.getVoices().find((v) => v.lang === "en-US") ?? null;
      utterance.onend = () => finishPart(position);
      utterance.onerror = () => {
        if (gen !== this.generation) return;
        this.stop(); this.update({ error: "Audio was interrupted. Tap Read aloud to try again." });
      };
      this.update({ loading: false, notice: "Using the device voice while MAI voice is unavailable." });
      onPart?.(parts[position].index);
      const start = () => { if (gen === this.generation) this.speech?.speak(utterance); };
      if (this.state.paused) this.resumePending = start;
      else start();
    };
    const play = async (position: number): Promise<void> => {
      if (deviceOnly) { deviceSpeak(position); return; }
      const result = await next;
      if (gen !== this.generation) return;
      if (!result.blob) {
        if (this.speech) { deviceOnly = true; deviceSpeak(position); return; }
        this.stop();
        this.update({ error: result.error instanceof Error ? result.error.message : "Unable to play audio. Please try again." });
        return;
      }
      if (position + 1 < parts.length) next = load(parts[position + 1]);
      if (this.url) URL.revokeObjectURL(this.url);
      this.url = URL.createObjectURL(result.blob);
      this.audio.src = this.url;
      this.audio.playbackRate = this.rate;
      this.update({ loading: false });
      onPart?.(parts[position].index);
      const start = () => {
        if (gen !== this.generation) return;
        void this.audio.play().catch(() => {
          if (gen !== this.generation) return;
          this.stop();
          this.update({ error: "Audio could not start. Tap Read aloud to try again." });
        });
      };
      this.audio.onended = () => {
        finishPart(position);
      };
      this.audio.onerror = () => {
        if (gen !== this.generation) return;
        this.stop();
        this.update({ error: "Audio was interrupted. Tap Read aloud to try again." });
      };
      if (this.state.paused) this.resumePending = start;
      else start();
    };
    void play(0);
  }

  pause() {
    if (!this.state.speaking) return;
    this.audio.pause();
    if (this.utterance) this.speech?.pause();
    this.update({ paused: true });
  }

  resume() {
    if (!this.state.speaking) return;
    this.update({ paused: false });
    if (this.utterance && !this.resumePending) { this.speech?.resume(); return; }
    if (this.resumePending) {
      const start = this.resumePending;
      this.resumePending = null;
      start();
    } else if (!this.state.loading) {
      const gen = this.generation;
      void this.audio.play().catch(() => {
        if (gen !== this.generation) return;
        this.stop();
        this.update({ error: "Audio could not resume. Tap Read aloud to try again." });
      });
    }
  }

  stop() {
    this.generation++;
    this.controller?.abort();
    this.controller = null;
    this.resumePending = null;
    if (this.utterance) {
      this.utterance.onend = null;
      this.utterance.onerror = null;
      this.speech?.cancel();
      this.utterance = null;
    }
    this.audio.onended = null;
    this.audio.onerror = null;
    this.audio.pause();
    this.audio.removeAttribute("src");
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    this.update(IDLE);
  }

  dispose() { this.stop(); this.disposed = true; }
}
