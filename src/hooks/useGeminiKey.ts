import { useSyncExternalStore } from "react";

// The user's own Google AI Studio (Gemini) API key, shared across the app
// (Settings tab + IMG Lab cloud AI). Stored only in this browser.

const KEY = "pigmentmatch.geminiKey";

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

let value = read();
const listeners = new Set<() => void>();

export function setGeminiKey(next: string) {
  value = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function useGeminiKey(): string {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => value,
    () => value
  );
}
