// localStorage persistence for palettes. The app is fully local — no backend.

import { makeDefaultPalette, type Palette } from "./pigments";

const KEY = "pigment-match.palettes.v1";
const ACTIVE_KEY = "pigment-match.activePalette.v1";

export function loadPalettes(): Palette[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [makeDefaultPalette()];
    const parsed = JSON.parse(raw) as Palette[];
    if (!Array.isArray(parsed) || parsed.length === 0)
      return [makeDefaultPalette()];
    return parsed;
  } catch {
    return [makeDefaultPalette()];
  }
}

export function savePalettes(palettes: Palette[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(palettes));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export function loadActiveId(fallback: string): string {
  try {
    return localStorage.getItem(ACTIVE_KEY) || fallback;
  } catch {
    return fallback;
  }
}

export function saveActiveId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // ignore
  }
}
