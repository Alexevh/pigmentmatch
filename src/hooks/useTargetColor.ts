import { useSyncExternalStore } from "react";
import { hexToRgb, rgbToHex, type RGB } from "@/lib/color";

// The app-wide target color (Match/Image/Coach), persisted so it survives a
// reload — and, because the key carries the synced "pigment-match." prefix,
// it rides the optional cloud snapshot: pick a color on the PC, open the
// phone at the easel, and the target is there (same pull-on-open semantics as
// every other synced setting).

const KEY = "pigment-match.targetColor.v1";
const DEFAULT: RGB = { r: 146, g: 112, b: 115 }; // #927073

function read(): RGB {
  try {
    return hexToRgb(localStorage.getItem(KEY) || "") ?? DEFAULT;
  } catch {
    return DEFAULT;
  }
}

let value: RGB = read();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setTargetColor(rgb: RGB) {
  value = rgb;
  try {
    localStorage.setItem(KEY, rgbToHex(rgb));
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function useTargetColor(): RGB {
  return useSyncExternalStore(
    subscribe,
    () => value,
    () => value
  );
}
