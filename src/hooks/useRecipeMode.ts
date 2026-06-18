import { useSyncExternalStore } from "react";
import type { RecipeMode } from "@/lib/mixer";

// Whether recipes favor few pigments ("simple") or the lowest possible ΔE
// ("precise"). Simple is the default — it's what a painter usually wants.

const KEY = "pigment-match.recipeMode.v1";

function read(): RecipeMode {
  try {
    return localStorage.getItem(KEY) === "precise" ? "precise" : "simple";
  } catch {
    return "simple";
  }
}

let value: RecipeMode = read();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setRecipeMode(next: RecipeMode) {
  value = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function useRecipeMode(): RecipeMode {
  return useSyncExternalStore(
    subscribe,
    () => value,
    () => value
  );
}

export type { RecipeMode };
