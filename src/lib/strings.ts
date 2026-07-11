// Color strings: the light→shadow value scale a painter premixes before a
// session. Starting from a base mix, each lighter step ADDS the palette's
// white and each darker step ADDS a darkening pigment — exactly what happens
// on a real palette — and every step is predicted with the mixing engine, so
// the swatches show the real drift (tints cool and desaturate, shadows sink).
// Pure math over the palette; no component code here.

import { rgbToLab, rgbToHex, type RGB } from "./color";
import {
  generateRecipe,
  predictMix,
  type MixEngine,
  type RecipeMode,
} from "./mixer";
import { isEnabled, type Pigment } from "./pigments";

export interface StringStep {
  rgb: RGB;
  hex: string;
  L: number;
  // What to add to the BASE mix to land on this step. null = the base itself.
  add: { pigment: Pigment; percent: number } | null;
  // Full normalized weights over the palette (for a per-step parts readout).
  weights: number[];
}

export interface ColorString {
  base: RGB; // the base mix's predicted color
  baseIndex: number; // index of the base step within `steps`
  steps: StringStep[]; // ordered light → dark
  // The ENABLED pigments each step's `weights` vector indexes into (callers
  // must not assume it matches the palette they passed — disabled tubes are
  // filtered out here).
  pigments: Pigment[];
  white: Pigment | null;
  dark: Pigment | null;
}

// Fractions of the added pigment for the light/dark steps. Darkeners are
// strong, so they get smaller fractions than white.
const LIGHT_FRACTIONS = [0.75, 0.5, 0.25];
const DARK_FRACTIONS = [0.12, 0.3, 0.55];

export function buildColorString(
  target: RGB,
  pigments: Pigment[],
  mode: RecipeMode = "simple",
  engine: MixEngine = "classic"
): ColorString | null {
  const enabled = pigments.filter(isEnabled);
  if (enabled.length < 2) return null;

  const recipe = generateRecipe(target, enabled, mode, engine);
  if (!recipe.items.length) return null;
  const baseWeights = enabled.map(
    (p) => recipe.items.find((i) => i.pigment.id === p.id)?.weight ?? 0
  );

  // White = the lightest enabled pigment; darkener = the darkest. (A painter
  // may prefer an umber or a complement — this is the neutral default.)
  const byL = enabled
    .map((p) => ({ p, L: rgbToLab(p.rgb).L }))
    .sort((a, b) => b.L - a.L);
  const white = byL[0].L > 75 ? byL[0].p : null;
  const dark = byL[byL.length - 1].L < 45 ? byL[byL.length - 1].p : null;

  const step = (add: Pigment | null, f: number): StringStep => {
    const addVec = enabled.map((p) => (add && p.id === add.id ? 1 : 0));
    const weights = baseWeights.map((w, i) => w * (1 - f) + addVec[i] * f);
    const rgb = predictMix(enabled, weights, engine);
    return {
      rgb,
      hex: rgbToHex(rgb),
      L: rgbToLab(rgb).L,
      add: add ? { pigment: add, percent: Math.round(f * 100) } : null,
      weights,
    };
  };

  const lighter = white ? LIGHT_FRACTIONS.map((f) => step(white, f)) : [];
  const baseStep = step(null, 0);
  const darker = dark ? DARK_FRACTIONS.map((f) => step(dark, f)) : [];

  const steps = [...lighter, baseStep, ...darker];
  return {
    base: baseStep.rgb,
    baseIndex: lighter.length,
    steps,
    pigments: enabled,
    white,
    dark,
  };
}
