import { useSyncExternalStore } from "react";

// How the quantified-coach addition is expressed. "parts" is a unit-free ratio
// (a painter thinks "1 part per 9 of the puddle", not ml/g); ml/g/drops scale
// the puddle the painter enters in that same unit (no density guesswork — we
// never convert between mass and volume).
export type CoachUnit = "parts" | "ml" | "g" | "drops";

const KEY = "pigment-match.coachUnit.v1";
const UNITS: CoachUnit[] = ["parts", "ml", "g", "drops"];

function read(): CoachUnit {
  try {
    const v = localStorage.getItem(KEY) as CoachUnit | null;
    return v && UNITS.includes(v) ? v : "parts";
  } catch {
    return "parts";
  }
}

let value: CoachUnit = read();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setCoachUnit(next: CoachUnit) {
  value = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function useCoachUnit(): CoachUnit {
  return useSyncExternalStore(
    subscribe,
    () => value,
    () => value
  );
}

export const COACH_UNITS = UNITS;
