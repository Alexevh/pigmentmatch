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

function isValid(obs: Observation): boolean {
  return obs.items.some((i) => i.weight > 0);
}

// Mean perceptual error of the model's predictions across the observations.
export function averageError(
  observations: Observation[],
  pigments: Pigment[]
): number {
  const valid = observations.filter(isValid);
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
  const valid = observations.filter(isValid);
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
