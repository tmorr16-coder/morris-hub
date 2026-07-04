"use client";

import { useState, useEffect, useCallback } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Keep localStorage bounded — a conversation this long is already past useful
// context, and we don't want to blow the ~5MB quota.
const MAX_STORED = 60;

/**
 * A chat message list that persists to localStorage under `storageKey`, so the
 * conversation carries across screen navigations and reloads instead of resetting
 * every time the component remounts. Returns the same shape as useState plus a
 * `clear()` to start a fresh thread.
 */
export function useChatHistory(storageKey: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Don't persist until we've loaded, or the initial empty array would clobber
  // a saved conversation before hydration runs.
  const [hydrated, setHydrated] = useState(false);

  // localStorage is unavailable during SSR, so the saved thread must be loaded
  // in an effect after mount (not a lazy initializer).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setMessages(
            parsed.filter(
              (m): m is ChatMessage =>
                m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
            )
          );
        }
      }
    } catch {
      /* corrupt or unavailable storage — start fresh */
    }
    setHydrated(true);
  }, [storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    try {
      const trimmed = messages.length > MAX_STORED ? messages.slice(-MAX_STORED) : messages;
      localStorage.setItem(storageKey, JSON.stringify(trimmed));
    } catch {
      /* quota or unavailable — non-fatal */
    }
  }, [messages, hydrated, storageKey]);

  const clear = useCallback(() => {
    setMessages([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  return { messages, setMessages, clear, hydrated };
}
