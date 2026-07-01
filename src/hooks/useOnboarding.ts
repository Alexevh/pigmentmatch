import { useSyncExternalStore } from "react";

// First-run onboarding: shown once (persisted), re-openable from Help.
const KEY = "pigmentmatch.onboarded.v1";

function readSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

// Open by default until the user has been onboarded once.
let open = !readSeen();
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

export function openOnboarding() {
  open = true;
  emit();
}

// Close it and remember (so it won't auto-show again).
export function closeOnboarding() {
  open = false;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // ignore
  }
  emit();
}

export function useOnboardingOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => open,
    () => open
  );
}
