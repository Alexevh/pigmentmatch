import { useSyncExternalStore } from "react";

// Global toggle: should recipes use the calibrated mixing model?
// Off by default — the app behaves exactly like the uncalibrated "Classic"
// engine unless the painter turns this on.

const KEY = "pigment-match.useCalibrated.v1";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

let value = read();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setCalibratedEngine(next: boolean) {
  value = next;
  try {
    localStorage.setItem(KEY, String(next));
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function useCalibratedEngine(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => value,
    () => value
  );
}
