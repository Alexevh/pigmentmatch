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

let idCounter = 0;
export function newId(prefix = "p"): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${performance.now().toString(36).replace(".", "")}`;
}
