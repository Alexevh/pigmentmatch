// Painting coach: compares the painter's current mixture to the target and
// gives directional, instructional advice — "lift the value", "it's a touch
// too warm, cool it with Ultramarine" — the way a teacher standing behind you
// would. Pure rules over CIE Lab deltas; no data or network needed.

import {
  rgbToLab,
  rgbToHex,
  deltaE2000,
  matchScore,
  type RGB,
  type Lab,
} from "./color";
import type { Pigment } from "./pigments";
import { translate, type Lang } from "./i18n";

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

export function coach(
  target: RGB,
  current: RGB,
  pigments: Pigment[],
  lang: Lang = "en"
): CoachResult {
  const tr = (k: string, p?: Record<string, string | number>) =>
    translate(lang, k, p);
  const named = (pig: Pigment | null, fallbackKey: string) =>
    pig?.name ?? tr(fallbackKey);
  const magWord = (v: number, mid: number, big: number) => {
    const a = Math.abs(v);
    return tr(a >= big ? "coach.much" : a >= mid ? "coach.aBit" : "coach.slightly");
  };

  const t = rgbToLab(target);
  const c = rgbToLab(current);
  const dE = deltaE2000(t, c);
  const match = matchScore(dE);

  if (dE < 1.5) {
    return {
      deltaE: dE,
      match,
      onTarget: true,
      headline: tr("coach.headlineThere"),
      tips: [{ id: "done", text: tr("coach.done") }],
    };
  }

  const tips: { tip: CoachTip; severity: number }[] = [];

  // 1) Value (lightness)
  const dL = t.L - c.L;
  if (Math.abs(dL) >= 4) {
    if (dL > 0) {
      const white = lightestPigment(pigments);
      tips.push({
        severity: Math.abs(dL),
        tip: {
          id: "value",
          text: tr("coach.tooDark", {
            mag: magWord(dL, 10, 22),
            pig: named(white, "coach.white"),
          }),
          swatchHex: white ? rgbToHex(white.rgb) : undefined,
        },
      });
    } else {
      const dark = valueDarkener(pigments);
      tips.push({
        severity: Math.abs(dL),
        tip: {
          id: "value",
          text: tr("coach.tooLight", {
            mag: magWord(dL, 10, 22),
            pig: named(dark, "coach.darkPigment"),
          }),
          swatchHex: dark ? rgbToHex(dark.rgb) : undefined,
        },
      });
    }
  }

  // 2) Saturation (chroma)
  const dC = chroma(t) - chroma(c);
  if (Math.abs(dC) >= 6) {
    if (dC < 0) {
      const comp =
        pickByDirection(-c.a, -c.b, pigments) ?? mostNeutralEarth(pigments);
      tips.push({
        severity: Math.abs(dC),
        tip: {
          id: "saturation",
          text: tr("coach.tooSat", {
            mag: magWord(dC, 12, 28),
            pig: named(comp, "coach.neutralEarth"),
          }),
          swatchHex: comp ? rgbToHex(comp.rgb) : undefined,
        },
      });
    } else {
      const pure = pickByDirection(t.a, t.b, pigments);
      tips.push({
        severity: Math.abs(dC),
        tip: {
          id: "saturation",
          text: tr("coach.tooDull", {
            mag: magWord(dC, 12, 28),
            pig: named(pure, "coach.satPigment"),
          }),
          swatchHex: pure ? rgbToHex(pure.rgb) : undefined,
        },
      });
    }
  }

  // 3) Hue / temperature
  if (chroma(t) > 4 && chroma(c) > 6) {
    const angle = hueAngleDiff(c, t);
    if (Math.abs(angle) >= 10) {
      const da = t.a - c.a;
      const db = t.b - c.b;
      const pig = pickByDirection(da, db, pigments);
      const warmer = t.b > c.b || t.a > c.a;
      tips.push({
        severity: Math.abs(angle) / 3,
        tip: {
          id: "hue",
          text: tr(warmer ? "coach.hueWarmer" : "coach.hueCooler", {
            pig: named(pig, "coach.rightPigment"),
          }),
          swatchHex: pig ? rgbToHex(pig.rgb) : undefined,
        },
      });
    }
  }

  tips.sort((a, b) => b.severity - a.severity);

  const headline =
    dE < 4
      ? tr("coach.headlineVeryClose")
      : dE < 12
      ? tr("coach.headlineClose")
      : tr("coach.headlineFar");

  return {
    deltaE: dE,
    match,
    onTarget: false,
    headline,
    tips: tips.length
      ? tips.map((x) => x.tip)
      : [{ id: "done", text: tr("coach.subtle") }],
  };
}
