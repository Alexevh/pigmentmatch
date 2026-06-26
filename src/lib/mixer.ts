// Paint mixing model + recipe generator.
//
// Pigments do not mix like light (additive RGB). They mix subtractively.
// We use a single-constant Kubelka-Munk approximation per sRGB channel: each
// pigment's reflectance is converted to a K/S (absorption/scattering) value,
// the mix is the strength-weighted sum of K/S, and we convert back to
// reflectance. This makes blue + yellow drift toward green/grey and white
// dilute correctly, the way real paint behaves.

import {
  rgbToLab,
  deltaE2000,
  matchScore,
  rgbToHex,
  clamp255,
  type RGB,
} from "./color";
import type { Pigment } from "./pigments";
import * as spectral from "spectral.js";

// --- single-constant Kubelka-Munk per channel ---

function reflectanceToKS(R: number): number {
  // clamp away from 0/1 to avoid singularities
  const r = Math.min(0.9999, Math.max(0.0001, R));
  return (1 - r) ** 2 / (2 * r);
}

function ksToReflectance(ks: number): number {
  const v = 1 + ks - Math.sqrt(ks * ks + 2 * ks);
  return Math.min(1, Math.max(0, v));
}

// Precompute per-pigment per-channel K/S so the inner mixing loop is cheap.
interface PigmentKS {
  ks: [number, number, number];
  strength: number;
}

function pigmentToKS(p: Pigment): PigmentKS {
  return {
    ks: [
      reflectanceToKS(p.rgb.r / 255),
      reflectanceToKS(p.rgb.g / 255),
      reflectanceToKS(p.rgb.b / 255),
    ],
    strength: p.strength,
  };
}

// Mix a set of pigments given non-negative weights (parts). Weights are scaled
// by each pigment's tinting strength so a strong pigment "goes further".
function mixKS(items: PigmentKS[], weights: number[]): RGB {
  let total = 0;
  const eff = weights.map((w, i) => {
    const e = Math.max(0, w) * items[i].strength;
    total += e;
    return e;
  });
  if (total <= 0) return { r: 255, g: 255, b: 255 };
  const ks: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < items.length; i++) {
    const f = eff[i] / total;
    ks[0] += f * items[i].ks[0];
    ks[1] += f * items[i].ks[1];
    ks[2] += f * items[i].ks[2];
  }
  return {
    r: Math.round(ksToReflectance(ks[0]) * 255),
    g: Math.round(ksToReflectance(ks[1]) * 255),
    b: Math.round(ksToReflectance(ks[2]) * 255),
  };
}

// Public mixing entry point: mix pigments by weight (parts) using the classic
// single-constant model. Calibration reuses this.
export function mixColor(pigments: Pigment[], weights: number[]): RGB {
  return mixKS(pigments.map(pigmentToKS), weights);
}

// --- Mixing engines (pluggable) ---
// "classic": our single-constant Kubelka-Munk per sRGB channel.
// "spectral": spectral.js — reconstructs a full reflectance curve from each
// pigment's sRGB (LHTSS) and mixes with Kubelka-Munk across the spectrum.
export type MixEngine = "classic" | "spectral";

// A backend that turns a weight vector into the mixed color.
type MixFn = (weights: number[]) => RGB;

const EMPTY: RGB = { r: 255, g: 255, b: 255 };

function buildSpectralMix(pigments: Pigment[]): MixFn {
  const colors = pigments.map((p) => {
    const c = new spectral.Color([p.rgb.r, p.rgb.g, p.rgb.b]);
    c.tintingStrength = p.strength;
    return c;
  });
  return (weights) => {
    const pairs: Array<[spectral.Color, number]> = [];
    for (let i = 0; i < colors.length; i++) {
      if (weights[i] > 0) pairs.push([colors[i], weights[i]]);
    }
    if (pairs.length === 0) return EMPTY;
    const [r, g, b] = spectral.mix(...pairs).sRGB;
    return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
  };
}

function buildMix(engine: MixEngine, pigments: Pigment[]): MixFn {
  if (engine === "spectral") return buildSpectralMix(pigments);
  const ks = pigments.map(pigmentToKS);
  return (weights) => mixKS(ks, weights);
}

// --- Recipe ---

export type Amount =
  | "base"
  | "part"
  | "small touch"
  | "tiny touch"
  | "microscopic touch";

export interface RecipeItem {
  pigment: Pigment;
  weight: number; // normalized 0..1
  parts: number | null; // integer-ish parts for structural pigments, null for "touches"
  amount: Amount;
}

export interface Recipe {
  items: RecipeItem[];
  mixed: RGB;
  mixedHex: string;
  deltaE: number;
  match: number; // 0..100
  deltaL: number; // |target L* − mixed L*| (value error; lower is better)
}

const EMPTY_RGB: RGB = { r: 255, g: 255, b: 255 };

// "simple" prefers fewer pigments (a painter rarely wants 6 tubes for one
// color); "precise" squeezes the lowest possible ΔE even if it adds touches.
export type RecipeMode = "simple" | "precise";

// In simple mode, how much extra ΔE we'll tolerate to drop a pigment. ~2 is
// around the just-noticeable threshold, so the simplified mix still reads as
// the same color.
const SIMPLIFY_TOLERANCE = 2;

// Precise mode only trims pigments that are essentially search noise.
const PRECISE_TOLERANCE = 0.5;

// Optional, opt-in recipe controls. Defaults keep the original behavior exactly.
export interface RecipeOptions {
  maxColors?: number | null; // cap the pigment count (null = no cap, default)
  valuePriority?: boolean; // when simplifying, protect value (L*) over hue/chroma
}

// Value-weighted error: heavily weights lightness (L*) and downweights the
// color axes (a*, b*), so simplification can let hue/chroma drift while keeping
// the value close. Roughly on the same scale as ΔE so tolerances still apply.
function valueError(
  a: ReturnType<typeof rgbToLab>,
  b: ReturnType<typeof rgbToLab>
): number {
  const dL = a.L - b.L;
  const dab = Math.hypot(a.a - b.a, a.b - b.b);
  return Math.hypot(1.4 * dL, 0.35 * dab);
}

// Deterministic pseudo-random so results are stable across runs (no Math.random).
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

interface Candidate {
  weights: number[];
  rgb: RGB;
  dE: number;
}

export function generateRecipe(
  target: RGB,
  pigments: Pigment[],
  mode: RecipeMode = "precise",
  engine: MixEngine = "classic",
  options: RecipeOptions = {}
): Recipe {
  const maxColors = options.maxColors ?? null;
  const valuePriority = options.valuePriority ?? false;
  if (pigments.length === 0) {
    return {
      items: [],
      mixed: EMPTY_RGB,
      mixedHex: rgbToHex(EMPTY_RGB),
      deltaE: 100,
      match: 0,
      deltaL: 100,
    };
  }

  const mix = buildMix(engine, pigments);
  const targetLab = rgbToLab(target);
  const n = pigments.length;
  const rng = makeRng(
    target.r * 65536 + target.g * 256 + target.b + n * 7919
  );

  const evalWeights = (weights: number[]): Candidate => {
    const rgb = mix(weights);
    return { weights, rgb, dE: deltaE2000(rgbToLab(rgb), targetLab) };
  };

  let best: Candidate | null = null;
  const consider = (c: Candidate) => {
    if (!best || c.dE < best.dE) best = c;
  };

  // 1) seed with each single pigment
  for (let i = 0; i < n; i++) {
    const w = new Array(n).fill(0);
    w[i] = 1;
    consider(evalWeights(w));
  }

  // 2) random sparse combinations (artists rarely use more than ~4 pigments).
  // The spectral engine's landscape is bumpier, so give it a larger budget.
  // The classic path keeps its original numbers exactly (identical output).
  const isSpectral = engine === "spectral";
  const RESTARTS = Math.min(
    isSpectral ? 4000 : 2400,
    (isSpectral ? 500 : 300) * n
  );
  // Cap how many pigments a restart combines. Without a maxColors this equals
  // Math.min(4, n) — byte-identical to before (same rng draws, same output).
  const kCap = maxColors != null ? Math.min(maxColors, 4, n) : Math.min(4, n);
  for (let t = 0; t < RESTARTS; t++) {
    const k = 1 + Math.floor(rng() * kCap);
    const w = new Array(n).fill(0);
    for (let j = 0; j < k; j++) {
      const idx = Math.floor(rng() * n);
      // skew toward small touches sometimes for fine adjustments
      w[idx] += rng() < 0.4 ? rng() * rng() : rng();
    }
    const sum = w.reduce((a, b) => a + b, 0);
    if (sum <= 0) continue;
    consider(evalWeights(w.map((x) => x / sum)));
  }

  // 3) local hill-climbing refinement around the best candidate
  let current = best as unknown as Candidate;
  let step = 0.25;
  const HILL = isSpectral ? 2000 : 600;
  const annealEvery = isSpectral ? 200 : 120;
  for (let iter = 0; iter < HILL; iter++) {
    const w = current.weights.slice();
    // perturb a random pigment
    const idx = Math.floor(rng() * n);
    w[idx] = Math.max(0, w[idx] + (rng() - 0.5) * step);
    const sum = w.reduce((a, b) => a + b, 0);
    if (sum <= 0) continue;
    const cand = evalWeights(w.map((x) => x / sum));
    if (cand.dE < current.dE) {
      current = cand;
      consider(cand);
    } else if (isSpectral) {
      // restart the walk from the global best occasionally so it doesn't get
      // stuck wandering away from a good basin
      if (iter % 250 === 249) current = best as unknown as Candidate;
    }
    if (iter % annealEvery === annealEvery - 1) {
      step *= 0.6; // anneal
      // spectral: re-heat once the step gets tiny so the climb can still
      // add/swap pigments and escape the bumpier model's local optima
      if (isSpectral && step < 0.04) step = 0.2;
    }
  }

  const final = best as unknown as Candidate;
  // Reduce the pigment count: a small tolerance in precise mode just trims
  // search noise; a larger one in simple mode favors a practical few-pigment
  // mix. A pigment is only dropped when removing it stays within tolerance, so
  // load-bearing touches (e.g. the warm tint in a near-white) are never lost.
  const tolerance =
    mode === "simple" ? SIMPLIFY_TOLERANCE : PRECISE_TOLERANCE;
  const weights = reduceWeights(
    final,
    mix,
    targetLab,
    tolerance,
    maxColors,
    valuePriority
  );
  return buildRecipe(pigments, mix, weights, targetLab);
}

// Greedily drop the least-useful pigment. A pigment is dropped while the error
// stays within `tolerance` of the best achievable, OR while the pigment count is
// still above `maxColors` (a forced cap, ignoring tolerance). With
// `valuePriority`, "error" weights lightness over hue/chroma so forced drops
// keep the value close. Defaults (maxColors=null, valuePriority=false) reproduce
// the original ΔE2000 behavior exactly.
function reduceWeights(
  cand: Candidate,
  mix: MixFn,
  targetLab: ReturnType<typeof rgbToLab>,
  tolerance: number,
  maxColors: number | null = null,
  valuePriority = false
): number[] {
  const err = (rgb: RGB) =>
    valuePriority
      ? valueError(rgbToLab(rgb), targetLab)
      : deltaE2000(rgbToLab(rgb), targetLab);

  let weights = cand.weights.slice();
  const ceiling = err(cand.rgb) + tolerance;

  for (;;) {
    const active = weights
      .map((w, i) => ({ w, i }))
      .filter((x) => x.w > 0);
    if (active.length <= 1) break;
    const overCap = maxColors != null && active.length > maxColors;

    // find the single removal that costs the least extra error
    let bestRemoval: { weights: number[]; e: number } | null = null;
    for (const { i } of active) {
      const trial = weights.slice();
      trial[i] = 0;
      const sum = trial.reduce((a, b) => a + b, 0);
      if (sum <= 0) continue;
      const norm = trial.map((x) => x / sum);
      const e = err(mix(norm));
      if (!bestRemoval || e < bestRemoval.e) {
        bestRemoval = { weights: norm, e };
      }
    }
    if (!bestRemoval) break;

    // Drop if it's "free" (within tolerance) or we're still over the cap.
    if (overCap || bestRemoval.e <= ceiling) {
      weights = bestRemoval.weights;
    } else {
      break;
    }
  }
  return weights;
}

function buildRecipe(
  pigments: Pigment[],
  mix: MixFn,
  weights: number[],
  targetLab: ReturnType<typeof rgbToLab>
): Recipe {
  // Pigments left after reduction all matter; keep anything non-zero.
  const items = weights
    .map((w, i) => ({ pigment: pigments[i], weight: w, i }))
    .filter((x) => x.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  // renormalize for display
  const total = items.reduce((a, b) => a + b.weight, 0) || 1;
  const norm = items.map((x) => ({ ...x, weight: x.weight / total }));

  // Recompute the mixed color and error from exactly the weights we display,
  // so the match score always reflects the recipe shown (no stale value).
  const fullWeights = pigments.map((_, i) => weights[i] || 0);
  const mixed = mix(fullWeights);
  const mixedLab = rgbToLab(mixed);
  const dE = deltaE2000(mixedLab, targetLab);
  const deltaL = Math.abs(targetLab.L - mixedLab.L);

  const top = norm[0]?.weight ?? 1;
  // structural pigments are a meaningful fraction of the mix; the rest are touches
  const structural = norm.filter((x) => x.weight >= top * 0.06);
  const refMin = structural.length
    ? Math.min(...structural.map((x) => x.weight))
    : top;

  const recipeItems: RecipeItem[] = norm.map((x) => {
    const ratio = x.weight / top;
    if (x.weight >= top * 0.06) {
      const parts = Math.max(1, Math.round(x.weight / refMin));
      return {
        pigment: x.pigment,
        weight: x.weight,
        parts,
        amount: x === norm[0] ? "base" : "part",
      };
    }
    // qualitative touches
    let amount: Amount;
    if (ratio < 0.01) amount = "microscopic touch";
    else if (ratio < 0.03) amount = "tiny touch";
    else amount = "small touch";
    return { pigment: x.pigment, weight: x.weight, parts: null, amount };
  });

  return {
    items: recipeItems,
    mixed,
    mixedHex: rgbToHex(mixed),
    deltaE: dE,
    match: matchScore(dE),
    deltaL,
  };
}

// Human phrasing for a recipe item amount.
export function amountLabel(item: RecipeItem): string {
  if (item.parts != null) {
    return `${item.parts} ${item.parts === 1 ? "part" : "parts"}`;
  }
  return item.amount;
}

// Convert the recipe's normalized weights into integer percentages that sum to
// exactly 100, using largest-remainder rounding. Pigments under 1% are floored
// to a marker (-1) so the UI can render them as "<1%" instead of "0%".
export function recipePercentages(items: RecipeItem[]): number[] {
  const total = items.reduce((a, b) => a + b.weight, 0) || 1;
  const raw = items.map((it) => (it.weight / total) * 100);

  // sub-1% pigments are shown as "<1%" and excluded from the rounding pool
  const result = new Array(items.length).fill(0);
  const poolIdx: number[] = [];
  let reserved = 0;
  raw.forEach((v, i) => {
    if (v < 1) {
      result[i] = -1; // "<1%" marker
      reserved += v;
    } else {
      poolIdx.push(i);
    }
  });

  const budget = Math.round(100 - reserved);
  const floors = poolIdx.map((i) => Math.floor(raw[i]));
  let used = floors.reduce((a, b) => a + b, 0);
  poolIdx.forEach((i, k) => (result[i] = floors[k]));

  // distribute the leftover to the largest fractional remainders
  let leftover = budget - used;
  const order = [...poolIdx].sort(
    (a, b) => (raw[b] - Math.floor(raw[b])) - (raw[a] - Math.floor(raw[a]))
  );
  for (let k = 0; k < order.length && leftover > 0; k++) {
    result[order[k]] += 1;
    leftover--;
    used++;
  }
  return result;
}

export function percentLabel(pct: number): string {
  return pct < 0 ? "<1%" : `${pct}%`;
}
