// Calibration engine (optional).
//
// The default mixing model uses eyeballed pigment parameters. Calibration lets
// a painter teach the model their *real* paints: they record observations of
// the form "I mixed these parts and got THIS color", and we fit each pigment's
// tinting strength so the model's predictions match their tubes and lighting.
//
// Only the relative tinting strengths are fitted — the masstone color of a
// pigment can already be set directly in the Palette tab. The fit is a simple,
// deterministic coordinate descent that minimizes mean ΔE over the observations.

import { rgbToLab, deltaE, type RGB } from "./color";
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
  avgError: number; // mean ΔE over the observations after fitting
}

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
    total += deltaE(rgbToLab(predicted), rgbToLab(obs.observed));
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

// Fit tinting strengths to the observations via deterministic coordinate
// descent with a shrinking step. Strengths are kept in (0.05 .. 1].
export function fitCalibration(
  observations: Observation[],
  pigments: Pigment[]
): Calibration {
  const valid = observations.filter(isValid);
  const n = pigments.length;
  let strengths = pigments.map((p) => p.strength);

  const evalStrengths = (s: number[]): number => {
    const pig = pigments.map((p, i) => ({ ...p, strength: s[i] }));
    return averageError(valid, pig);
  };

  let best = evalStrengths(strengths);
  let step = 0.4;

  for (let iter = 0; iter < 60; iter++) {
    for (let i = 0; i < n; i++) {
      for (const dir of [1, -1]) {
        const trial = strengths.slice();
        trial[i] = Math.min(1, Math.max(0.05, trial[i] * (1 + dir * step)));
        const e = evalStrengths(trial);
        if (e < best - 1e-6) {
          best = e;
          strengths = trial;
        }
      }
    }
    step *= 0.85;
  }

  const strengthById: Record<string, number> = {};
  pigments.forEach((p, i) => (strengthById[p.id] = strengths[i]));
  return { strengthById, avgError: best };
}

// Return pigments with their tinting strength replaced by the fitted values.
export function applyCalibration(
  pigments: Pigment[],
  cal: Calibration
): Pigment[] {
  return pigments.map((p) =>
    cal.strengthById[p.id] != null
      ? { ...p, strength: cal.strengthById[p.id] }
      : p
  );
}
