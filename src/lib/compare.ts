// Compare engine: align a reference photo and a work-in-progress photo via a
// 4-corner perspective warp, then analyze their differences in value and color.
// All analyses run on Lab fields sampled from the two aligned images.

import { rgbToLab, deltaE2000, clamp255, type RGB } from "./color";
import { translate, type Lang } from "./i18n";

export interface Pt {
  x: number;
  y: number;
}

// ---------- Homography (projective transform) ----------

// Solve a 3x3 homography H mapping src[i] -> dst[i] for 4 correspondences.
// Returns [h0..h7] with implicit h8 = 1.
export function solveHomography(src: Pt[], dst: Pt[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: xs, y: ys } = src[i];
    const { x: xd, y: yd } = dst[i];
    A.push([xs, ys, 1, 0, 0, 0, -xs * xd, -ys * xd]);
    b.push(xd);
    A.push([0, 0, 0, xs, ys, 1, -xs * yd, -ys * yd]);
    b.push(yd);
  }
  return solveLinear(A, b);
}

// Gaussian elimination with partial pivoting for an n x n system.
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col] || 1e-9;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / d;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-9));
}

function applyH(H: number[], x: number, y: number): Pt {
  const w = H[6] * x + H[7] * y + 1;
  return {
    x: (H[0] * x + H[1] * y + H[2]) / w,
    y: (H[3] * x + H[4] * y + H[5]) / w,
  };
}

// ---------- Warp ----------

// Draw an image to an offscreen canvas (capped) and return its ImageData.
function imageToData(img: HTMLImageElement, cap = 1400): ImageData {
  const scale = Math.min(1, cap / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function bilinear(src: ImageData, x: number, y: number, out: number[]) {
  const { width: w, height: h, data } = src;
  if (x < 0 || y < 0 || x > w - 1 || y > h - 1) {
    out[0] = out[1] = out[2] = 0;
    out[3] = 0;
    return;
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const fx = x - x0;
  const fy = y - y0;
  for (let k = 0; k < 4; k++) {
    const p00 = data[(y0 * w + x0) * 4 + k];
    const p10 = data[(y0 * w + x1) * 4 + k];
    const p01 = data[(y1 * w + x0) * 4 + k];
    const p11 = data[(y1 * w + x1) * 4 + k];
    const top = p00 + (p10 - p00) * fx;
    const bot = p01 + (p11 - p01) * fx;
    out[k] = top + (bot - top) * fy;
  }
}

// Warp the quad defined by `corners` (normalized 0..1, order TL,TR,BR,BL) of the
// image into an outW x outH rectangle (de-keystoned, pixel-aligned output).
export function warpImage(
  img: HTMLImageElement,
  corners: Pt[],
  outW: number,
  outH: number
): ImageData {
  const src = imageToData(img);
  const dstPts = corners.map((c) => ({ x: c.x * src.width, y: c.y * src.height }));
  const rectPts: Pt[] = [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: outW, y: outH },
    { x: 0, y: outH },
  ];
  // map output-rect coords -> source-photo coords
  const H = solveHomography(rectPts, dstPts);
  const out = new ImageData(outW, outH);
  const px: number[] = [0, 0, 0, 0];
  for (let v = 0; v < outH; v++) {
    for (let u = 0; u < outW; u++) {
      const s = applyH(H, u, v);
      bilinear(src, s.x, s.y, px);
      const i = (v * outW + u) * 4;
      out.data[i] = px[0];
      out.data[i + 1] = px[1];
      out.data[i + 2] = px[2];
      out.data[i + 3] = 255;
    }
  }
  return out;
}

// ---------- Lab field ----------

export interface LabField {
  L: Float32Array;
  a: Float32Array;
  b: Float32Array;
  w: number;
  h: number;
}

export function toLabField(data: ImageData): LabField {
  const n = data.width * data.height;
  const L = new Float32Array(n);
  const a = new Float32Array(n);
  const bb = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const lab = rgbToLab({
      r: data.data[i * 4],
      g: data.data[i * 4 + 1],
      b: data.data[i * 4 + 2],
    });
    L[i] = lab.L;
    a[i] = lab.a;
    bb[i] = lab.b;
  }
  return { L, a, b: bb, w: data.width, h: data.height };
}

function means(f: LabField) {
  let L = 0,
    a = 0,
    b = 0;
  const n = f.L.length;
  for (let i = 0; i < n; i++) {
    L += f.L[i];
    a += f.a[i];
    b += f.b[i];
  }
  return { L: L / n, a: a / n, b: b / n };
}

// Shift the wip field so its mean matches the reference — to compensate for
// different lighting/white balance between the two photos. `value` matches
// exposure (mean L); `color` matches white balance (mean a,b).
export function normalizeLighting(
  ref: LabField,
  wip: LabField,
  opts: { value: boolean; color: boolean }
): LabField {
  const mr = means(ref);
  const mw = means(wip);
  const dL = opts.value ? mr.L - mw.L : 0;
  const da = opts.color ? mr.a - mw.a : 0;
  const db = opts.color ? mr.b - mw.b : 0;
  const n = wip.L.length;
  const L = new Float32Array(n);
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    L[i] = wip.L[i] + dL;
    a[i] = wip.a[i] + da;
    b[i] = wip.b[i] + db;
  }
  return { L, a, b, w: wip.w, h: wip.h };
}

// ---------- Renderers (return ImageData to paint to a canvas) ----------

function labToGrayByte(L: number): number {
  // Lab L is ~0..100; map to 0..255 perceptually-ish (use L directly)
  return clamp255((L / 100) * 255);
}

export function renderGrayscale(f: LabField): ImageData {
  const out = new ImageData(f.w, f.h);
  for (let i = 0; i < f.L.length; i++) {
    const g = labToGrayByte(f.L[i]);
    out.data[i * 4] = g;
    out.data[i * 4 + 1] = g;
    out.data[i * 4 + 2] = g;
    out.data[i * 4 + 3] = 255;
  }
  return out;
}

// Posterize value into `steps` bands — the classic "notan" study.
export function renderNotan(f: LabField, steps: number): ImageData {
  const out = new ImageData(f.w, f.h);
  const s = Math.max(2, steps);
  for (let i = 0; i < f.L.length; i++) {
    const band = Math.round((f.L[i] / 100) * (s - 1)) / (s - 1);
    const g = clamp255(band * 255);
    out.data[i * 4] = g;
    out.data[i * 4 + 1] = g;
    out.data[i * 4 + 2] = g;
    out.data[i * 4 + 3] = 255;
  }
  return out;
}

// signed colormap: negative -> blue, 0 -> light grey, positive -> red
function signed(t: number, out: number[]) {
  const x = Math.max(-1, Math.min(1, t));
  if (x >= 0) {
    out[0] = 245;
    out[1] = clamp255(245 - x * 215);
    out[2] = clamp255(245 - x * 215);
  } else {
    out[0] = clamp255(245 + x * 215);
    out[1] = clamp255(245 + x * 110);
    out[2] = 245;
  }
}

// magnitude colormap: 0 -> light grey, max -> deep magenta/red
function magnitude(t: number, out: number[]) {
  const x = Math.max(0, Math.min(1, t));
  out[0] = clamp255(240 - x * 40);
  out[1] = clamp255(240 - x * 200);
  out[2] = clamp255(240 - x * 120);
}

export type DiffMetric = "value" | "deltaE" | "hue" | "temp" | "sat";

export interface DiffMap {
  image: ImageData;
  // legend: what the colors mean
  legend: { low: string; high: string; signedScale: boolean; unit: string };
}

const MAX = { value: 35, deltaE: 18, hue: 60, temp: 25, sat: 30 };

export function renderDiff(
  ref: LabField,
  wip: LabField,
  metric: DiffMetric,
  lang: Lang = "en"
): DiffMap {
  const out = new ImageData(ref.w, ref.h);
  const c: number[] = [0, 0, 0];
  const n = ref.L.length;
  for (let i = 0; i < n; i++) {
    let t = 0;
    let signedScale = true;
    if (metric === "value") {
      t = (wip.L[i] - ref.L[i]) / MAX.value;
    } else if (metric === "temp") {
      // warmer = +a and +b; cooler = the reverse
      const dWarm = (wip.a[i] - ref.a[i] + (wip.b[i] - ref.b[i])) / 2;
      t = dWarm / MAX.temp;
    } else if (metric === "sat") {
      const cr = Math.hypot(ref.a[i], ref.b[i]);
      const cw = Math.hypot(wip.a[i], wip.b[i]);
      t = (cw - cr) / MAX.sat;
    } else if (metric === "hue") {
      signedScale = false;
      const ar = Math.atan2(ref.b[i], ref.a[i]);
      const aw = Math.atan2(wip.b[i], wip.a[i]);
      let d = Math.abs(aw - ar) * (180 / Math.PI);
      if (d > 180) d = 360 - d;
      t = d / MAX.hue;
    } else {
      // deltaE
      signedScale = false;
      t =
        deltaE2000(
          { L: ref.L[i], a: ref.a[i], b: ref.b[i] },
          { L: wip.L[i], a: wip.a[i], b: wip.b[i] }
        ) / MAX.deltaE;
    }
    if (signedScale) signed(t, c);
    else magnitude(t, c);
    out.data[i * 4] = c[0];
    out.data[i * 4 + 1] = c[1];
    out.data[i * 4 + 2] = c[2];
    out.data[i * 4 + 3] = 255;
  }
  const L = (k: string) => translate(lang, k);
  const legends: Record<DiffMetric, DiffMap["legend"]> = {
    value: { low: L("compare.tooDark"), high: L("compare.tooLight"), signedScale: true, unit: "ΔL" },
    temp: { low: L("compare.tooCool"), high: L("compare.tooWarm"), signedScale: true, unit: "Δtemp" },
    sat: { low: L("compare.underSat"), high: L("compare.overSat"), signedScale: true, unit: "Δchroma" },
    hue: { low: L("compare.onHue"), high: L("compare.hueOff"), signedScale: false, unit: "Δhue°" },
    deltaE: { low: L("compare.matches"), high: L("compare.veryDiff"), signedScale: false, unit: "ΔE00" },
  };
  return { image: out, legend: legends[metric] };
}

// ---------- Histogram ----------

export function valueHistogram(f: LabField, bins = 24): number[] {
  const hist = new Array(bins).fill(0);
  for (let i = 0; i < f.L.length; i++) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((f.L[i] / 100) * bins)));
    hist[idx]++;
  }
  const max = Math.max(1, ...hist);
  return hist.map((v) => v / max); // normalized 0..1
}

// ---------- Scorecard ----------

export interface CompareScore {
  meanDE: number;
  valueBias: number; // + = wip lighter than ref
  tempBias: number; // + = wip warmer
  satBias: number; // + = wip more saturated
  valueScore: number; // 0..100
  colorScore: number; // 0..100
  sentence: string;
}

export function scoreCompare(
  ref: LabField,
  wip: LabField,
  lang: Lang = "en"
): CompareScore {
  const n = ref.L.length;
  let sumDE = 0,
    sumDL = 0,
    sumTemp = 0,
    sumSat = 0,
    sumAbsDL = 0;
  for (let i = 0; i < n; i++) {
    sumDE += deltaE2000(
      { L: ref.L[i], a: ref.a[i], b: ref.b[i] },
      { L: wip.L[i], a: wip.a[i], b: wip.b[i] }
    );
    const dL = wip.L[i] - ref.L[i];
    sumDL += dL;
    sumAbsDL += Math.abs(dL);
    sumTemp += (wip.a[i] - ref.a[i] + (wip.b[i] - ref.b[i])) / 2;
    sumSat += Math.hypot(wip.a[i], wip.b[i]) - Math.hypot(ref.a[i], ref.b[i]);
  }
  const meanDE = sumDE / n;
  const valueBias = sumDL / n;
  const tempBias = sumTemp / n;
  const satBias = sumSat / n;
  const meanAbsDL = sumAbsDL / n;

  const valueScore = Math.round(Math.max(0, 100 - meanAbsDL * 2.2));
  const colorScore = Math.round(Math.max(0, 100 - meanDE * 4));

  return {
    meanDE,
    valueBias,
    tempBias,
    satBias,
    valueScore,
    colorScore,
    sentence: buildSentence(valueBias, tempBias, satBias, meanAbsDL, lang),
  };
}

function buildSentence(
  valueBias: number,
  tempBias: number,
  satBias: number,
  meanAbsDL: number,
  lang: Lang
): string {
  const L = (k: string, p?: Record<string, string | number>) =>
    translate(lang, k, p);
  const mag = (v: number, mid: number, big: number) => {
    const a = Math.abs(v);
    return L(a >= big ? "compare.much" : a >= mid ? "compare.aBit" : "compare.slightlyW");
  };
  const parts: string[] = [];
  if (Math.abs(valueBias) >= 2) {
    parts.push(
      L("compare.valRun", {
        mag: mag(valueBias, 6, 14),
        dir: L(valueBias > 0 ? "compare.tooLight" : "compare.tooDark"),
      })
    );
  } else if (meanAbsDL >= 8) {
    parts.push(L("compare.valBalanced"));
  } else {
    parts.push(L("compare.valClose"));
  }
  if (Math.abs(tempBias) >= 2) {
    parts.push(
      L("compare.mixTemp", {
        mag: mag(tempBias, 5, 12),
        dir: L(tempBias > 0 ? "compare.warmer" : "compare.cooler"),
      })
    );
  }
  if (Math.abs(satBias) >= 3) {
    parts.push(
      L("compare.satState", {
        mag: mag(satBias, 6, 14),
        dir: L(satBias > 0 ? "compare.overSat" : "compare.underSat"),
      })
    );
  }
  if (parts.length === 1) parts.push(L("compare.colorMatched"));
  return capitalize(parts.join(", ")) + ".";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------- Region sampling ----------

export function sampleRegion(data: ImageData, nx: number, ny: number, r = 4): RGB {
  const cx = Math.round(nx * data.width);
  const cy = Math.round(ny * data.height);
  let R = 0,
    G = 0,
    B = 0,
    count = 0;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= data.width || y >= data.height) continue;
      const i = (y * data.width + x) * 4;
      R += data.data[i];
      G += data.data[i + 1];
      B += data.data[i + 2];
      count++;
    }
  }
  count = count || 1;
  return { r: Math.round(R / count), g: Math.round(G / count), b: Math.round(B / count) };
}

// Subsample an ImageData to a flat RGB[] for palette extraction.
export function dataToPixels(data: ImageData, maxSamples = 8000): RGB[] {
  const total = data.width * data.height;
  const step = Math.max(1, Math.floor(total / maxSamples));
  const out: RGB[] = [];
  for (let i = 0; i < total; i += step) {
    out.push({
      r: data.data[i * 4],
      g: data.data[i * 4 + 1],
      b: data.data[i * 4 + 2],
    });
  }
  return out;
}
