import { useSyncExternalStore } from "react";

// How recipe amounts are displayed: integer "parts" or percentages.
export type RecipeUnit = "parts" | "percent";

const KEY = "pigment-match.recipeUnit.v1";

function read(): RecipeUnit {
  try {
    return localStorage.getItem(KEY) === "percent" ? "percent" : "parts";
  } catch {
    return "parts";
  }
}

// Tiny external store so every RecipeView reacts when the unit changes,
// no matter where the toggle lives.
let value: RecipeUnit = read();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setRecipeUnit(next: RecipeUnit) {
  value = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function useRecipeUnit(): RecipeUnit {
  return useSyncExternalStore(
    subscribe,
    () => value,
    () => value
  );
}
