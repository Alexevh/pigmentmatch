import { describe, it, expect } from "vitest";
import {
  rgbToHex,
  hexToRgb,
  rgbToLab,
  deltaE,
  deltaE2000,
  matchScore,
  valueScore,
  rgbToHsl,
  hslToRgb,
  buildHarmonies,
  clamp255,
  whiteBalance,
  analyzeColor,
} from "@/lib/color";

describe("color", () => {
  it("hex ↔ rgb round-trips", () => {
    const c = { r: 255, g: 136, b: 0 };
    expect(hexToRgb(rgbToHex(c))).toEqual(c);
    expect(hexToRgb("#ff8800")).toEqual(c);
  });

  it("Lab of white ≈ (100,0,0) and black L ≈ 0", () => {
    const w = rgbToLab({ r: 255, g: 255, b: 255 });
    expect(w.L).toBeGreaterThan(99);
    expect(Math.abs(w.a)).toBeLessThan(1);
    expect(Math.abs(w.b)).toBeLessThan(1);
    expect(rgbToLab({ r: 0, g: 0, b: 0 }).L).toBeLessThan(1);
  });

  it("deltaE2000 matches the Sharma reference (2.0425)", () => {
    const d = deltaE2000(
      { L: 50, a: 2.6772, b: -79.7751 },
      { L: 50, a: 0, b: -82.7485 }
    );
    expect(d).toBeCloseTo(2.0425, 3);
  });

  it("deltaE of identical colors is 0", () => {
    expect(deltaE({ L: 50, a: 10, b: -5 }, { L: 50, a: 10, b: -5 })).toBe(0);
  });

  it("matchScore / valueScore bounds", () => {
    expect(matchScore(0)).toBe(100);
    expect(matchScore(100)).toBe(0);
    expect(valueScore(0)).toBe(100);
    expect(valueScore(100)).toBe(0);
  });

  it("hsl ↔ rgb round-trips (within rounding)", () => {
    for (const c of [
      { r: 120, g: 80, b: 200 },
      { r: 10, g: 200, b: 50 },
      { r: 200, g: 50, b: 50 },
    ]) {
      const back = hslToRgb(rgbToHsl(c));
      expect(Math.abs(back.r - c.r)).toBeLessThanOrEqual(2);
      expect(Math.abs(back.g - c.g)).toBeLessThanOrEqual(2);
      expect(Math.abs(back.b - c.b)).toBeLessThanOrEqual(2);
    }
  });

  it("harmonies: 5 entries, complement ≈ +180° hue", () => {
    const base = { r: 200, g: 50, b: 50 };
    const hs = buildHarmonies(base);
    expect(hs).toHaveLength(5);
    const comp = hs.find((h) => h.kind === "complement")!;
    const diff =
      ((rgbToHsl(comp.rgb).h - rgbToHsl(base).h) % 360 + 360) % 360;
    expect(Math.abs(diff - 180)).toBeLessThan(2);
  });

  it("clamp255 clamps and stays within range", () => {
    expect(clamp255(-5)).toBe(0);
    expect(clamp255(300)).toBe(255);
    expect(clamp255(128)).toBe(128);
  });

  it("whiteBalance: a neutral reference leaves colors ~unchanged", () => {
    const c = { r: 180, g: 120, b: 60 };
    const out = whiteBalance(c, { r: 200, g: 200, b: 200 });
    expect(Math.abs(out.r - c.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(out.g - c.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(out.b - c.b)).toBeLessThanOrEqual(2);
  });

  it("whiteBalance: a warm (yellowish) cast on the card cools the sample", () => {
    // Card photographed too warm: red/green high, blue low. Correcting should
    // pull blue up and red down relative to green (remove the yellow cast).
    const gray = { r: 128, g: 128, b: 128 };
    const warmRef = { r: 210, g: 200, b: 150 }; // yellow-cast "white" card
    const out = whiteBalance(gray, warmRef);
    expect(out.b).toBeGreaterThan(gray.b); // blue restored
    expect(out.r).toBeLessThan(gray.r); // red pulled back
  });

  it("whiteBalance: a too-dark reference is ignored (returns input)", () => {
    const c = { r: 100, g: 100, b: 100 };
    expect(whiteBalance(c, { r: 0, g: 0, b: 0 })).toEqual(c);
  });

  it("analyzeColor: near-white/near-black tints read as neutral, not saturated", () => {
    // HSL saturation explodes near white/black; chroma-based analysis must not.
    const nearWhite = analyzeColor({ r: 255, g: 254, b: 255 });
    expect(nearWhite.saturation).toBe("Very low");
    expect(nearWhite.hue).toBe("Neutral");
    const offWhite = analyzeColor({ r: 250, g: 245, b: 240 });
    expect(offWhite.hue).toBe("Neutral");
    expect(offWhite.saturation).toBe("Very low");
    const nearBlack = analyzeColor({ r: 5, g: 0, b: 0 });
    expect(nearBlack.saturation).toBe("Very low");
    expect(nearBlack.hue).toBe("Neutral");
    // …while a genuinely saturated color still reads as saturated.
    const red = analyzeColor({ r: 200, g: 30, b: 30 });
    expect(red.saturation).toBe("High");
    expect(red.hue).toBe("Reddish");
  });

  it("analyzeColor: a leaning grey exposes its tendency in the sentence", () => {
    // A warm mid-grey: clearly neutral but leaning red/orange (3 <= C* < 10).
    const a = analyzeColor({ r: 140, g: 125, b: 118 });
    expect(a.hue).toBe("Neutral");
    expect(a.tendency).toBeDefined();
    expect(a.sentence).toContain("tendency");
    // A dead-neutral grey has no tendency.
    const g = analyzeColor({ r: 128, g: 128, b: 128 });
    expect(g.tendency).toBeUndefined();
    expect(g.sentence).not.toContain("tendency");
  });

  it("hslToRgb normalizes out-of-range hues", () => {
    const base = hslToRgb({ h: 330, s: 100, l: 50 });
    expect(hslToRgb({ h: -30, s: 100, l: 50 })).toEqual(base);
    expect(hslToRgb({ h: 690, s: 100, l: 50 })).toEqual(base);
    const orange = hslToRgb({ h: 30, s: 100, l: 50 });
    expect(hslToRgb({ h: 390, s: 100, l: 50 })).toEqual(orange);
  });

  it("whiteBalance preserveL: keeps the sample's own lightness", () => {
    const c = { r: 200, g: 190, b: 40 }; // a yellow
    const warmRef = { r: 210, g: 200, b: 150 };
    const plain = whiteBalance(c, warmRef, false);
    const kept = whiteBalance(c, warmRef, true);
    const L0 = rgbToLab(c).L;
    const Lkept = rgbToLab(kept).L;
    const Lplain = rgbToLab(plain).L;
    // preserveL should track the input L* tightly; plain may drift more.
    expect(Math.abs(Lkept - L0)).toBeLessThan(1.5);
    expect(Math.abs(Lkept - L0)).toBeLessThanOrEqual(Math.abs(Lplain - L0) + 0.01);
  });
});
