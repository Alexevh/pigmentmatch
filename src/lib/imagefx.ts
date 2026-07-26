// Local image processing for the IMG Lab: pixel adjustments (no deps), a set
// of classic artistic/corrective filters (Kuwahara oil, bilateral, Lab
// posterize, XDoG ink, CLAHE, illumination flattening, impasto relief — all
// pure, deterministic, published algorithms), plus optional AI (UpscalerJS +
// TF.js, lazy-loaded only when invoked). Everything runs in the browser — no
// backend.

import { rgbToLab, labToRgb } from "./color";

export interface Adjust {
  sharpen: number; // 0..100
  brightness: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
  temperature: number; // -100..100 (warm +)
}

export const DEFAULT_ADJUST: Adjust = {
  sharpen: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
};

export const adjustActive = (a: Adjust) =>
  a.sharpen !== 0 ||
  a.brightness !== 0 ||
  a.contrast !== 0 ||
  a.saturation !== 0 ||
  a.temperature !== 0;

const clampByte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

// Structural ImageData (width/height/data) so the pure filters are testable in
// node, where the DOM ImageData constructor doesn't exist.
export interface PixelGrid {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

// ---------- Shared helpers for the artistic filters ----------

const lumOf = (d: Uint8ClampedArray, i: number) =>
  0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

// Separable gaussian blur of a Float32 luminance field (small sigmas).
function gaussianBlur(
  src: Float32Array,
  w: number,
  h: number,
  sigma: number
): Float32Array {
  const r = Math.max(1, Math.ceil(sigma * 2.5));
  const kernel = new Float32Array(2 * r + 1);
  let ks = 0;
  for (let i = -r; i <= r; i++) {
    kernel[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
    ks += kernel[i + r];
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= ks;
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) {
        const xx = Math.min(w - 1, Math.max(0, x + i));
        s += src[y * w + xx] * kernel[i + r];
      }
      tmp[y * w + x] = s;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) {
        const yy = Math.min(h - 1, Math.max(0, y + i));
        s += tmp[yy * w + x] * kernel[i + r];
      }
      out[y * w + x] = s;
    }
  return out;
}

// Iterated box blur ≈ gaussian with a LARGE radius, in O(n) per pass — used
// where sigma would make a true gaussian kernel huge (illumination field).
function boxBlurBig(
  src: Float32Array,
  w: number,
  h: number,
  radius: number,
  passes = 3
): Float32Array {
  let cur = src.slice();
  let tmp = new Float32Array(src.length);
  const r = Math.max(1, Math.round(radius));
  for (let p = 0; p < passes; p++) {
    // horizontal running sum
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += cur[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = acc / (2 * r + 1);
        const out = Math.max(0, x - r);
        const inn = Math.min(w - 1, x + r + 1);
        acc += cur[y * w + inn] - cur[y * w + out];
      }
    }
    // vertical running sum
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        cur[y * w + x] = acc / (2 * r + 1);
        const out = Math.max(0, y - r);
        const inn = Math.min(h - 1, y + r + 1);
        acc += tmp[inn * w + x] - tmp[out * w + x];
      }
    }
  }
  return cur;
}

function lumField(base: PixelGrid): Float32Array {
  const { width: w, height: h, data } = base;
  const L = new Float32Array(w * h);
  for (let p = 0, i = 0; p < L.length; p++, i += 4) L[p] = lumOf(data, i);
  return L;
}

// Scale each pixel's RGB by newLum/oldLum (hue-preserving luminance remap).
function remapLuminance(
  base: PixelGrid,
  newL: (p: number) => number
): Uint8ClampedArray {
  const { data } = base;
  const out = new Uint8ClampedArray(data.length);
  for (let p = 0, i = 0; i < data.length; p++, i += 4) {
    const oldL = Math.max(1e-3, lumOf(data, i));
    const f = Math.max(0, newL(p)) / oldL;
    out[i] = clampByte(Math.round(data[i] * f));
    out[i + 1] = clampByte(Math.round(data[i + 1] * f));
    out[i + 2] = clampByte(Math.round(data[i + 2] * f));
    out[i + 3] = data[i + 3];
  }
  return out;
}

// ---------- Bilateral filter (edge-preserving smoothing, "watercolor") ----------
// Smooths color inside regions but not across edges: each output pixel is a
// weighted mean where weight = spatial gaussian × similarity gaussian. Softer,
// washier look than Kuwahara (no hard daubs).
export function bilateralImage(
  base: PixelGrid,
  radius = 4,
  sigmaColor = 28,
  passes = 2
): Uint8ClampedArray {
  // One pass is nearly invisible on a photo; the watercolor look comes from
  // ITERATING the filter (each pass flattens regions further while edges hold).
  let cur = base;
  let out = base.data;
  for (let p = 0; p < Math.max(1, passes); p++) {
    out = bilateralPass(cur, radius, sigmaColor);
    cur = { width: base.width, height: base.height, data: out };
  }
  return out;
}

function bilateralPass(
  base: PixelGrid,
  radius: number,
  sigmaColor: number
): Uint8ClampedArray {
  const { width: w, height: h, data } = base;
  const r = Math.max(1, Math.round(radius));
  const spatial = new Float32Array((2 * r + 1) * (2 * r + 1));
  const sigS = r / 1.6;
  for (let dy = -r, k = 0; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++, k++)
      spatial[k] = Math.exp(-(dx * dx + dy * dy) / (2 * sigS * sigS));
  // range LUT over luminance difference 0..255
  const range = new Float32Array(256);
  for (let i = 0; i < 256; i++)
    range[i] = Math.exp(-(i * i) / (2 * sigmaColor * sigmaColor));
  const L = lumField(base);
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const lc = L[p];
      let sr = 0,
        sg = 0,
        sb = 0,
        sw = 0;
      for (let dy = -r, k = 0; dy <= r; dy++) {
        const yy = Math.min(h - 1, Math.max(0, y + dy));
        for (let dx = -r; dx <= r; dx++, k++) {
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          const q = yy * w + xx;
          const wgt = spatial[k] * range[Math.min(255, Math.abs(L[q] - lc) | 0)];
          const j = q * 4;
          sr += data[j] * wgt;
          sg += data[j + 1] * wgt;
          sb += data[j + 2] * wgt;
          sw += wgt;
        }
      }
      const i = p * 4;
      out[i] = clampByte(Math.round(sr / sw));
      out[i + 1] = clampByte(Math.round(sg / sw));
      out[i + 2] = clampByte(Math.round(sb / sw));
      out[i + 3] = data[i + 3];
    }
  return out;
}

// ---------- Lab posterize (perceptual value planes, in color) ----------
// Quantizes L* into `levels` bands (keeping a*/b*), i.e. the notan idea but on
// the full-color image — "paint by value planes".
export function posterizeLabImage(base: PixelGrid, levels = 5): Uint8ClampedArray {
  const { data } = base;
  const n = Math.max(2, Math.round(levels));
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const lab = rgbToLab({ r: data[i], g: data[i + 1], b: data[i + 2] });
    const band = Math.min(n - 1, Math.floor((lab.L / 100.0001) * n));
    const L = ((band + 0.5) / n) * 100;
    const rgb = labToRgb({ L, a: lab.a, b: lab.b });
    out[i] = rgb.r;
    out[i + 1] = rgb.g;
    out[i + 2] = rgb.b;
    out[i + 3] = data[i + 3];
  }
  return out;
}

// ---------- XDoG ink lines (Winnemöller eXtended Difference-of-Gaussians) ----
// Organic ink-like line art: D = G_σ − τ·G_kσ on luminance; values above the
// threshold stay paper-white, below it roll off through tanh for soft, brushy
// strokes. `detail` (0..100) sets σ (higher = finer lines picked up);
// `ink` (0..100) sets how dark/heavy the strokes render.
export function xdogImage(
  base: PixelGrid,
  detail = 50,
  ink = 60
): Uint8ClampedArray {
  const { width: w, height: h, data } = base;
  const sigma = 0.6 + ((100 - Math.min(100, Math.max(0, detail))) / 100) * 2.2; // 0.6..2.8
  const K = 1.6;
  const TAU = 0.98;
  const EPS = 2.2;
  const phi = 0.03 + (Math.min(100, Math.max(0, ink)) / 100) * 0.25;
  const L = lumField(base);
  const g1 = gaussianBlur(L, w, h, sigma);
  const g2 = gaussianBlur(L, w, h, sigma * K);
  const out = new Uint8ClampedArray(data.length);
  for (let p = 0, i = 0; p < L.length; p++, i += 4) {
    const d = g1[p] - TAU * g2[p];
    const v = d >= EPS ? 1 : 1 + Math.tanh(phi * (d - EPS));
    const byte = clampByte(Math.round(v * 255));
    out[i] = out[i + 1] = out[i + 2] = byte;
    out[i + 3] = data[i + 3];
  }
  return out;
}

// ---------- CLAHE (contrast-limited adaptive histogram equalization) --------
// Recovers detail in shadows/highlights of a badly exposed reference without
// shifting global color: per-tile luminance histograms, clipped (so noise
// isn't amplified), equalized, and bilinearly blended between tiles.
export function claheImage(base: PixelGrid, clip = 2.5): Uint8ClampedArray {
  const { width: w, height: h } = base;
  const TILES = 8;
  const BINS = 256;
  const L = lumField(base);
  const tw = w / TILES;
  const th = h / TILES;
  // per-tile clipped CDF → lookup tables
  const luts: Float32Array[] = [];
  for (let ty = 0; ty < TILES; ty++)
    for (let tx = 0; tx < TILES; tx++) {
      const x0 = Math.floor(tx * tw);
      const x1 = Math.min(w, Math.floor((tx + 1) * tw));
      const y0 = Math.floor(ty * th);
      const y1 = Math.min(h, Math.floor((ty + 1) * th));
      const hist = new Float32Array(BINS);
      let count = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          hist[Math.min(BINS - 1, L[y * w + x] | 0)]++;
          count++;
        }
      const limit = Math.max(1, (clip * count) / BINS);
      let excess = 0;
      for (let b = 0; b < BINS; b++)
        if (hist[b] > limit) {
          excess += hist[b] - limit;
          hist[b] = limit;
        }
      const add = excess / BINS;
      const lut = new Float32Array(BINS);
      let cdf = 0;
      for (let b = 0; b < BINS; b++) {
        cdf += hist[b] + add;
        lut[b] = (cdf / Math.max(1, count)) * 255;
      }
      luts.push(lut);
    }
  const lutAt = (tx: number, ty: number) =>
    luts[Math.min(TILES - 1, Math.max(0, ty)) * TILES + Math.min(TILES - 1, Math.max(0, tx))];
  return remapLuminance(base, (p) => {
    const x = p % w;
    const y = (p / w) | 0;
    const fx = x / tw - 0.5;
    const fy = y / th - 0.5;
    const tx0 = Math.floor(fx);
    const ty0 = Math.floor(fy);
    const ax = fx - tx0;
    const ay = fy - ty0;
    const b = Math.min(BINS - 1, L[p] | 0);
    const v00 = lutAt(tx0, ty0)[b];
    const v10 = lutAt(tx0 + 1, ty0)[b];
    const v01 = lutAt(tx0, ty0 + 1)[b];
    const v11 = lutAt(tx0 + 1, ty0 + 1)[b];
    return (
      v00 * (1 - ax) * (1 - ay) + v10 * ax * (1 - ay) + v01 * (1 - ax) * ay + v11 * ax * ay
    );
  });
}

// ---------- Illumination flattening (single-scale retinex) -------------------
// Estimates the lighting field as a heavy blur of luminance and divides it
// out, pulling every region toward the image's mean brightness — evens out a
// side-lit reference so the OBJECT's values are easier to read. strength 0..100.
export function flattenLightImage(
  base: PixelGrid,
  strength = 60
): Uint8ClampedArray {
  const { width: w, height: h } = base;
  const L = lumField(base);
  const field = boxBlurBig(L, w, h, Math.max(8, Math.round(Math.min(w, h) / 6)));
  let mean = 0;
  for (let p = 0; p < L.length; p++) mean += L[p];
  mean /= L.length;
  const s = Math.min(100, Math.max(0, strength)) / 100;
  return remapLuminance(base, (p) => {
    const flat = (L[p] / Math.max(1e-3, field[p])) * mean;
    return L[p] * (1 - s) + flat * s;
  });
}

// ---------- Impasto relief -----------------------------------------------------
// Fakes the thickness of paint: lights the luminance gradient from the top-left
// (classic relief/emboss) and adds it back over the color — reads as ridged
// brush texture. Best stacked on the oil filter. strength 0..100.
export function impastoImage(base: PixelGrid, strength = 40): Uint8ClampedArray {
  const { width: w, height: h, data } = base;
  // Per-pixel central differences on a photo are a few luminance units — an
  // invisible relief. Take the gradient of a LIGHTLY BLURRED field (kills
  // noise sparkle) at a ±2px baseline and amplify properly, so strokes read
  // as ridged paint instead of nothing.
  const L = gaussianBlur(lumField(base), w, h, 1);
  const s = (Math.min(100, Math.max(0, strength)) / 100) * 2.4;
  const out = new Uint8ClampedArray(data.length);
  const at = (x: number, y: number) =>
    L[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      // light from the top-left: gradient toward it is lit, away is shaded
      const relief =
        (at(x - 2, y) - at(x + 2, y) + (at(x, y - 2) - at(x, y + 2))) * 0.5 * s;
      const i = (y * w + x) * 4;
      out[i] = clampByte(Math.round(data[i] + relief));
      out[i + 1] = clampByte(Math.round(data[i + 1] + relief));
      out[i + 2] = clampByte(Math.round(data[i + 2] + relief));
      out[i + 3] = data[i + 3];
    }
  return out;
}

// ---------- Oil-painting (Kuwahara) filter ----------
//
// The classic painterly filter: for every pixel, look at the four r×r windows
// that touch it (top-left, top-right, bottom-left, bottom-right) and output
// the MEAN COLOR of the window whose luminance VARIANCE is lowest. Flat-ish
// regions collapse into uniform daubs (color simplification) while edges stay
// crisp, because the window that straddles an edge always has higher variance
// than the one sitting on a single side of it — exactly the "already painted
// in oils" look. Implemented with summed-area tables so each pixel costs O(1)
// regardless of the brush radius. Local, deterministic, no AI, no deps.
export function oilPaintImage(base: PixelGrid, radius = 4): Uint8ClampedArray {
  const { width: w, height: h, data } = base;
  const r = Math.max(1, Math.round(radius));
  const sw = w + 1; // SAT dimensions (one extra row/col of zeros)
  const n = sw * (h + 1);

  // Channel sums fit 32 bits comfortably (255 · pixels); the squared-luminance
  // sum needs Float64 to keep the variance numerically sane on big images.
  const sr = new Uint32Array(n);
  const sg = new Uint32Array(n);
  const sb = new Uint32Array(n);
  const sl = new Float64Array(n);
  const sl2 = new Float64Array(n);

  for (let y = 0; y < h; y++) {
    const row = (y + 1) * sw;
    const prev = y * sw;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const R = data[i];
      const G = data[i + 1];
      const B = data[i + 2];
      const L = 0.299 * R + 0.587 * G + 0.114 * B;
      const k = row + x + 1;
      sr[k] = R + sr[k - 1] + sr[prev + x + 1] - sr[prev + x];
      sg[k] = G + sg[k - 1] + sg[prev + x + 1] - sg[prev + x];
      sb[k] = B + sb[k - 1] + sb[prev + x + 1] - sb[prev + x];
      sl[k] = L + sl[k - 1] + sl[prev + x + 1] - sl[prev + x];
      sl2[k] = L * L + sl2[k - 1] + sl2[prev + x + 1] - sl2[prev + x];
    }
  }

  // Sum over the inclusive pixel rect [x0..x1]×[y0..y1] via the SAT.
  const rect = (t: Uint32Array | Float64Array, x0: number, y0: number, x1: number, y1: number) =>
    t[(y1 + 1) * sw + x1 + 1] - t[y0 * sw + x1 + 1] - t[(y1 + 1) * sw + x0] + t[y0 * sw + x0];

  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // the four windows, clamped to the image
      let bestVar = Infinity;
      let bR = 0;
      let bG = 0;
      let bB = 0;
      for (let q = 0; q < 4; q++) {
        const x0 = Math.max(0, q & 1 ? x : x - r);
        const x1 = Math.min(w - 1, q & 1 ? x + r : x);
        const y0 = Math.max(0, q & 2 ? y : y - r);
        const y1 = Math.min(h - 1, q & 2 ? y + r : y);
        const a = (x1 - x0 + 1) * (y1 - y0 + 1);
        const meanL = rect(sl, x0, y0, x1, y1) / a;
        const variance = rect(sl2, x0, y0, x1, y1) / a - meanL * meanL;
        if (variance < bestVar) {
          bestVar = variance;
          bR = rect(sr, x0, y0, x1, y1) / a;
          bG = rect(sg, x0, y0, x1, y1) / a;
          bB = rect(sb, x0, y0, x1, y1) / a;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = clampByte(Math.round(bR));
      out[o + 1] = clampByte(Math.round(bG));
      out[o + 2] = clampByte(Math.round(bB));
      out[o + 3] = data[o + 3];
    }
  }
  return out;
}

// 3x3 sharpen kernel blended into the original by `amount` (0..1).
function sharpenImage(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  amount: number
): Uint8ClampedArray {
  const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        const py = y + ky < 0 ? 0 : y + ky >= h ? h - 1 : y + ky;
        for (let kx = -1; kx <= 1; kx++) {
          const px = x + kx < 0 ? 0 : x + kx >= w ? w - 1 : x + kx;
          const idx = (py * w + px) * 4;
          const kk = k[(ky + 1) * 3 + (kx + 1)];
          r += data[idx] * kk;
          g += data[idx + 1] * kk;
          b += data[idx + 2] * kk;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = clampByte(data[o] + (r - data[o]) * amount);
      out[o + 1] = clampByte(data[o + 1] + (g - data[o + 1]) * amount);
      out[o + 2] = clampByte(data[o + 2] + (b - data[o + 2]) * amount);
      out[o + 3] = data[o + 3];
    }
  }
  return out;
}

// Apply the adjustments to a base ImageData, returning the new pixel buffer.
export function computeAdjusted(
  base: ImageData,
  adjust: Adjust
): Uint8ClampedArray {
  const { width: w, height: h } = base;
  const px = new Uint8ClampedArray(base.data);
  const { sharpen, brightness, contrast, saturation, temperature } = adjust;
  const cf = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const satF = 1 + saturation / 100;
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i],
      g = px[i + 1],
      b = px[i + 2];
    r += brightness;
    g += brightness;
    b += brightness;
    r = cf * (r - 128) + 128;
    g = cf * (g - 128) + 128;
    b = cf * (b - 128) + 128;
    r += temperature * 0.6;
    b -= temperature * 0.6;
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * satF;
    g = gray + (g - gray) * satF;
    b = gray + (b - gray) * satF;
    px[i] = clampByte(r);
    px[i + 1] = clampByte(g);
    px[i + 2] = clampByte(b);
  }
  return sharpen > 0 ? sharpenImage(px, w, h, sharpen / 100) : px;
}

// Turn an image into a "stencil" / line drawing: black outlines on white, no
// color or shading. Grayscale → light blur (denoise) → Sobel edge magnitude →
// soft threshold (anti-aliased). No dependencies — pure canvas math.
//
// `detail` (0..100): edge sensitivity — higher keeps more/weaker edges.
// `weight` (~0.3..5, continuous): stroke weight — how thick/dark the lines
//   render. It scales the threshold (lower → thicker & darker) with an
//   anti-aliased ramp, so any in-between value gives an in-between stroke.
export function stencilImage(
  base: ImageData,
  detail = 55,
  weight = 1
): Uint8ClampedArray {
  const { width: w, height: h, data } = base;
  const n = w * h;
  const gray = new Float32Array(n);
  for (let i = 0, p = 0; i < data.length; i += 4, p++)
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

  // 3x3 box blur to reduce speckle before edge detection
  const g = new Float32Array(n);
  const at = (x: number, y: number) =>
    gray[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let ky = -1; ky <= 1; ky++)
        for (let kx = -1; kx <= 1; kx++) s += at(x + kx, y + ky);
      g[y * w + x] = s / 9;
    }
  }
  const bat = (x: number, y: number) =>
    g[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x)];

  const wgt = Math.max(0.2, weight);
  // Soft threshold band: pixels below `lo` are white, above `t` are full
  // black, linear (anti-aliased) between → smooth strokes at any weight.
  // `lo` is clamped at 0: with a heavy weight + high detail, t - band goes
  // negative and a zero-gradient (featureless) pixel would land mid-ramp,
  // painting flat areas near-black instead of leaving them white.
  const t = (140 - Math.max(0, Math.min(100, detail)) * 1.25) / wgt;
  const band = 14 + 10 * wgt;
  const lo = Math.max(0, t - band);

  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx =
        -bat(x - 1, y - 1) - 2 * bat(x - 1, y) - bat(x - 1, y + 1) +
        bat(x + 1, y - 1) + 2 * bat(x + 1, y) + bat(x + 1, y + 1);
      const gy =
        -bat(x - 1, y - 1) - 2 * bat(x, y - 1) - bat(x + 1, y - 1) +
        bat(x - 1, y + 1) + 2 * bat(x, y + 1) + bat(x + 1, y + 1);
      const mag = Math.sqrt(gx * gx + gy * gy);
      // coverage 0 (white) .. 1 (black)
      let a = (mag - lo) / Math.max(1e-6, t - lo);
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      const v = Math.round(255 * (1 - a));
      const o = (y * w + x) * 4;
      out[o] = out[o + 1] = out[o + 2] = v;
      out[o + 3] = 255;
    }
  }
  return out;
}

// --- AI (lazy-loaded) ---

// Bound the upscaled OUTPUT so a single GPU texture doesn't overflow.
export const MAX_AI_OUTPUT = 2048;

function cappedSource(img: HTMLImageElement, max: number): HTMLCanvasElement {
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")?.drawImage(img, 0, 0, w, h);
  return c;
}

export type AiModel = "slim-2x" | "slim-4x" | "medium-4x" | "thick-4x";

// Static import() per choice so the bundler splits each model into its own chunk
// and only the selected one downloads.
async function loadUpscaleModel(key: AiModel) {
  switch (key) {
    case "slim-4x":
      return (await import("@upscalerjs/esrgan-slim/4x")).default;
    case "medium-4x":
      return (await import("@upscalerjs/esrgan-medium/4x")).default;
    case "thick-4x":
      return (await import("@upscalerjs/esrgan-thick/4x")).default;
    default:
      return (await import("@upscalerjs/esrgan-slim/2x")).default;
  }
}
const aiFactor = (key: AiModel) => (key.endsWith("2x") ? 2 : 4);

// Returns a base64 data URL of the upscaled image. Throws on GPU/model errors.
export async function upscaleImage(
  img: HTMLImageElement,
  key: AiModel
): Promise<string> {
  const [{ default: Upscaler }, model] = await Promise.all([
    import("upscaler"),
    loadUpscaleModel(key),
  ]);
  const up = new Upscaler({ model });
  try {
    const factor = aiFactor(key);
    // Hard-cap the INPUT so input × factor stays well under the WebGL texture
    // limit (16384). Process the whole (small) frame — no patchSize — which is
    // fast and avoids both giant textures and the thousands-of-tiny-passes that
    // lose the WebGL context.
    const SAFE_OUTPUT = 1536;
    const maxInput = Math.max(64, Math.floor(SAFE_OUTPUT / factor));
    const source = cappedSource(img, maxInput);
    console.log(
      `[imgfx] enhance ${key}: input ${source.width}x${source.height} -> ~${source.width * factor}px`
    );
    // Pass a data URL of the already-downscaled canvas (not the canvas/full
    // image) so the model can only ever see the capped size.
    return await up.upscale(source.toDataURL("image/png"), { output: "base64" });
  } finally {
    try {
      (up as { dispose?: () => unknown }).dispose?.();
    } catch {
      /* ignore */
    }
  }
}

// --- Cloud AI: Google Gemini image model ("Nano Banana"), bring-your-own key.
// Runs from the browser with the user's API key (CORS-enabled endpoint). The
// key is the caller's; we never store or send it anywhere but Google.

export async function cloudEnhance(
  img: HTMLImageElement,
  apiKey: string,
  prompt: string,
  model = "gemini-2.5-flash-image"
): Promise<string> {
  // Downscale before sending to keep the upload small and fast.
  const source = cappedSource(img, 1536);
  const base64 = source.toDataURL("image/jpeg", 0.92).split(",")[1];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: base64 } },
          ],
        },
      ],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${txt.slice(0, 300)}`);
  }
  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const part = parts.find(
    (p: { inlineData?: { data?: string; mimeType?: string } }) =>
      p.inlineData?.data
  );
  if (!part?.inlineData?.data) {
    throw new Error("No image in response");
  }
  return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
}

// NOTE: MAXIM restoration models (deblur/denoise/low-light) were removed — their
// global einsum mixing allocates intermediate WebGL textures far beyond the
// 16384 limit regardless of input size, so they can't run in the browser TF.js
// backend. Use ESRGAN enhance, the Gemini cloud option, or the classic sliders.
