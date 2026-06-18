// Painting coach: compares the painter's current mixture to the target and
// gives directional, instructional advice — "lift the value", "it's a touch
// too warm, cool it with Ultramarine" — the way a teacher standing behind you
// would. Pure rules over CIE Lab deltas; no data or network needed.

import {
  rgbToLab,
  rgbToHex,
  deltaE,
  matchScore,
  type RGB,
  type Lab,
} from "./color";
import type { Pigment } from "./pigments";

export type TipKind = "value" | "saturation" | "hue" | "done";

export interface CoachTip {
  id: TipKind;
  text: string;
  swatchHex?: string; // pigment suggested, for a color dot in the UI
}

export interface CoachResult {
  deltaE: number;
  match: number;
  onTarget: boolean;
  headline: string;
  tips: CoachTip[];
}

const chroma = (l: Lab) => Math.hypot(l.a, l.b);

// Smallest signed angle (degrees) to rotate `from` hue toward `to` hue.
function hueAngleDiff(from: Lab, to: Lab): number {
  const a = Math.atan2(from.b, from.a);
  const b = Math.atan2(to.b, to.a);
  let d = ((b - a) * 180) / Math.PI;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

// Pick the palette pigment that pushes hardest in a desired (a*, b*) direction.
function pickByDirection(
  da: number,
  db: number,
  pigments: Pigment[]
): Pigment | null {
  const len = Math.hypot(da, db) || 1;
  const ux = da / len;
  const uy = db / len;
  let best: Pigment | null = null;
  let bestDot = 0.0001;
  for (const p of pigments) {
    const lab = rgbToLab(p.rgb);
    const dot = lab.a * ux + lab.b * uy; // how far this pigment leans our way
    if (dot > bestDot) {
      bestDot = dot;
      best = p;
    }
  }
  return best;
}

function lightestPigment(pigments: Pigment[]): Pigment | null {
  return pigments.reduce<Pigment | null>(
    (acc, p) => (!acc || rgbToLab(p.rgb).L > rgbToLab(acc.rgb).L ? p : acc),
    null
  );
}

// A good "value darkener" is dark AND fairly neutral, so it drops the value
// without swinging the hue (an earth/umber, not a saturated dark like blue).
function valueDarkener(pigments: Pigment[]): Pigment | null {
  let best: Pigment | null = null;
  let bestScore = Infinity;
  for (const p of pigments) {
    const lab = rgbToLab(p.rgb);
    const score = lab.L + 0.6 * chroma(lab); // low value + low chroma wins
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

// The most neutral (lowest-chroma) pigment that isn't near-white — used to mute
// a mix when no true complement exists in the palette.
function mostNeutralEarth(pigments: Pigment[]): Pigment | null {
  let best: Pigment | null = null;
  let bestChroma = Infinity;
  for (const p of pigments) {
    const lab = rgbToLab(p.rgb);
    if (lab.L > 80) continue; // skip whites
    const ch = chroma(lab);
    if (ch < bestChroma) {
      bestChroma = ch;
      best = p;
    }
  }
  return best;
}

function magnitudeWord(v: number, mid: number, big: number): string {
  const a = Math.abs(v);
  if (a >= big) return "much ";
  if (a >= mid) return "a bit ";
  return "slightly ";
}

const named = (p: Pigment | null, fallback: string) => p?.name ?? fallback;

export function coach(
  target: RGB,
  current: RGB,
  pigments: Pigment[]
): CoachResult {
  const t = rgbToLab(target);
  const c = rgbToLab(current);
  const dE = deltaE(t, c);
  const match = matchScore(dE);

  if (dE < 1.5) {
    return {
      deltaE: dE,
      match,
      onTarget: true,
      headline: "You're there — the difference is barely perceptible.",
      tips: [{ id: "done", text: "Lay it in and trust it." }],
    };
  }

  const tips: { tip: CoachTip; severity: number }[] = [];

  // 1) Value (lightness) ----------------------------------------------------
  const dL = t.L - c.L; // + => target is lighter => need to lighten
  if (Math.abs(dL) >= 4) {
    if (dL > 0) {
      const white = lightestPigment(pigments);
      tips.push({
        severity: Math.abs(dL),
        tip: {
          id: "value",
          text: `Your mix is ${magnitudeWord(dL, 10, 22)}too dark — lift the value with ${named(
            white,
            "white"
          )}.`,
          swatchHex: white ? rgbToHex(white.rgb) : undefined,
        },
      });
    } else {
      const dark = valueDarkener(pigments);
      tips.push({
        severity: Math.abs(dL),
        tip: {
          id: "value",
          text: `Your mix is ${magnitudeWord(dL, 10, 22)}too light — bring the value down with a touch of ${named(
            dark,
            "a dark pigment"
          )}.`,
          swatchHex: dark ? rgbToHex(dark.rgb) : undefined,
        },
      });
    }
  }

  // 2) Saturation (chroma) --------------------------------------------------
  const dC = chroma(t) - chroma(c); // + => target more saturated
  if (Math.abs(dC) >= 6) {
    if (dC < 0) {
      // current too saturated -> neutralize toward the complement, or fall
      // back to the most neutral earth in the palette
      const comp =
        pickByDirection(-c.a, -c.b, pigments) ?? mostNeutralEarth(pigments);
      tips.push({
        severity: Math.abs(dC),
        tip: {
          id: "saturation",
          text: `It's ${magnitudeWord(dC, 12, 28)}too saturated — knock it back with a touch of ${named(
            comp,
            "a neutral / earth tone"
          )}.`,
          swatchHex: comp ? rgbToHex(comp.rgb) : undefined,
        },
      });
    } else {
      // current too dull -> push toward the target's own hue
      const pure = pickByDirection(t.a, t.b, pigments);
      tips.push({
        severity: Math.abs(dC),
        tip: {
          id: "saturation",
          text: `It's ${magnitudeWord(dC, 12, 28)}too grey — intensify it with more ${named(
            pure,
            "a saturated pigment"
          )}.`,
          swatchHex: pure ? rgbToHex(pure.rgb) : undefined,
        },
      });
    }
  }

  // 3) Hue / temperature (angle in a*/b*) -----------------------------------
  // only meaningful if both colors carry some chroma
  if (chroma(t) > 4 && chroma(c) > 6) {
    const angle = hueAngleDiff(c, t); // degrees to rotate current toward target
    if (Math.abs(angle) >= 10) {
      // direction to push = target hue minus current hue, as an (a,b) vector
      const da = t.a - c.a;
      const db = t.b - c.b;
      const pig = pickByDirection(da, db, pigments);
      const warmer = t.b > c.b || t.a > c.a; // toward yellow/red reads warmer
      tips.push({
        severity: Math.abs(angle) / 3,
        tip: {
          id: "hue",
          text: `The hue leans off — it needs to go ${
            warmer ? "warmer" : "cooler"
          }. Nudge it with a touch of ${named(pig, "the right pigment")}.`,
          swatchHex: pig ? rgbToHex(pig.rgb) : undefined,
        },
      });
    }
  }

  tips.sort((a, b) => b.severity - a.severity);

  const headline =
    dE < 4
      ? "Very close — just fine-tune from here."
      : dE < 12
      ? "Close. A couple of adjustments and you'll have it."
      : "Not there yet — work through these in order.";

  return {
    deltaE: dE,
    match,
    onTarget: false,
    headline,
    tips: tips.length
      ? tips.map((x) => x.tip)
      : [
          {
            id: "done",
            text: "The differences are subtle — adjust by eye in tiny steps.",
          },
        ],
  };
}
