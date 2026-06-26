import { useSyncExternalStore } from "react";

// Optional recipe controls (opt-in; defaults keep the original behavior):
//  - maxColors: cap the number of pigments in a recipe (null = no cap).
//  - valuePriority: when simplifying, protect value (L*) over hue/chroma.

// --- max colors ---
const MAX_KEY = "pigment-match.maxColors.v1";

function readMax(): number | null {
  try {
    const raw = localStorage.getItem(MAX_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    return n >= 1 && n <= 8 ? n : null;
  } catch {
    return null;
  }
}

let maxValue: number | null = readMax();
const maxListeners = new Set<() => void>();

export function setMaxColors(next: number | null) {
  maxValue = next;
  try {
    if (next == null) localStorage.removeItem(MAX_KEY);
    else localStorage.setItem(MAX_KEY, String(next));
  } catch {
    // ignore
  }
  maxListeners.forEach((l) => l());
}

export function useMaxColors(): number | null {
  return useSyncExternalStore(
    (cb) => {
      maxListeners.add(cb);
      return () => maxListeners.delete(cb);
    },
    () => maxValue,
    () => maxValue
  );
}

// --- value priority ---
const VP_KEY = "pigment-match.valuePriority.v1";

function readVp(): boolean {
  try {
    return localStorage.getItem(VP_KEY) === "1";
  } catch {
    return false;
  }
}

let vpValue: boolean = readVp();
const vpListeners = new Set<() => void>();

export function setValuePriority(next: boolean) {
  vpValue = next;
  try {
    localStorage.setItem(VP_KEY, next ? "1" : "0");
  } catch {
    // ignore
  }
  vpListeners.forEach((l) => l());
}

export function useValuePriority(): boolean {
  return useSyncExternalStore(
    (cb) => {
      vpListeners.add(cb);
      return () => vpListeners.delete(cb);
    },
    () => vpValue,
    () => vpValue
  );
}
