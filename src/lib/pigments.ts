// Pigment data model and the default traditional oil palette.

import type { RGB } from "./color";

export type Temperature = "warm" | "cool" | "neutral";

export interface Pigment {
  id: string;
  name: string;
  rgb: RGB; // masstone RGB approximation
  opacity: number; // 0 (transparent) .. 1 (opaque)
  temperature: Temperature;
  strength: number; // tinting strength 0..1 (how strongly it influences a mix)
  // Available for mixing? Undefined means available (back-compat with saved
  // palettes). Set false to keep a pigment in the palette but exclude it from
  // recipe suggestions — e.g. a tube that ran out.
  enabled?: boolean;
}

// A pigment counts as available unless explicitly disabled.
export function isEnabled(p: Pigment): boolean {
  return p.enabled !== false;
}

export interface Palette {
  id: string;
  name: string;
  pigments: Pigment[];
}

// RGB approximations of common artist oil pigments (masstone, eyeballed for
// painterly behavior rather than spectral accuracy).
export const DEFAULT_PIGMENTS: Pigment[] = [
  {
    id: "titanium-white",
    name: "Titanium White",
    rgb: { r: 249, g: 249, b: 244 },
    opacity: 1,
    temperature: "cool",
    strength: 0.55,
  },
  {
    id: "raw-umber",
    name: "Raw Umber",
    rgb: { r: 89, g: 70, b: 48 },
    opacity: 0.7,
    temperature: "cool",
    strength: 0.75,
  },
  {
    id: "burnt-umber",
    name: "Burnt Umber",
    rgb: { r: 79, g: 49, b: 33 },
    opacity: 0.75,
    temperature: "warm",
    strength: 0.8,
  },
  {
    id: "cadmium-orange",
    name: "Cadmium Orange",
    rgb: { r: 226, g: 105, b: 30 },
    opacity: 0.9,
    temperature: "warm",
    strength: 0.85,
  },
  {
    id: "cadmium-red-light",
    name: "Cadmium Red Light",
    rgb: { r: 196, g: 44, b: 36 },
    opacity: 0.9,
    temperature: "warm",
    strength: 0.85,
  },
  {
    id: "alizarin-crimson",
    name: "Alizarin Crimson",
    rgb: { r: 120, g: 24, b: 36 },
    opacity: 0.4,
    temperature: "cool",
    strength: 0.9,
  },
  {
    id: "ultramarine-blue",
    name: "Ultramarine Blue",
    rgb: { r: 33, g: 38, b: 99 },
    opacity: 0.5,
    temperature: "warm",
    strength: 0.95,
  },
  {
    id: "yellow-ochre",
    name: "Yellow Ochre",
    rgb: { r: 196, g: 145, b: 56 },
    opacity: 0.8,
    temperature: "warm",
    strength: 0.7,
  },
];

export function makeDefaultPalette(): Palette {
  return {
    id: "default-oil",
    name: "Traditional Oil",
    // deep-clone so edits never mutate the shared default
    pigments: DEFAULT_PIGMENTS.map((p) => ({ ...p, rgb: { ...p.rgb } })),
  };
}

// Winsor & Newton Artists' Oil Colour — one painter's actual kit.
// Colour Index (CI) pigment shown for reference. RGB masstones, opacity and
// tinting strength are eyeballed starting points — calibrate them to your own
// tubes via the Calibrate tab for the best results.
export const WINSOR_NEWTON_PIGMENTS: Pigment[] = [
  // whites / blacks / earths
  { id: "wn-titanium-white", name: "Titanium White", rgb: { r: 249, g: 249, b: 244 }, opacity: 1, temperature: "cool", strength: 0.55 }, // PW6
  { id: "wn-ivory-black", name: "Ivory Black", rgb: { r: 38, g: 37, b: 34 }, opacity: 0.85, temperature: "warm", strength: 0.9 }, // PBk9
  { id: "wn-raw-umber", name: "Raw Umber", rgb: { r: 89, g: 70, b: 48 }, opacity: 0.7, temperature: "cool", strength: 0.75 }, // PBr7
  { id: "wn-burnt-umber", name: "Burnt Umber", rgb: { r: 79, g: 49, b: 33 }, opacity: 0.75, temperature: "warm", strength: 0.8 }, // PBr7
  { id: "wn-burnt-sienna", name: "Burnt Sienna", rgb: { r: 123, g: 58, b: 34 }, opacity: 0.55, temperature: "warm", strength: 0.75 }, // PBr7
  { id: "wn-yellow-ochre", name: "Yellow Ochre", rgb: { r: 196, g: 145, b: 56 }, opacity: 0.8, temperature: "warm", strength: 0.7 }, // PY43
  { id: "wn-terra-rosa", name: "Terra Rosa", rgb: { r: 150, g: 77, b: 62 }, opacity: 0.8, temperature: "warm", strength: 0.7 }, // PR101
  { id: "wn-venetian-red", name: "Venetian Red", rgb: { r: 126, g: 52, b: 42 }, opacity: 0.8, temperature: "warm", strength: 0.75 }, // PR101
  // yellows
  { id: "wn-naples-yellow", name: "Naples Yellow", rgb: { r: 243, g: 222, b: 150 }, opacity: 0.85, temperature: "warm", strength: 0.6 }, // hue
  { id: "wn-cadmium-yellow-hue", name: "Cadmium Yellow Hue", rgb: { r: 252, g: 205, b: 42 }, opacity: 0.8, temperature: "warm", strength: 0.7 }, // hue
  { id: "wn-lemon-yellow-hue", name: "Lemon Yellow Hue", rgb: { r: 243, g: 232, b: 76 }, opacity: 0.7, temperature: "cool", strength: 0.65 }, // hue
  { id: "wn-winsor-yellow", name: "Winsor Yellow", rgb: { r: 250, g: 206, b: 20 }, opacity: 0.7, temperature: "warm", strength: 0.8 }, // PY154
  { id: "wn-cadmium-yellow-deep-hue", name: "Cadmium Yellow Deep Hue", rgb: { r: 249, g: 170, b: 18 }, opacity: 0.8, temperature: "warm", strength: 0.75 }, // hue
  // reds / pinks / violets
  { id: "wn-cadmium-red", name: "Cadmium Red", rgb: { r: 196, g: 44, b: 36 }, opacity: 0.9, temperature: "warm", strength: 0.85 }, // PR108
  { id: "wn-cadmium-red-deep-hue", name: "Cadmium Red Deep Hue", rgb: { r: 161, g: 28, b: 42 }, opacity: 0.85, temperature: "warm", strength: 0.8 }, // hue
  { id: "wn-permanent-alizarin-crimson", name: "Permanent Alizarin Crimson", rgb: { r: 120, g: 24, b: 40 }, opacity: 0.45, temperature: "cool", strength: 0.85 }, // PR177
  { id: "wn-permanent-rose", name: "Permanent Rose", rgb: { r: 206, g: 42, b: 98 }, opacity: 0.6, temperature: "cool", strength: 0.85 }, // PV19
  { id: "wn-quinacridone-deep-pink", name: "Quinacridone Deep Pink", rgb: { r: 176, g: 22, b: 92 }, opacity: 0.55, temperature: "cool", strength: 0.9 }, // PV19
  { id: "wn-pale-rose-blush", name: "Pale Rose Blush", rgb: { r: 233, g: 178, b: 178 }, opacity: 0.85, temperature: "warm", strength: 0.4 }, // mix
  { id: "wn-cobalt-violet", name: "Cobalt Violet", rgb: { r: 123, g: 73, b: 140 }, opacity: 0.6, temperature: "cool", strength: 0.4 }, // PV14
  { id: "wn-dioxazine-blue", name: "Dioxazine Blue", rgb: { r: 54, g: 32, b: 84 }, opacity: 0.5, temperature: "cool", strength: 0.95 }, // PV23
  // blues / greens
  { id: "wn-french-ultramarine", name: "French Ultramarine", rgb: { r: 33, g: 38, b: 99 }, opacity: 0.5, temperature: "warm", strength: 0.95 }, // PB29
  { id: "wn-cerulean-blue", name: "Cerulean Blue", rgb: { r: 44, g: 117, b: 170 }, opacity: 0.85, temperature: "cool", strength: 0.6 }, // PB35
  { id: "wn-viridian-green", name: "Viridian Green", rgb: { r: 16, g: 98, b: 80 }, opacity: 0.55, temperature: "cool", strength: 0.6 }, // PG18
  { id: "wn-paynes-gray", name: "Payne's Gray", rgb: { r: 40, g: 52, b: 66 }, opacity: 0.7, temperature: "cool", strength: 0.85 }, // mix
];

export function makeWinsorNewtonPalette(): Palette {
  return {
    id: "wn-artists",
    name: "Winsor & Newton Artists'",
    pigments: WINSOR_NEWTON_PIGMENTS.map((p) => ({ ...p, rgb: { ...p.rgb } })),
  };
}

// Palettes a painter can spin up from a known kit.
export const PALETTE_PRESETS: {
  id: string;
  name: string;
  make: () => Palette;
}[] = [
  { id: "traditional", name: "Traditional Oil (8)", make: makeDefaultPalette },
  {
    id: "wn-artists",
    name: "Winsor & Newton Artists' (25)",
    make: makeWinsorNewtonPalette,
  },
];

let idCounter = 0;
export function newId(prefix = "p"): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${performance.now().toString(36).replace(".", "")}`;
}
