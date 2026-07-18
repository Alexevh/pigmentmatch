// Color strings: the light→shadow value scale a painter premixes before a
// session. Starting from a base mix, each lighter step ADDS the palette's
// white and each darker step ADDS a darkening pigment — exactly what happens
// on a real palette — and every step is predicted with the mixing engine, so
// the swatches show the real drift (tints cool and desaturate, shadows sink).
// Pure math over the palette; no component code here.

import { rgbToLab, rgbToHex, type RGB, type Lab } from "./color";
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
  // Pigments the painter can pick as the darkener (all enabled tubes darker
  // than the base), for a UI override.
  darkChoices: Pigment[];
}

// Fractions of white added for the light steps (white tints weakly, so it
// takes a lot). Darkeners tint FAR more strongly, so their fractions are much
// smaller — a value step, not "painting with the dark pigment".
const LIGHT_FRACTIONS = [0.75, 0.5, 0.25];
const DARK_FRACTIONS = [0.08, 0.18, 0.3];

const chroma = (l: Lab) => Math.hypot(l.a, l.b);
function hueDist(a: Lab, b: Lab): number {
  let d = Math.abs(Math.atan2(a.b, a.a) - Math.atan2(b.b, b.a));
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d; // 0..π
}

// Choose the darkener. Painters darken a color by staying in its FAMILY (a warm
// skin tone goes to burnt umber / sienna, not to black — black just greys it).
// So for a chromatic base we pick the darkest-family tube: among tubes darker
// than the base, prefer a chromatic one whose hue is closest to the base's,
// and only fall back to a near-neutral dark (black/Payne's) when the base
// itself is near-neutral or nothing chromatic is dark enough.
function chooseDarkener(
  enabled: Pigment[],
  baseLab: Lab,
  overrideId?: string
): Pigment | null {
  if (overrideId) return enabled.find((p) => p.id === overrideId) ?? null;
  const darker = enabled.filter((p) => rgbToLab(p.rgb).L < baseLab.L - 8);
  if (!darker.length) return null;
  if (chroma(baseLab) < 8) {
    // Near-neutral base: a neutral dark is the right tool — pick the darkest.
    return darker.reduce((a, b) =>
      rgbToLab(a.rgb).L <= rgbToLab(b.rgb).L ? a : b
    );
  }
  const chromaticDarks = darker.filter((p) => chroma(rgbToLab(p.rgb)) > 6);
  const pool = chromaticDarks.length ? chromaticDarks : darker;
  return pool.reduce((best, p) =>
    hueDist(rgbToLab(p.rgb), baseLab) < hueDist(rgbToLab(best.rgb), baseLab)
      ? p
      : best
  );
}

export function buildColorString(
  target: RGB,
  pigments: Pigment[],
  mode: RecipeMode = "simple",
  engine: MixEngine = "classic",
  opts: { darkenerId?: string } = {}
): ColorString | null {
  const enabled = pigments.filter(isEnabled);
  if (enabled.length < 2) return null;

  const recipe = generateRecipe(target, enabled, mode, engine);
  if (!recipe.items.length) return null;
  const baseWeights = enabled.map(
    (p) => recipe.items.find((i) => i.pigment.id === p.id)?.weight ?? 0
  );
  const baseLab = rgbToLab(predictMix(enabled, baseWeights, engine));

  // White = the lightest enabled pigment (weak tinter, fine as-is). Darkener =
  // an in-family dark by default, or the painter's override.
  const byL = enabled
    .map((p) => ({ p, L: rgbToLab(p.rgb).L }))
    .sort((a, b) => b.L - a.L);
  const white = byL[0].L > 75 ? byL[0].p : null;
  const dark = chooseDarkener(enabled, baseLab, opts.darkenerId);
  const darkChoices = enabled.filter(
    (p) => rgbToLab(p.rgb).L < baseLab.L - 8
  );

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
    darkChoices,
  };
}
