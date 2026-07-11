// Dominant-color extraction from an image via k-means clustering in Lab space
// (perceptually meaningful), plus painterly relationship hints between colors.

import { rgbToLab, labToRgb, deltaE, type RGB, type Lab } from "./color";
import type { Pigment } from "./pigments";
import { translate, type Lang } from "./i18n";

interface LabPoint extends Lab {
  rgb: RGB;
}

// ---------- Value study (notan planes) ----------

export interface ValuePlane {
  mean: RGB; // average color of the plane (Lab mean → sRGB)
  centerL: number; // the plane's value center (for classifying pixels)
  loL: number;
  hiL: number;
  share: number; // fraction of the image's pixels in this plane (0..1)
}

// Group an image's pixels into k VALUE planes (the painter's notan): a
// deterministic 1D k-means on L*, so the planes follow the image's own value
// clusters instead of fixed thresholds. Returns planes sorted light → dark;
// empty clusters are dropped (an image can have fewer real planes than k).
export function valuePlanes(pixels: RGB[], k: number): ValuePlane[] {
  if (!pixels.length || k < 2) return [];
  const labs = pixels.map(rgbToLab);
  const centers = Array.from(
    { length: k },
    (_, i) => 5 + (90 * i) / (k - 1) // evenly spread over the value range
  );
  const assign = new Array<number>(labs.length).fill(0);
  for (let iter = 0; iter < 16; iter++) {
    let changed = false;
    for (let i = 0; i < labs.length; i++) {
      let bi = 0;
      let bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = Math.abs(labs[i].L - centers[c]);
        if (d < bd) {
          bd = d;
          bi = c;
        }
      }
      if (assign[i] !== bi) {
        assign[i] = bi;
        changed = true;
      }
    }
    const sums = new Array<number>(centers.length).fill(0);
    const counts = new Array<number>(centers.length).fill(0);
    for (let i = 0; i < labs.length; i++) {
      sums[assign[i]] += labs[i].L;
      counts[assign[i]]++;
    }
    for (let c = 0; c < centers.length; c++)
      if (counts[c] > 0) centers[c] = sums[c] / counts[c];
    if (!changed) break;
  }

  const agg = centers.map(() => ({
    L: 0,
    a: 0,
    b: 0,
    n: 0,
    lo: Infinity,
    hi: -Infinity,
  }));
  for (let i = 0; i < labs.length; i++) {
    const a = agg[assign[i]];
    a.L += labs[i].L;
    a.a += labs[i].a;
    a.b += labs[i].b;
    a.n++;
    a.lo = Math.min(a.lo, labs[i].L);
    a.hi = Math.max(a.hi, labs[i].L);
  }
  return agg
    .filter((a) => a.n > 0)
    .map((a) => ({
      mean: labToRgb({ L: a.L / a.n, a: a.a / a.n, b: a.b / a.n }),
      centerL: a.L / a.n,
      loL: a.lo,
      hiL: a.hi,
      share: a.n / labs.length,
    }))
    .sort((x, y) => y.centerL - x.centerL);
}

export function extractPalette(pixels: RGB[], k: number): RGB[] {
  if (pixels.length === 0) return [];
  const pts: LabPoint[] = pixels.map((rgb) => ({ ...rgbToLab(rgb), rgb }));

  // deterministic k-means++ style init using evenly spaced picks
  const centers: Lab[] = [];
  centers.push({ ...pts[0] });
  while (centers.length < k && centers.length < pts.length) {
    // pick the point farthest from existing centers
    let far = pts[0];
    let farD = -1;
    for (let s = 0; s < pts.length; s += Math.max(1, (pts.length / 800) | 0)) {
      const p = pts[s];
      let nearest = Infinity;
      for (const c of centers) {
        const d = deltaE(p, c);
        if (d < nearest) nearest = d;
      }
      if (nearest > farD) {
        farD = nearest;
        far = p;
      }
    }
    centers.push({ L: far.L, a: far.a, b: far.b });
  }

  const assign = new Array(pts.length).fill(0);
  for (let iter = 0; iter < 12; iter++) {
    // assignment
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = deltaE(pts[i], centers[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assign[i] !== best) {
        assign[i] = best;
        moved = true;
      }
    }
    // update
    const sums = centers.map(() => ({ L: 0, a: 0, b: 0, n: 0 }));
    for (let i = 0; i < pts.length; i++) {
      const s = sums[assign[i]];
      s.L += pts[i].L;
      s.a += pts[i].a;
      s.b += pts[i].b;
      s.n += 1;
    }
    for (let c = 0; c < centers.length; c++) {
      if (sums[c].n > 0) {
        centers[c] = {
          L: sums[c].L / sums[c].n,
          a: sums[c].a / sums[c].n,
          b: sums[c].b / sums[c].n,
        };
      }
    }
    if (!moved) break;
  }

  // represent each cluster by its closest actual pixel (avoids muddy averages)
  const counts = centers.map(() => 0);
  for (const a of assign) counts[a] += 1;

  const result: { rgb: RGB; count: number }[] = centers.map((c, idx) => {
    let best = pts[0];
    let bestD = Infinity;
    for (let i = 0; i < pts.length; i++) {
      if (assign[i] !== idx) continue;
      const d = deltaE(pts[i], c);
      if (d < bestD) {
        bestD = d;
        best = pts[i];
      }
    }
    return { rgb: best.rgb, count: counts[idx] };
  });

  // drop empty clusters, sort light -> dark
  return result
    .filter((r) => r.count > 0)
    .sort((a, b) => rgbToLab(b.rgb).L - rgbToLab(a.rgb).L)
    .map((r) => r.rgb);
}

// ---------- Relationship hints ----------
// Given a list of extracted colors, suggest how to reach one from another
// (or from a pigment) using painter language.

export function relationshipHint(
  target: RGB,
  others: RGB[],
  pigments: Pigment[],
  lang: Lang = "en"
): string | null {
  const L = (k: string, p?: Record<string, string | number>) =>
    translate(lang, k, p);
  const tl = rgbToLab(target);
  // find the nearest *other* color
  let nearest: RGB | null = null;
  let nearestD = Infinity;
  let nearestIdx = -1;
  others.forEach((o, i) => {
    if (o === target) return;
    const d = deltaE(tl, rgbToLab(o));
    if (d < nearestD) {
      nearestD = d;
      nearest = o;
      nearestIdx = i;
    }
  });
  if (!nearest || nearestD > 30) return null;

  const ol = rgbToLab(nearest as RGB);
  const dL = tl.L - ol.L;
  const dA = tl.a - ol.a;
  const dB = tl.b - ol.b;

  // pick the pigment that best matches the direction of change
  const push = pickDirectionPigment(dA, dB, dL, pigments, lang);
  const lighten =
    dL > 6 ? L("extract.lightening") : dL < -6 ? L("extract.darkening") : null;

  const from = L("extract.colorN", { n: nearestIdx + 1 });
  if (push) {
    const extra = lighten ? ` ${L("extract.and")} ${lighten}` : "";
    return L("extract.hintAdd", { from, push, extra });
  }
  if (lighten) return L("extract.hintAdjust", { from, extra: lighten });
  return L("extract.hintVeryClose", { from });
}

function pickDirectionPigment(
  dA: number,
  dB: number,
  dL: number,
  pigments: Pigment[],
  lang: Lang
): string | null {
  // describe the needed shift and find a pigment whose hue pushes that way
  const wantRed = dA > 8;
  const wantGreen = dA < -8;
  const wantYellow = dB > 8;
  const wantBlue = dB < -8;

  const byName = (frag: string) =>
    pigments.find((p) => p.name.toLowerCase().includes(frag))?.name;

  if (wantBlue)
    return byName("ultramarine") || byName("blue") || translate(lang, "extract.coolBlue");
  if (wantYellow)
    return byName("ochre") || byName("yellow") || translate(lang, "extract.warmYellow");
  if (wantRed) return byName("red") || byName("crimson") || translate(lang, "extract.aRed");
  if (wantGreen) return byName("green") || null;
  if (Math.abs(dL) > 6) return byName("white") || byName("umber") || null;
  return null;
}
