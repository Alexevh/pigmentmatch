// Color math engine for Pigment Match.
// Handles conversions, perceptual distance (CIE Lab / deltaE), painter-oriented
// analysis, and intuitive color variations.

export interface RGB {
  r: number; // 0-255
  g: number;
  b: number;
}

export interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export interface Lab {
  L: number;
  a: number;
  b: number;
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export const clamp255 = (v: number) => clamp(Math.round(v), 0, 255);

// ---------- HEX <-> RGB ----------

export function hexToRgb(hex: string): RGB | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (v: number) => clamp255(v).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

// ---------- RGB <-> HSL ----------

export function rgbToHsl({ r, g, b }: RGB): HSL {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  // Normalize the hue so out-of-range inputs (h = -30, h = 390) wrap around
  // instead of silently falling into the wrong sextant branch below.
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0,
    g = 0,
    b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return {
    r: clamp255((r + m) * 255),
    g: clamp255((g + m) * 255),
    b: clamp255((b + m) * 255),
  };
}

// ---------- RGB <-> CIE Lab (D65) ----------

export function rgbToLab({ r, g, b }: RGB): Lab {
  // sRGB -> linear
  const lin = (v: number) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  // linear RGB -> XYZ
  let X = R * 0.4124 + G * 0.3576 + B * 0.1805;
  let Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let Z = R * 0.0193 + G * 0.1192 + B * 0.9505;
  // normalize by D65 white point
  X /= 0.95047;
  Y /= 1.0;
  Z /= 1.08883;
  const f = (t: number) =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

// CIE76 deltaE — simple, fast. Used where speed matters more than perceptual
// accuracy (e.g. k-means clustering in palette extraction).
export function deltaE(a: Lab, b: Lab): number {
  return Math.sqrt(
    (a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2
  );
}

export function rgbDeltaE(a: RGB, b: RGB): number {
  return deltaE(rgbToLab(a), rgbToLab(b));
}

// CIEDE2000 (ΔE00) — perceptually accurate color difference. Better than CIE76
// for blues and near-neutrals; used for recipe matching, scoring, coaching and
// calibration. Standard formula (Sharma et al. / CIE).
const D2R = Math.PI / 180;
function hueDeg(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  let h = Math.atan2(b, a) / D2R;
  if (h < 0) h += 360;
  return h;
}

export function deltaE2000(c1: Lab, c2: Lab): number {
  const L1 = c1.L,
    a1 = c1.a,
    b1 = c1.b;
  const L2 = c2.L,
    a2 = c2.a,
    b2 = c2.b;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Cbar ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = hueDeg(a1p, b1);
  const h2p = hueDeg(a2p, b2);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * D2R) / 2);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbarp = (h1p + h2p + 360) / 2;
    else hbarp = (h1p + h2p) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * D2R) +
    0.24 * Math.cos(2 * hbarp * D2R) +
    0.32 * Math.cos((3 * hbarp + 6) * D2R) -
    0.2 * Math.cos((4 * hbarp - 63) * D2R);

  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Cbarp7 = Cbarp ** 7;
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + 25 ** 7));
  const Sl =
    1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(2 * dTheta * D2R) * Rc;

  return Math.sqrt(
    (dLp / Sl) ** 2 +
      (dCp / Sc) ** 2 +
      (dHp / Sh) ** 2 +
      Rt * (dCp / Sc) * (dHp / Sh)
  );
}

export function rgbDeltaE2000(a: RGB, b: RGB): number {
  return deltaE2000(rgbToLab(a), rgbToLab(b));
}

// Map a perceptual distance to a friendly "match" percentage.
export function matchScore(dE: number): number {
  return Math.round(clamp(100 - dE * 1.5, 0, 100));
}

// Value (lightness) match as a percentage from the L* difference (ΔL). Scaled so
// it lands in the same color bands as matchScore: ΔL 2 → 90%, ΔL 5 → 75%.
export function valueScore(deltaL: number): number {
  return Math.round(clamp(100 - deltaL * 5, 0, 100));
}

// ---------- Painter-oriented analysis ----------

export type ValueLevel = "Light" | "Medium" | "Dark";
export type Temperature = "Warm" | "Neutral" | "Cool";
export type SaturationLevel = "High" | "Medium" | "Low" | "Very low";
export type HueTendency =
  | "Reddish"
  | "Orange"
  | "Yellowish"
  | "Green"
  | "Blue"
  | "Violet"
  | "Neutral";

export interface PainterAnalysis {
  value: ValueLevel;
  temperature: Temperature;
  saturation: SaturationLevel;
  hue: HueTendency;
  // For near-neutrals (hue === "Neutral"): the direction the grey leans, when
  // it leans at all — "a grey with a slight reddish tendency".
  tendency?: HueTendency;
  sentence: string;
}

function hueTendency(h: number): HueTendency {
  // coarse artistic buckets
  if (h < 15 || h >= 345) return "Reddish";
  if (h < 45) return "Orange";
  if (h < 70) return "Yellowish";
  if (h < 160) return "Green";
  if (h < 255) return "Blue";
  if (h < 290) return "Violet";
  return "Reddish";
}

function hueTemperature(h: number): Temperature {
  // warm = reds/oranges/yellows; cool = greens/blues/violets
  if ((h >= 0 && h < 75) || h >= 330) return "Warm";
  if (h >= 75 && h < 150) return "Neutral"; // yellow-greens
  return "Cool";
}

export function analyzeColor(rgb: RGB): PainterAnalysis {
  const { h } = rgbToHsl(rgb);
  const lab = rgbToLab(rgb);
  // Saturation/neutrality use Lab chroma (C* = √(a²+b²)), NOT HSL saturation:
  // HSL S explodes near white/black (a 1-unit tint at L≈100 reads as S=100),
  // so near-neutrals were misdescribed as "highly saturated". Chroma measures
  // perceived colorfulness directly.
  const chroma = Math.hypot(lab.a, lab.b);

  const value: ValueLevel =
    lab.L >= 66 ? "Light" : lab.L >= 33 ? "Medium" : "Dark";

  let saturation: SaturationLevel;
  if (chroma < 7) saturation = "Very low";
  else if (chroma < 22) saturation = "Low";
  else if (chroma < 45) saturation = "Medium";
  else saturation = "High";

  // Below this chroma the color reads as a grey/neutral; hue is only a tendency.
  const isNeutral = chroma < 10;
  const hue: HueTendency = isNeutral ? "Neutral" : hueTendency(h);
  const temperature: Temperature = isNeutral
    ? // even greys lean warm/cool via their hue
      chroma < 3
      ? "Neutral"
      : hueTemperature(h)
    : hueTemperature(h);
  // The direction a leaning grey leans toward ("with a slight reddish tendency").
  const tendency: HueTendency | undefined =
    isNeutral && chroma >= 3 ? hueTendency(h) : undefined;

  const sentence = buildSentence({
    value,
    temperature,
    saturation,
    hue,
    neutral: isNeutral,
    tendency,
  });
  return { value, temperature, saturation, hue, tendency, sentence };
}

function buildSentence(p: {
  value: ValueLevel;
  temperature: Temperature;
  saturation: SaturationLevel;
  hue: HueTendency;
  neutral: boolean;
  tendency?: HueTendency;
}): string {
  const valueWord =
    p.value === "Light" ? "light" : p.value === "Dark" ? "dark" : "mid-value";

  const satWord =
    p.saturation === "Very low"
      ? "very low saturation"
      : p.saturation === "Low"
      ? "low saturation"
      : p.saturation === "Medium"
      ? "moderately saturated"
      : "highly saturated";

  // Core noun: greys when nearly neutral, otherwise a colored term.
  const noun = p.neutral
    ? p.value === "Light"
      ? "light grey"
      : p.value === "Dark"
      ? "deep grey"
      : "grey"
    : `${valueWord} ${p.hue.toLowerCase()}`;

  const tempPhrase =
    p.temperature === "Neutral"
      ? "neutral in temperature"
      : `slightly ${p.temperature.toLowerCase()}`;

  const tendency = p.tendency
    ? ` with a slight ${p.tendency.toLowerCase()} tendency`
    : "";

  return `A ${satWord} ${noun}, ${tempPhrase}${tendency}.`;
}

// ---------- Variations ----------
// Variations are computed in a perceptual-ish way so they feel painterly:
// lightness/saturation shift in HSL, temperature shifts in Lab (a*/b*).

export type VariationKind =
  | "Warmer"
  | "Cooler"
  | "More saturated"
  | "Less saturated"
  | "Lighter"
  | "Darker";

export interface Variation {
  kind: VariationKind;
  rgb: RGB;
  hex: string;
}

export function labToRgb({ L, a, b }: Lab): RGB {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = (t: number) => {
    const t3 = t ** 3;
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
  };
  let X = inv(fx) * 0.95047;
  let Y = inv(fy) * 1.0;
  let Z = inv(fz) * 1.08883;
  let R = X * 3.2406 + Y * -1.5372 + Z * -0.4986;
  let G = X * -0.9689 + Y * 1.8758 + Z * 0.0415;
  let B = X * 0.0557 + Y * -0.204 + Z * 1.057;
  const gamma = (v: number) =>
    v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return {
    r: clamp255(gamma(R) * 255),
    g: clamp255(gamma(G) * 255),
    b: clamp255(gamma(B) * 255),
  };
}

export function variation(rgb: RGB, kind: VariationKind): RGB {
  // Temperature and saturation both work in Lab at CONSTANT L*, so they change
  // only hue/chroma and never the value — desaturating a skin tone greys it
  // without lightening/darkening it. (HSL saturation would shift the perceived
  // value, since HSL "L" isn't luminance.) Lighter/Darker deliberately move L*.
  if (kind === "Warmer" || kind === "Cooler") {
    const lab = rgbToLab(rgb);
    const dir = kind === "Warmer" ? 1 : -1;
    // push toward red (+a) and yellow (+b) for warm, the reverse for cool
    return labToRgb({
      L: lab.L,
      a: lab.a + dir * 9,
      b: lab.b + dir * 9,
    });
  }
  if (kind === "More saturated" || kind === "Less saturated") {
    const lab = rgbToLab(rgb);
    // Scale chroma (a*, b*) about the neutral axis, keeping L* fixed.
    const f = kind === "More saturated" ? 1.35 : 0.65;
    return labToRgb({ L: lab.L, a: lab.a * f, b: lab.b * f });
  }
  const hsl = rgbToHsl(rgb);
  switch (kind) {
    case "Lighter":
      hsl.l = clamp(hsl.l + 12, 0, 100);
      break;
    case "Darker":
      hsl.l = clamp(hsl.l - 12, 0, 100);
      break;
  }
  return hslToRgb(hsl);
}

export const VARIATION_KINDS: VariationKind[] = [
  "Lighter",
  "Darker",
  "Warmer",
  "Cooler",
  "More saturated",
  "Less saturated",
];

export function buildVariations(rgb: RGB): Variation[] {
  return VARIATION_KINDS.map((kind) => {
    const out = variation(rgb, kind);
    return { kind, rgb: out, hex: rgbToHex(out) };
  });
}

// --- Color-wheel harmonies (hue rotations at the same S/L) ---

export type HarmonyKind =
  | "complement"
  | "analogA"
  | "analogB"
  | "triadA"
  | "triadB";

export interface Harmony {
  kind: HarmonyKind;
  rgb: RGB;
  hex: string;
}

const HARMONY_ROT: Record<HarmonyKind, number> = {
  complement: 180,
  analogA: -30,
  analogB: 30,
  triadA: 120,
  triadB: -120,
};

export function buildHarmonies(rgb: RGB): Harmony[] {
  const hsl = rgbToHsl(rgb);
  return (Object.keys(HARMONY_ROT) as HarmonyKind[]).map((kind) => {
    const h = ((hsl.h + HARMONY_ROT[kind]) % 360 + 360) % 360;
    const out = hslToRgb({ ...hsl, h });
    return { kind, rgb: out, hex: rgbToHex(out) };
  });
}

// Relative luminance to decide readable text color over a swatch.
export function isLight(rgb: RGB): boolean {
  return rgbToLab(rgb).L > 60;
}

// White-balance a sampled color against a reference patch the painter knows is
// neutral (a white or gray card in the SAME photo, under the SAME light). Phone
// cameras apply an auto white-balance cast to the whole frame; we model that
// cast as a per-channel gain (von Kries, in linear light) and remove it. We
// preserve the reference's own brightness (target = its linear-channel mean) so
// we neutralize the COLOR cast without touching exposure. With a perfectly
// neutral reference the gains are ~1 and the color is returned essentially
// unchanged. Gains are clamped to a sane range so a bad/too-dark reference can't
// blow the color up. Pure, deterministic; used by ImageSampler (opt-in).
const srgbToLin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const linToSrgb = (v: number) =>
  clamp255(
    (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255
  );

// preserveL: keep the sampled color's own lightness (L*) and correct only the
// color cast (a*/b*). The camera's white-balance error (color) and exposure
// error (brightness) are separate problems; von Kries gains can push a channel
// toward clipping and visibly brighten a warm color. With preserveL the value
// is left untouched — more conservative, and value is judged separately when
// painting. Off by default → identical to the plain correction.
export function whiteBalance(rgb: RGB, ref: RGB, preserveL = false): RGB {
  const rw = srgbToLin(ref.r);
  const gw = srgbToLin(ref.g);
  const bw = srgbToLin(ref.b);
  const gray = (rw + gw + bw) / 3;
  const eps = 1e-4;
  if (gray < eps || rw < eps || gw < eps || bw < eps) return rgb; // too dark to trust
  const gc = (w: number) => Math.max(0.25, Math.min(4, gray / w));
  const gr = gc(rw);
  const gg = gc(gw);
  const gb = gc(bw);
  const out = {
    r: linToSrgb(srgbToLin(rgb.r) * gr),
    g: linToSrgb(srgbToLin(rgb.g) * gg),
    b: linToSrgb(srgbToLin(rgb.b) * gb),
  };
  if (!preserveL) return out;
  const src = rgbToLab(rgb);
  const corr = rgbToLab(out);
  return labToRgb({ L: src.L, a: corr.a, b: corr.b });
}
