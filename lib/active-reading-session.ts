// Track active Bible reading sessions across page navigation.
// Uses sessionStorage so the session survives navigation but is cleared on tab close.

export interface ActiveReadingSession {
  bookId: string;
  chapter: number;
  bibleId: string;
  label: string; // Book name + chapter for display
}

const SESSION_KEY = "bible-active-reading";

/** Get the currently active reading session, or null if none. */
export function getActiveReadingSession(): ActiveReadingSession | null {
  if (typeof window === "undefined") return null;
  try {
    const json = sessionStorage.getItem(SESSION_KEY);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

/** Set the active reading session when TTS starts. */
export function setActiveReadingSession(session: ActiveReadingSession): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage may not be available or full
  }
}

/** Clear the active reading session when TTS stops. */
export function clearActiveReadingSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
