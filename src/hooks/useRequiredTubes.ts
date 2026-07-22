import { useSyncExternalStore } from "react";

// Must-use tubes for the main recipe (pigment ids the painter wants forced
// into the mix — "this skin starts from Pale Rose Blush + Raw Umber").
// Persisted like the other recipe options; ids that don't exist in the active
// palette are simply ignored by the consumer, so switching palettes is safe.

const KEY = "pigment-match.requiredTubes.v1";

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

let value: string[] = read();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function write(next: string[]) {
  value = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function addRequiredTube(id: string) {
  if (!value.includes(id)) write([...value, id]);
}

export function removeRequiredTube(id: string) {
  write(value.filter((x) => x !== id));
}

export function useRequiredTubes(): string[] {
  return useSyncExternalStore(
    subscribe,
    () => value,
    () => value
  );
}
