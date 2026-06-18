// localStorage persistence for palettes. The app is fully local — no backend.

import { makeDefaultPalette, type Palette } from "./pigments";
import type { Calibration, Observation } from "./calibration";

const KEY = "pigment-match.palettes.v1";
const ACTIVE_KEY = "pigment-match.activePalette.v1";
const OBS_KEY = (pid: string) => `pigment-match.cal.obs.${pid}`;
const FIT_KEY = (pid: string) => `pigment-match.cal.fit.${pid}`;

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

// --- Calibration (per palette) ---

export function loadObservations(paletteId: string): Observation[] {
  try {
    const raw = localStorage.getItem(OBS_KEY(paletteId));
    const parsed = raw ? (JSON.parse(raw) as Observation[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveObservations(
  paletteId: string,
  observations: Observation[]
): void {
  try {
    localStorage.setItem(OBS_KEY(paletteId), JSON.stringify(observations));
  } catch {
    // ignore
  }
}

export function loadCalibration(paletteId: string): Calibration | null {
  try {
    const raw = localStorage.getItem(FIT_KEY(paletteId));
    return raw ? (JSON.parse(raw) as Calibration) : null;
  } catch {
    return null;
  }
}

export function saveCalibration(
  paletteId: string,
  cal: Calibration | null
): void {
  try {
    if (cal) localStorage.setItem(FIT_KEY(paletteId), JSON.stringify(cal));
    else localStorage.removeItem(FIT_KEY(paletteId));
  } catch {
    // ignore
  }
}
