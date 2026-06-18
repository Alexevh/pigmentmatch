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

// CIE76 deltaE — simple, fast, good enough for paint matching guidance.
export function deltaE(a: Lab, b: Lab): number {
  return Math.sqrt(
    (a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2
  );
}

export function rgbDeltaE(a: RGB, b: RGB): number {
  return deltaE(rgbToLab(a), rgbToLab(b));
}

// Map a perceptual distance to a friendly "match" percentage.
export function matchScore(dE: number): number {
  return Math.round(clamp(100 - dE * 1.5, 0, 100));
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
  const { h, s, l } = rgbToHsl(rgb);
  const lab = rgbToLab(rgb);

  const value: ValueLevel =
    lab.L >= 66 ? "Light" : lab.L >= 33 ? "Medium" : "Dark";

  let saturation: SaturationLevel;
  if (s < 8) saturation = "Very low";
  else if (s < 25) saturation = "Low";
  else if (s < 55) saturation = "Medium";
  else saturation = "High";

  // Below this saturation the color reads as a grey/neutral; hue is only a tendency.
  const isNeutral = s < 12;
  const hue: HueTendency = isNeutral ? "Neutral" : hueTendency(h);
  const temperature: Temperature = isNeutral
    ? // even greys lean warm/cool via their hue
      s < 4
      ? "Neutral"
      : hueTemperature(h)
    : hueTemperature(h);

  const sentence = buildSentence({ value, temperature, saturation, hue, l, s });
  return { value, temperature, saturation, hue, sentence };
}

function buildSentence(p: {
  value: ValueLevel;
  temperature: Temperature;
  saturation: SaturationLevel;
  hue: HueTendency;
  l: number;
  s: number;
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
  const neutral = p.s < 12;
  const noun = neutral
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

  const tendency =
    neutral && p.hue !== "Neutral"
      ? ` with a slight ${p.hue.toLowerCase()} tendency`
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

function labToRgb({ L, a, b }: Lab): RGB {
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
  const hsl = rgbToHsl(rgb);
  switch (kind) {
    case "More saturated":
      hsl.s = clamp(hsl.s + 18, 0, 100);
      break;
    case "Less saturated":
      hsl.s = clamp(hsl.s - 18, 0, 100);
      break;
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

// Relative luminance to decide readable text color over a swatch.
export function isLight(rgb: RGB): boolean {
  return rgbToLab(rgb).L > 60;
}
