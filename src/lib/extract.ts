// Dominant-color extraction from an image via k-means clustering in Lab space
// (perceptually meaningful), plus painterly relationship hints between colors.

import { rgbToLab, deltaE, type RGB, type Lab } from "./color";
import type { Pigment } from "./pigments";
import { translate, type Lang } from "./i18n";

// Pull pixels from an already-loaded image, downsampled for speed.
export function samplePixels(
  img: HTMLImageElement,
  maxSamples = 12000
): RGB[] {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, Math.sqrt(maxSamples / (img.width * img.height)));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const out: RGB[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // skip transparent
    out.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
  }
  return out;
}

interface LabPoint extends Lab {
  rgb: RGB;
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
