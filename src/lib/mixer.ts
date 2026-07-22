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
// `under` is the undertone K/S (equals `ks` when the pigment has no undertone).
interface PigmentKS {
  ks: [number, number, number];
  under: [number, number, number];
  strength: number;
}

function rgbToKS3(rgb: RGB): [number, number, number] {
  return [
    reflectanceToKS(rgb.r / 255),
    reflectanceToKS(rgb.g / 255),
    reflectanceToKS(rgb.b / 255),
  ];
}

function pigmentToKS(p: Pigment): PigmentKS {
  const ks = rgbToKS3(p.rgb);
  return {
    ks,
    under: p.undertone ? rgbToKS3(p.undertone) : ks,
    strength: p.strength,
  };
}

// Mix a set of pigments given non-negative weights (parts). Weights are scaled
// by each pigment's tinting strength so a strong pigment "goes further".
//
// Undertone: a pigment reads as its masstone when it dominates the mix and
// drifts toward its undertone as it becomes a smaller fraction (thinned/tinted).
// We blend each pigment's K/S between undertone and masstone by its own fraction
// f (f=1 → masstone, f→0 → undertone). With no undertone (under===ks) this is
// exactly the previous math.
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
    const it = items[i];
    for (let c = 0; c < 3; c++) {
      const eff_ks = it.under[c] + f * (it.ks[c] - it.under[c]);
      ks[c] += f * eff_ks;
    }
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
export type MixEngine = "classic" | "spectral" | "km2";

// A backend that turns a weight vector into the mixed color.
type MixFn = (weights: number[]) => RGB;

const EMPTY: RGB = { r: 255, g: 255, b: 255 };

function buildSpectralMix(pigments: Pigment[]): MixFn {
  const items = pigments.map((p) => {
    const mass = new spectral.Color([p.rgb.r, p.rgb.g, p.rgb.b]);
    mass.tintingStrength = p.strength;
    let under: spectral.Color | null = null;
    if (p.undertone) {
      under = new spectral.Color([p.undertone.r, p.undertone.g, p.undertone.b]);
      under.tintingStrength = p.strength;
    }
    return { mass, under, strength: p.strength };
  });
  return (weights) => {
    // Undertone: split a pigment's weight between its masstone and undertone
    // faces by its own fraction f of the mix (f→1 masstone, f→0 undertone).
    // With no undertone this pushes exactly one [mass, weight] pair as before.
    let total = 0;
    const eff = weights.map((w, i) => {
      const e = Math.max(0, w) * items[i].strength;
      total += e;
      return e;
    });
    const pairs: Array<[spectral.Color, number]> = [];
    for (let i = 0; i < items.length; i++) {
      if (weights[i] <= 0) continue;
      const it = items[i];
      if (it.under && total > 0) {
        const f = eff[i] / total;
        if (f > 0) pairs.push([it.mass, weights[i] * f]);
        if (f < 1) pairs.push([it.under, weights[i] * (1 - f)]);
      } else {
        pairs.push([it.mass, weights[i]]);
      }
    }
    if (pairs.length === 0) return EMPTY;
    const [r, g, b] = spectral.mix(...pairs).sRGB;
    return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
  };
}

// Two-constant Kubelka-Munk (experimental): split absorption K and scattering S
// per pigment. We can't measure them, so we approximate: the K/S RATIO comes
// from the masstone (as in classic), and S is driven by OPACITY (opaque →
// scatters a lot → dominates the mix; transparent → scatters little → glazes).
// K = ratio·S. The mix is K_mix/S_mix = Σc·K / Σc·S — an S-weighted blend, so
// opaque tubes take over a mixture more than transparent ones of equal tinting
// strength. Undertone is honored on the ratio, exactly like classic.
function opacityToS(opacity: number): number {
  const o = Math.min(1, Math.max(0, opacity));
  return 0.15 + 0.85 * o; // never 0 (avoid division blowups); transparent≈0.15
}

function buildKm2Mix(pigments: Pigment[]): MixFn {
  const items = pigments.map((p) => {
    const ratio = rgbToKS3(p.rgb);
    return {
      ratio,
      under: p.undertone ? rgbToKS3(p.undertone) : ratio,
      S: opacityToS(p.opacity),
      strength: p.strength,
    };
  });
  return (weights) => {
    let total = 0;
    const eff = weights.map((w, i) => {
      const e = Math.max(0, w) * items[i].strength;
      total += e;
      return e;
    });
    if (total <= 0) return EMPTY;
    const K: [number, number, number] = [0, 0, 0];
    const S: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < items.length; i++) {
      const f = eff[i] / total;
      const it = items[i];
      for (let c = 0; c < 3; c++) {
        const r = it.under[c] + f * (it.ratio[c] - it.under[c]);
        K[c] += f * (r * it.S);
        S[c] += f * it.S;
      }
    }
    return {
      r: Math.round(ksToReflectance(K[0] / S[0]) * 255),
      g: Math.round(ksToReflectance(K[1] / S[1]) * 255),
      b: Math.round(ksToReflectance(K[2] / S[2]) * 255),
    };
  };
}

function buildMix(engine: MixEngine, pigments: Pigment[]): MixFn {
  if (engine === "spectral") return buildSpectralMix(pigments);
  if (engine === "km2") return buildKm2Mix(pigments);
  const ks = pigments.map(pigmentToKS);
  return (weights) => mixKS(ks, weights);
}

// Predict the color of an explicit weight vector under a given engine — the
// public door to the mixing backends for tools that build their own weights
// (color strings, the calibration chart) rather than searching for them.
export function predictMix(
  pigments: Pigment[],
  weights: number[],
  engine: MixEngine = "classic"
): RGB {
  return buildMix(engine, pigments)(weights);
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

// A real color is almost never a single pigment straight from the tube — that's
// reserved for the rare near-tube-pure target (a super-saturated cadmium, a
// vivid flower). So reduceWeights won't collapse a mix to ONE pigment unless
// that lone pigment already matches the target this closely in ΔE2000 (i.e. the
// target essentially IS that tube). Otherwise it keeps the two-pigment mix.
const PURE_TOLERANCE = 3;

// Optional, opt-in recipe controls. Defaults keep the original behavior exactly.
export interface RecipeOptions {
  maxColors?: number | null; // cap the pigment count (null = no cap, default)
  valuePriority?: boolean; // when simplifying, protect value (L*) over hue/chroma
  goldenRatio?: boolean; // reshape the proportions to Fibonacci / golden ratio
  // Must-use tubes: pigment ids that MUST appear in the final recipe at a
  // meaningful share (the painter knows their base — "this skin starts from
  // Pale Rose Blush greyed with Raw Umber"). The search projects every
  // candidate to include them and reduceWeights never drops them; the shown
  // score honestly reflects the constrained mix. Empty/absent = no-op, output
  // byte-identical to before. If it clashes with maxColors, required wins.
  requiredIds?: string[];
}

// Each required tube holds at least this share of the mix — below that it's
// not "using the tube", it's a homeopathic trace.
const REQUIRED_FLOOR = 0.02;

// The first n distinct Fibonacci numbers [1,2,3,5,8,13,...]. Consecutive ratios
// approach the golden ratio φ (~1.618).
function fibSequence(n: number): number[] {
  const out: number[] = [];
  let a = 1;
  let b = 2;
  for (let i = 0; i < n; i++) {
    out.push(a);
    const c = a + b;
    a = b;
    b = c;
  }
  return out;
}

// Reshape a weight vector so the pigment proportions follow the Fibonacci
// sequence (the largest pigment gets the largest Fibonacci number, etc.). This
// is an artistic constraint: the mix usually drifts from the target — that's
// expected, and the recomputed ΔE / ΔL reflect it. Untouched for 0–1 pigments.
function applyGoldenRatio(weights: number[]): number[] {
  const active = weights
    .map((w, i) => ({ w, i }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w);
  if (active.length <= 1) return weights;
  const fib = fibSequence(active.length);
  const sum = fib.reduce((a, b) => a + b, 0);
  const out = new Array(weights.length).fill(0);
  active.forEach((x, k) => {
    // active is largest→smallest; give it the largest→smallest Fibonacci value
    out[x.i] = fib[active.length - 1 - k] / sum;
  });
  return out;
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
// Divides by 2^32 (not 2^32-1) so the range is [0, 1) — with an inclusive upper
// bound, `Math.floor(rng() * n)` could return n (once per full LCG period) and
// index past the end of a weights array, poisoning that candidate with NaN.
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
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

  // Must-use tubes → indices (unknown/disabled ids just drop out). With none,
  // `project` is the identity and the whole search is byte-identical to before.
  const requiredIdx = Array.from(
    new Set(
      (options.requiredIds ?? [])
        .map((id) => pigments.findIndex((p) => p.id === id))
        .filter((i) => i >= 0)
    )
  );
  const project = (weights: number[]): number[] => {
    if (!requiredIdx.length) return weights;
    const out = weights.slice();
    for (const i of requiredIdx) out[i] = Math.max(out[i], REQUIRED_FLOOR);
    const sum = out.reduce((a, b) => a + b, 0);
    return out.map((x) => x / sum);
  };

  // Single choke point: every candidate (seeds, restarts, hill-climb) is
  // projected onto the constraint before evaluation, so all engines honor the
  // required tubes and the stored weights already contain them.
  const evalWeights = (weights: number[]): Candidate => {
    const w = project(weights);
    const rgb = mix(w);
    return { weights: w, rgb, dE: deltaE2000(rgbToLab(rgb), targetLab) };
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
  let weights = reduceWeights(
    final,
    mix,
    targetLab,
    tolerance,
    maxColors,
    valuePriority,
    new Set(requiredIdx)
  );
  // Optional artistic pass: snap the proportions to Fibonacci / golden ratio.
  // buildRecipe then recomputes the mix + ΔE/ΔL from these weights, so the shown
  // score honestly reflects the (usually looser) golden-ratio mix.
  if (options.goldenRatio) weights = applyGoldenRatio(weights);
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
  valuePriority = false,
  required: Set<number> = new Set()
): number[] {
  const de2000 = (rgb: RGB) => deltaE2000(rgbToLab(rgb), targetLab);
  const err = (rgb: RGB) =>
    valuePriority ? valueError(rgbToLab(rgb), targetLab) : de2000(rgb);

  let weights = cand.weights.slice();
  const ceiling = err(cand.rgb) + tolerance;
  // Value-priority guard: even while chasing the value, don't drop a pigment if
  // it wrecks the actual color. Without this, an out-of-reach (e.g. very dark)
  // target collapses to a single neutral because dropping the hue pigments gets
  // "closer" in lightness — the mix ends up grey instead of the right hue.
  // NOTE: the guard applies only to FREE drops; a drop forced by maxColors
  // (overCap below) skips it by design — the user asked for at most N pigments,
  // so value is kept and hue/chroma are allowed to drift.
  const colorGuard = de2000(cand.rgb) + tolerance;

  for (;;) {
    const active = weights
      .map((w, i) => ({ w, i }))
      .filter((x) => x.w > 0);
    if (active.length <= 1) break;
    // Must-use tubes are never candidates for removal — if everything left is
    // required, there is nothing to reduce. (A maxColors below the required
    // count therefore stops at the required count: the constraint wins.)
    const droppable = active.filter((x) => !required.has(x.i));
    if (!droppable.length) break;
    const overCap = maxColors != null && active.length > maxColors;

    // find the single removal that costs the least extra error
    let bestRemoval: { weights: number[]; e: number; dE: number } | null = null;
    for (const { i } of droppable) {
      const trial = weights.slice();
      trial[i] = 0;
      const sum = trial.reduce((a, b) => a + b, 0);
      if (sum <= 0) continue;
      const norm = trial.map((x) => x / sum);
      const rgb = mix(norm);
      const e = err(rgb);
      if (!bestRemoval || e < bestRemoval.e) {
        bestRemoval = { weights: norm, e, dE: valuePriority ? de2000(rgb) : e };
      }
    }
    if (!bestRemoval) break;

    // Drop if it's forced (over the cap), or "free" within tolerance — and,
    // under value-priority, only if it also keeps the real color within guard.
    const withinColor = !valuePriority || bestRemoval.dE <= colorGuard;
    if (overCap || (bestRemoval.e <= ceiling && withinColor)) {
      // Don't collapse to a SINGLE pigment unless it's a near-tube-pure match.
      // A recipe is rarely one color straight from the pot; keep the mix. (A
      // forced maxColors=1 cap still wins — the user asked for one tube.)
      const nonzero = bestRemoval.weights.filter((w) => w > 0).length;
      if (!overCap && nonzero <= 1 && bestRemoval.dE > PURE_TOLERANCE) break;
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

// --- Gamut reachability / "add this pigment" suggestion ---

// A quick, lower-budget estimate of the best ΔE2000 a palette can reach for a
// target. Cheaper than generateRecipe (we only need the score, not a tidy
// recipe), so it can be run across many candidate palettes. Always classic
// (fast) — it's a heuristic for reachability, not the displayed recipe.
export function reachEstimate(
  target: RGB,
  pigments: Pigment[],
  coarse = false
): number {
  if (!pigments.length) return 100;
  const mix = buildMix("classic", pigments);
  const targetLab = rgbToLab(target);
  const n = pigments.length;
  const rng = makeRng(target.r * 65536 + target.g * 256 + target.b + n * 7919);
  const evalW = (w: number[]) => deltaE2000(rgbToLab(mix(w)), targetLab);

  let best = Infinity;
  let bestW: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const w = new Array(n).fill(0);
    w[i] = 1;
    const d = evalW(w);
    if (d < best) {
      best = d;
      bestW = w;
    }
  }
  const R = coarse ? Math.min(150, 40 * n) : Math.min(400, 120 * n);
  const kCap = Math.min(4, n);
  for (let t = 0; t < R; t++) {
    const k = 1 + Math.floor(rng() * kCap);
    const w = new Array(n).fill(0);
    for (let j = 0; j < k; j++) w[Math.floor(rng() * n)] += rng();
    const s = w.reduce((a, b) => a + b, 0);
    if (s <= 0) continue;
    const d = evalW(w.map((x) => x / s));
    if (d < best) {
      best = d;
      bestW = w.map((x) => x / s);
    }
  }
  let cur = bestW.slice();
  let curD = best;
  let step = 0.25;
  const HILL = coarse ? 80 : 200;
  for (let it = 0; it < HILL; it++) {
    const w = cur.slice();
    const idx = Math.floor(rng() * n);
    w[idx] = Math.max(0, w[idx] + (rng() - 0.5) * step);
    const s = w.reduce((a, b) => a + b, 0);
    if (s <= 0) continue;
    const d = evalW(w.map((x) => x / s));
    if (d < curD) {
      curD = d;
      cur = w.map((x) => x / s);
      if (d < best) best = d;
    }
    if (it % 40 === 39) step *= 0.6;
  }
  return best;
}

export interface PigmentSuggestion {
  pigment: Pigment;
  deltaE: number;
  match: number;
}

// A tube's name stripped of a trailing line/source parenthetical, for
// duplicate detection: the W&N Mixed preset suffixes shared names with their
// line ("Titanium White (Artists')"), which must still count as already
// having "Titanium White".
function baseName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").toLowerCase();
}

// Find the single library pigment that, added to the palette, most improves the
// reachable ΔE for a target. Returns null unless it helps by a real margin.
export function suggestPigment(
  target: RGB,
  palette: Pigment[],
  candidates: Pigment[],
  baseDeltaE: number,
  minImprovement = 2
): PigmentSuggestion | null {
  const have = new Set(palette.map((p) => baseName(p.name)));
  let best: PigmentSuggestion | null = null;
  for (const c of candidates) {
    if (have.has(baseName(c.name))) continue;
    const dE = reachEstimate(target, [...palette, c]);
    if (dE < (best?.deltaE ?? Infinity)) {
      best = { pigment: c, deltaE: dE, match: matchScore(dE) };
    }
  }
  if (best && best.deltaE <= baseDeltaE - minImprovement) return best;
  return null;
}

// --- Limited-palette planner ---

export interface PalettePlan {
  pigments: Pigment[];
  perTarget: { rgb: RGB; deltaE: number; match: number }[];
  covered: boolean; // all targets within tolerance
}

// Given a set of target colors (e.g. a painting's dominant palette), greedily
// pick the smallest set of pigments that can mix them all within `tolerance`
// ΔE. Seeds with a white (nearly every mix needs it) and adds, one at a time,
// the pigment that most reduces the total reachable error, until every target
// is covered or `maxTubes` is hit. Uses the coarse reach estimate for speed.
export function planPalette(
  targets: RGB[],
  candidates: Pigment[],
  opts: { tolerance?: number; maxTubes?: number } = {}
): PalettePlan {
  const tolerance = opts.tolerance ?? 5;
  const maxTubes = opts.maxTubes ?? 8;

  const set: Pigment[] = [];
  const white = candidates.find((c) => /white/i.test(c.name));
  if (white) set.push(white);
  const remaining = candidates.filter((c) => c !== white);

  const worstOk = () =>
    set.length > 0 &&
    targets.every((t) => reachEstimate(t, set, true) <= tolerance);

  while (set.length < maxTubes && !worstOk()) {
    let bestC: Pigment | null = null;
    let bestScore = Infinity;
    for (const c of remaining) {
      const trial = [...set, c];
      let sum = 0;
      for (const t of targets) sum += reachEstimate(t, trial, true);
      if (sum < bestScore) {
        bestScore = sum;
        bestC = c;
      }
    }
    if (!bestC) break;
    set.push(bestC);
    remaining.splice(remaining.indexOf(bestC), 1);
  }

  const perTarget = targets.map((rgb) => {
    const d = reachEstimate(rgb, set, true);
    return { rgb, deltaE: d, match: matchScore(d) };
  });
  return {
    pigments: set,
    perTarget,
    covered: perTarget.every((p) => p.deltaE <= tolerance),
  };
}
