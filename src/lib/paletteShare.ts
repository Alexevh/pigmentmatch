// Share a palette as a self-contained link (and QR): the palette is encoded
// into the URL hash (#pal=...), so no backend / storage is needed. The receiver
// opens the link and the app offers to import it.

import { newId, type Palette, type Pigment, type Temperature } from "@/lib/pigments";

// Compact wire shape (short keys) to keep the URL small.
interface WirePigment {
  n: string; // name
  c: [number, number, number]; // rgb
  u?: [number, number, number]; // undertone
  o: number; // opacity
  t: Temperature;
  s: number; // strength
  d?: 1; // disabled (enabled === false)
}
interface WirePalette {
  n: string;
  p: WirePigment[];
}

function b64urlEncode(s: string): string {
  const b64 = btoa(unescape(encodeURIComponent(s)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(escape(atob(b64)));
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function encodePalette(palette: Palette): string {
  const wire: WirePalette = {
    n: palette.name,
    p: palette.pigments.map((pg) => ({
      n: pg.name,
      c: [pg.rgb.r, pg.rgb.g, pg.rgb.b],
      ...(pg.undertone
        ? { u: [pg.undertone.r, pg.undertone.g, pg.undertone.b] as [number, number, number] }
        : {}),
      o: pg.opacity,
      t: pg.temperature,
      s: pg.strength,
      ...(pg.enabled === false ? { d: 1 as const } : {}),
    })),
  };
  return b64urlEncode(JSON.stringify(wire));
}

export function decodePalette(encoded: string): Palette | null {
  try {
    const wire = JSON.parse(b64urlDecode(encoded)) as WirePalette;
    if (!wire || !Array.isArray(wire.p)) return null;
    const pigments: Pigment[] = [];
    for (const w of wire.p) {
      if (!Array.isArray(w.c)) continue;
      const t = w.t;
      pigments.push({
        id: newId(),
        name: typeof w.n === "string" ? w.n : "Pigment",
        rgb: { r: clamp255(w.c[0]), g: clamp255(w.c[1]), b: clamp255(w.c[2]) },
        undertone: Array.isArray(w.u)
          ? { r: clamp255(w.u[0]), g: clamp255(w.u[1]), b: clamp255(w.u[2]) }
          : undefined,
        opacity: clamp01(typeof w.o === "number" ? w.o : 0.8),
        temperature:
          t === "warm" || t === "cool" || t === "neutral" ? t : "neutral",
        strength: clamp01(typeof w.s === "number" ? w.s : 0.7),
        enabled: w.d === 1 ? false : undefined,
      });
    }
    if (!pigments.length) return null;
    return {
      id: newId("pal"),
      name: typeof wire.n === "string" ? wire.n : "Shared palette",
      pigments,
    };
  } catch {
    return null;
  }
}

// Full shareable URL (uses the hash so it works on static hosts / Pages subpaths).
export function paletteShareUrl(palette: Palette): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#pal=${encodePalette(palette)}`;
}

// If the current URL carries a shared palette, decode it (and return the raw
// encoded string so the caller can clear it). Otherwise null.
export function readSharedPalette(): { palette: Palette } | null {
  const m = location.hash.match(/[#&]pal=([^&]+)/);
  if (!m) return null;
  const palette = decodePalette(m[1]);
  return palette ? { palette } : null;
}

export function clearSharedPaletteHash(): void {
  try {
    history.replaceState(null, "", location.pathname + location.search);
  } catch {
    location.hash = "";
  }
}
