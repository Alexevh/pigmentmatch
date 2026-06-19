import { useSyncExternalStore } from "react";
import type { MixEngine } from "@/lib/mixer";

// Which mixing model recipes use: "classic" (fast single-constant K-M per RGB
// channel) or "spectral" (spectral.js — full reflectance-curve Kubelka-Munk).
// Classic is the default; spectral is opt-in and experimental.

const KEY = "pigment-match.mixEngine.v1";

function read(): MixEngine {
  try {
    return localStorage.getItem(KEY) === "spectral" ? "spectral" : "classic";
  } catch {
    return "classic";
  }
}

let value: MixEngine = read();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setMixEngine(next: MixEngine) {
  value = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function useMixEngine(): MixEngine {
  return useSyncExternalStore(
    subscribe,
    () => value,
    () => value
  );
}
