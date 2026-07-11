// Scene / Zone mode (optional, additive): analyze a region of a reference
// RELATIVE to a profile of the whole image, so recommendations account for the
// painting's light — e.g. "warm light ⇒ cool the shadows" — instead of just
// matching a pixel. Pure Lab math, no deps, no AI. See SCENE_MODE_SPEC.md.

import { rgbToLab, labToRgb, rgbToHex, type RGB, type Lab } from "./color";
import { translate, type Lang } from "./i18n";
import type { Pigment } from "./pigments";

// Warm/cool scalar in Lab: +b yellow (warm), −b blue (cool); +a red (warm),
// −a green (cool). Positive = warm.
export function warmCool(lab: Lab): number {
  return 0.4 * lab.a + 0.6 * lab.b;
}

const chroma = (lab: Lab) => Math.hypot(lab.a, lab.b);

export interface SceneProfile {
  split: number; // L* threshold light/shadow
  lightLab: Lab;
  shadowLab: Lab;
  lightTemp: number;
  shadowTemp: number;
  tempSpread: number; // |lightTemp − shadowTemp|
  polarity: "warm-light" | "cool-light" | "flat";
  chromaMean: number;
  chromaMax: number;
  key: "high" | "mid" | "low";
}

// Otsu threshold on an L* histogram (0..100 → 64 bins).
function otsu(ls: number[]): number {
  const BINS = 64;
  const hist = new Array(BINS).fill(0);
  for (const l of ls) hist[Math.min(BINS - 1, Math.max(0, Math.floor((l / 100) * BINS)))]++;
  const total = ls.length || 1;
  let sum = 0;
  for (let i = 0; i < BINS; i++) sum += i * hist[i];
  // between-class variance per bin
  const bc = new Array(BINS).fill(0);
  let sumB = 0,
    wB = 0,
    maxVar = 0;
  for (let i = 0; i < BINS; i++) {
    wB += hist[i];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    bc[i] = between;
    if (between > maxVar) maxVar = between;
  }
  // Two tight clusters give a flat max across the whole gap between them; take
  // the MIDDLE of that plateau so the split lands in the gap, not at a cluster
  // edge (which would misclassify mid-darks).
  let first = BINS / 2,
    last = BINS / 2,
    found = false;
  for (let i = 0; i < BINS; i++) {
    if (bc[i] >= maxVar * 0.999 && maxVar > 0) {
      if (!found) {
        first = i;
        found = true;
      }
      last = i;
    }
  }
  // Otsu's threshold bin t belongs to the BACKGROUND (shadow) class, and
  // buildSceneProfile classifies `shadow = L < split` — so the split must be
  // the chosen bin's UPPER edge ((t+1)/BINS), not its lower edge, or every
  // pixel inside the threshold bin itself would flip to the light class.
  return (((first + last) / 2 + 1) / BINS) * 100;
}

function meanLab(labs: Lab[]): Lab {
  if (!labs.length) return { L: 50, a: 0, b: 0 };
  let L = 0,
    a = 0,
    b = 0;
  for (const l of labs) {
    L += l.L;
    a += l.a;
    b += l.b;
  }
  return { L: L / labs.length, a: a / labs.length, b: b / labs.length };
}

export function buildSceneProfile(pixels: RGB[]): SceneProfile {
  const labs = pixels.map(rgbToLab);
  const ls = labs.map((l) => l.L);
  const split = labs.length ? otsu(ls) : 50;
  const light = labs.filter((l) => l.L >= split);
  const shadow = labs.filter((l) => l.L < split);
  const lightLab = meanLab(light.length ? light : labs);
  const shadowLab = meanLab(shadow.length ? shadow : labs);
  const lightTemp = warmCool(lightLab);
  const shadowTemp = warmCool(shadowLab);
  const tempSpread = Math.abs(lightTemp - shadowTemp);
  const chromas = labs.map(chroma).sort((a, b) => a - b);
  const chromaMean = chromas.length
    ? chromas.reduce((s, c) => s + c, 0) / chromas.length
    : 0;
  const chromaMax = chromas.length ? chromas[Math.floor(chromas.length * 0.95)] : 0;
  const meanL = ls.length ? ls.reduce((s, l) => s + l, 0) / ls.length : 50;
  return {
    split,
    lightLab,
    shadowLab,
    lightTemp,
    shadowTemp,
    tempSpread,
    polarity:
      tempSpread < 2 ? "flat" : lightTemp > shadowTemp ? "warm-light" : "cool-light",
    chromaMean,
    chromaMax,
    key: meanL >= 62 ? "high" : meanL <= 38 ? "low" : "mid",
  };
}

export interface ZoneAnalysis {
  mean: RGB;
  lab: Lab;
  contrast: number; // stdev of L*
  family: "light" | "halftone" | "shadow";
  chromaRel: number; // zone chroma − scene chroma mean
  warm: number;
}

export function analyzeZone(pixels: RGB[], profile: SceneProfile): ZoneAnalysis {
  const labs = pixels.map(rgbToLab);
  const lab = meanLab(labs);
  const mL = lab.L;
  const variance =
    labs.length > 1
      ? labs.reduce((s, l) => s + (l.L - mL) * (l.L - mL), 0) / labs.length
      : 0;
  const delta = 6;
  const family =
    lab.L >= profile.split + delta
      ? "light"
      : lab.L <= profile.split - delta
      ? "shadow"
      : "halftone";
  return {
    mean: labToRgb(lab),
    lab,
    contrast: Math.sqrt(variance),
    family,
    chromaRel: chroma(lab) - profile.chromaMean,
    warm: warmCool(lab),
  };
}

export interface SceneAdvice {
  adjustedRgb: RGB;
  addPigment: { pigment: Pigment; percent: number } | null;
  headline: string;
  tips: { id: string; text: string; swatchHex?: string }[];
}

// Nudge a Lab color warmer (+) or cooler (−) along the warm/cool axis by `amt`.
function shiftTemp(lab: Lab, amt: number): Lab {
  return { L: lab.L, a: lab.a + 0.4 * amt, b: lab.b + 0.6 * amt };
}

// Context-aware advice for a zone within the scene.
export function sceneAdvice(
  zone: ZoneAnalysis,
  profile: SceneProfile,
  pigments: Pigment[],
  lang: Lang
): SceneAdvice {
  const t = (k: string, p?: Record<string, string | number>) =>
    translate(lang, k, p);
  const tips: SceneAdvice["tips"] = [];
  let adjusted = zone.lab;

  // --- flagship: warm/cool relational nudge ---
  // In a warm-light scene, shadows should lean cool (and vice-versa). If the
  // zone's temperature doesn't match its family's expected bias, nudge it.
  if (profile.polarity !== "flat" && zone.family !== "halftone") {
    const warmLight = profile.polarity === "warm-light";
    // A shadow in a warm-light scene should be cooler; a light should be warmer.
    const wantCooler =
      (warmLight && zone.family === "shadow") ||
      (!warmLight && zone.family === "light");
    const familyTemp =
      zone.family === "shadow" ? profile.shadowTemp : profile.lightTemp;
    const off = zone.warm - familyTemp; // how far the zone is from its family
    // Only advise when the zone is on the "wrong" side by a meaningful amount.
    const meaningful = Math.min(12, Math.max(0, wantCooler ? off : -off));
    if (meaningful > 1.5) {
      const dir = wantCooler ? -1 : 1;
      const amt = dir * (2 + meaningful * 0.8);
      adjusted = shiftTemp(zone.lab, amt);
      // pick the coolest / warmest pigment actually in the palette
      const scored = pigments
        .map((p) => ({ p, w: warmCool(rgbToLab(p.rgb)) }))
        .sort((a, b) => (wantCooler ? a.w - b.w : b.w - a.w));
      const pick = scored[0]?.p ?? null;
      const percent = Math.round(Math.min(6, 2 + meaningful * 0.4));
      const addPigment = pick ? { pigment: pick, percent } : null;
      tips.push({
        id: "temp",
        text: t(wantCooler ? "scene.tipCool" : "scene.tipWarm", {
          family: t(`scene.fam_${zone.family}`),
          name: pick?.name ?? "",
          percent,
        }),
        swatchHex: pick ? rgbToHex(pick.rgb) : undefined,
      });
      return {
        adjustedRgb: labToRgb(adjusted),
        addPigment,
        headline: t("scene.headlineAdjust"),
        tips: withSecondary(tips, zone, t),
      };
    }
  }

  // no temperature change needed
  return {
    adjustedRgb: labToRgb(adjusted),
    addPigment: null,
    headline: t("scene.headlineOk"),
    tips: withSecondary(tips, zone, t),
  };
}

function withSecondary(
  tips: SceneAdvice["tips"],
  zone: ZoneAnalysis,
  t: (k: string, p?: Record<string, string | number>) => string
): SceneAdvice["tips"] {
  // chroma: a shadow / turning form that's more saturated than the scene mean
  if (zone.family === "shadow" && zone.chromaRel > 8)
    tips.push({ id: "chroma", text: t("scene.tipChroma") });
  // value placement
  tips.push({
    id: "value",
    text: t(`scene.val_${zone.family}`),
  });
  return tips;
}
