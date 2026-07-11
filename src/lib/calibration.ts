// Calibration engine (optional).
//
// The default mixing model uses eyeballed pigment parameters. Calibration lets
// a painter teach the model their *real* paints: they record observations of
// the form "I mixed these parts and got THIS color", and we fit each pigment's
// tinting strength so the model's predictions match their tubes and lighting.
//
// By default only the relative tinting strengths are fitted. Optionally
// (`fitColor`) the fit also nudges each used pigment's masstone (and undertone,
// if set) — bounded near its original so it corrects for your real tubes/light
// without wandering. The fit is a deterministic coordinate descent minimizing
// mean ΔE over the observations.

import { rgbToLab, deltaE2000, type RGB } from "./color";
import { mixColor } from "./mixer";
import type { Pigment } from "./pigments";

export interface ObservationItem {
  pigmentId: string;
  weight: number; // parts the painter used
}

export interface Observation {
  id: string;
  items: ObservationItem[];
  observed: RGB; // the real color they got
}

export interface Calibration {
  strengthById: Record<string, number>;
  // Optional fitted colors (only present when the color fit was used).
  rgbById?: Record<string, RGB>;
  undertoneById?: Record<string, RGB>;
  avgError: number; // mean ΔE over the observations after fitting
}

// How far a fitted color channel may drift from its original value.
const COLOR_BOUND = 60;

function weightsFor(obs: Observation, pigments: Pigment[]): number[] {
  return pigments.map(
    (p) => obs.items.find((i) => i.pigmentId === p.id)?.weight ?? 0
  );
}

// An observation is usable only if it has some paint in it AND every pigment it
// references still exists in the palette. An observation whose tube was deleted
// or replaced would otherwise be fitted as if the missing pigment contributed
// nothing (weightsFor maps it to 0) — silently corrupting the strengths/colors
// fitted for the remaining pigments.
function isValid(obs: Observation, pigments: Pigment[]): boolean {
  return (
    obs.items.some((i) => i.weight > 0) &&
    obs.items.every(
      (i) => i.weight <= 0 || pigments.some((p) => p.id === i.pigmentId)
    )
  );
}

// ---------- Suggested observations (guided calibration) ----------

export interface SuggestedMix {
  items: ObservationItem[];
  // why this mix: "tint" (pigment + white, best constrains tinting strength)
  // or "pair" (two chromatic pigments, constrains their interaction)
  kind: "tint" | "pair";
}

// Propose the next most INFORMATIVE mixes to record. Chosen by simple, sound
// heuristics rather than optimal experiment design: a 1:3 tint with white is
// the classic way to reveal a pigment's real tinting strength, and 1:1 pairs
// of the least-covered chromatic pigments constrain how they interact. Mixes
// whose pigment set was already recorded are skipped, and pigments with the
// FEWEST existing observations come first — so five suggested mixes spread
// the information instead of repeating it.
export function suggestObservations(
  pigments: Pigment[],
  existing: Observation[],
  count = 5
): SuggestedMix[] {
  if (pigments.length < 2) return [];
  // Coverage: how many existing observations involve each pigment.
  const coverage = new Map<string, number>(pigments.map((p) => [p.id, 0]));
  const seenSets = new Set<string>();
  for (const o of existing) {
    const ids = o.items
      .filter((i) => i.weight > 0)
      .map((i) => i.pigmentId)
      .sort();
    seenSets.add(ids.join("+"));
    for (const id of ids)
      coverage.set(id, (coverage.get(id) ?? 0) + 1);
  }

  // White = lightest pigment (tints need it); chromatics = the rest, least
  // covered first, strongest first among equals (they distort mixes most).
  const byL = [...pigments].sort(
    (a, b) => rgbToLab(b.rgb).L - rgbToLab(a.rgb).L
  );
  const white = byL[0];
  const chromatics = pigments
    .filter((p) => p.id !== white.id)
    .sort(
      (a, b) =>
        (coverage.get(a.id) ?? 0) - (coverage.get(b.id) ?? 0) ||
        b.strength - a.strength
    );

  const out: SuggestedMix[] = [];
  const push = (items: ObservationItem[], kind: SuggestedMix["kind"]) => {
    const key = items
      .map((i) => i.pigmentId)
      .sort()
      .join("+");
    if (seenSets.has(key)) return;
    seenSets.add(key);
    out.push({ items, kind });
  };

  // 1) tints: least-covered chromatics with white 1:3
  for (const p of chromatics) {
    if (out.length >= count) break;
    push(
      [
        { pigmentId: white.id, weight: 3 },
        { pigmentId: p.id, weight: 1 },
      ],
      "tint"
    );
  }
  // 2) pairs of the least-covered chromatics 1:1
  for (let i = 0; i + 1 < chromatics.length && out.length < count; i += 2) {
    push(
      [
        { pigmentId: chromatics[i].id, weight: 1 },
        { pigmentId: chromatics[i + 1].id, weight: 1 },
      ],
      "pair"
    );
  }
  return out.slice(0, count);
}

// Mean perceptual error of the model's predictions across the observations.
export function averageError(
  observations: Observation[],
  pigments: Pigment[]
): number {
  const valid = observations.filter((o) => isValid(o, pigments));
  if (valid.length === 0) return 0;
  let total = 0;
  for (const obs of valid) {
    const predicted = mixColor(pigments, weightsFor(obs, pigments));
    total += deltaE2000(rgbToLab(predicted), rgbToLab(obs.observed));
  }
  return total / valid.length;
}

// The model's predicted color for a single observation (for side-by-side UI).
export function predictObservation(
  obs: Observation,
  pigments: Pigment[]
): RGB {
  return mixColor(pigments, weightsFor(obs, pigments));
}

// Fit tinting strengths (and optionally colors) to the observations via
// deterministic coordinate descent with shrinking steps.
export function fitCalibration(
  observations: Observation[],
  pigments: Pigment[],
  opts: { fitColor?: boolean } = {}
): Calibration {
  const valid = observations.filter((o) => isValid(o, pigments));
  const n = pigments.length;

  // Mutable working copy (deep on rgb/undertone) that we descend on in place.
  const work: Pigment[] = pigments.map((p) => ({
    ...p,
    rgb: { ...p.rgb },
    undertone: p.undertone ? { ...p.undertone } : undefined,
  }));
  const evalNow = () => averageError(valid, work);
  let best = evalNow();

  // 1) tinting strengths, kept in (0.05 .. 1]
  let step = 0.4;
  for (let iter = 0; iter < 60; iter++) {
    for (let i = 0; i < n; i++) {
      for (const dir of [1, -1]) {
        const orig = work[i].strength;
        work[i].strength = Math.min(1, Math.max(0.05, orig * (1 + dir * step)));
        const e = evalNow();
        if (e < best - 1e-6) best = e;
        else work[i].strength = orig;
      }
    }
    step *= 0.85;
  }

  // 2) optional color fit — only for pigments that appear in observations, each
  // channel bounded to ±COLOR_BOUND of its original so it can't wander off.
  if (opts.fitColor) {
    const used = new Set<string>();
    for (const o of valid)
      for (const it of o.items) if (it.weight > 0) used.add(it.pigmentId);
    const channels: ("r" | "g" | "b")[] = ["r", "g", "b"];

    let cstep = 24;
    for (let iter = 0; iter < 40; iter++) {
      for (let i = 0; i < n; i++) {
        if (!used.has(work[i].id)) continue;
        const tune = (color: RGB, origColor: RGB) => {
          for (const c of channels) {
            for (const dir of [1, -1]) {
              const orig = color[c];
              const nv = Math.min(255, Math.max(0, Math.round(orig + dir * cstep)));
              if (Math.abs(nv - origColor[c]) > COLOR_BOUND) continue;
              color[c] = nv;
              const e = evalNow();
              if (e < best - 1e-6) best = e;
              else color[c] = orig;
            }
          }
        };
        tune(work[i].rgb, pigments[i].rgb);
        if (work[i].undertone && pigments[i].undertone)
          tune(work[i].undertone!, pigments[i].undertone!);
      }
      cstep *= 0.8;
    }
  }

  const strengthById: Record<string, number> = {};
  const rgbById: Record<string, RGB> = {};
  const undertoneById: Record<string, RGB> = {};
  work.forEach((p) => {
    strengthById[p.id] = p.strength;
    if (opts.fitColor) {
      rgbById[p.id] = { ...p.rgb };
      if (p.undertone) undertoneById[p.id] = { ...p.undertone };
    }
  });

  const cal: Calibration = { strengthById, avgError: best };
  if (opts.fitColor) {
    cal.rgbById = rgbById;
    if (Object.keys(undertoneById).length) cal.undertoneById = undertoneById;
  }
  return cal;
}

// Return pigments with their fitted tinting strength (and, if the color fit was
// used, masstone/undertone) applied.
export function applyCalibration(
  pigments: Pigment[],
  cal: Calibration
): Pigment[] {
  return pigments.map((p) => {
    let out = p;
    if (cal.strengthById[p.id] != null)
      out = { ...out, strength: cal.strengthById[p.id] };
    if (cal.rgbById?.[p.id]) out = { ...out, rgb: cal.rgbById[p.id] };
    if (cal.undertoneById?.[p.id])
      out = { ...out, undertone: cal.undertoneById[p.id] };
    return out;
  });
}
