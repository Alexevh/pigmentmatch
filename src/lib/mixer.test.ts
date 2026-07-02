import { describe, it, expect } from "vitest";
import {
  mixColor,
  generateRecipe,
  recipePercentages,
  reachEstimate,
} from "@/lib/mixer";
import { matchScore, deltaE2000, rgbToLab, type RGB } from "@/lib/color";
import type { Pigment } from "@/lib/pigments";

const P = (
  name: string,
  rgb: RGB,
  extra: Partial<Pigment> = {}
): Pigment => ({
  id: name,
  name,
  rgb,
  opacity: 0.8,
  temperature: "neutral",
  strength: 0.8,
  ...extra,
});

const white = P("White", { r: 250, g: 250, b: 250 }, { strength: 0.9, opacity: 0.95 });
const red = P("Red", { r: 200, g: 30, b: 40 });
const blue = P("Blue", { r: 30, g: 50, b: 170 });
const yellow = P("Yellow", { r: 240, g: 210, b: 30 });
const pigs = [white, red, blue, yellow];
const target: RGB = { r: 146, g: 112, b: 115 };

describe("mixer", () => {
  it("zero weights → white", () => {
    expect(mixColor(pigs, [0, 0, 0, 0])).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("a single pigment recovers ~its own color", () => {
    const c = mixColor([red], [1]);
    expect(deltaE2000(rgbToLab(c), rgbToLab(red.rgb))).toBeLessThan(3);
  });

  it("generateRecipe is deterministic (no Math.random)", () => {
    const a = generateRecipe(target, pigs);
    const b = generateRecipe(target, pigs);
    expect(a.deltaE).toBe(b.deltaE);
    expect(a.items.map((i) => [i.pigment.name, i.weight])).toEqual(
      b.items.map((i) => [i.pigment.name, i.weight])
    );
  });

  it("the score reflects EXACTLY the displayed recipe (no stale value)", () => {
    const r = generateRecipe(target, pigs);
    expect(r.match).toBe(matchScore(r.deltaE));
    // recompute the mix from just the shown items — must match recipe.mixed
    const mixed = mixColor(
      r.items.map((i) => i.pigment),
      r.items.map((i) => i.weight)
    );
    expect(deltaE2000(rgbToLab(mixed), rgbToLab(r.mixed))).toBeLessThan(1);
  });

  it("recipePercentages sum to ~100", () => {
    const r = generateRecipe(target, pigs);
    const sum = recipePercentages(r.items)
      .filter((p) => p >= 0)
      .reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThanOrEqual(98);
    expect(sum).toBeLessThanOrEqual(100);
  });

  it("undertone is ignored for a pure pigment (== masstone)", () => {
    const u = P("U", { r: 40, g: 40, b: 160 }, { undertone: { r: 120, g: 40, b: 200 } });
    const pure = mixColor([u], [1]);
    const mass = mixColor([{ ...u, undertone: undefined }], [1]);
    expect(pure).toEqual(mass);
  });

  it("undertone changes a white-heavy tint", () => {
    const u = P("U", { r: 40, g: 40, b: 160 }, { undertone: { r: 150, g: 30, b: 200 } });
    const withU = mixColor([white, u], [8, 1]);
    const withoutU = mixColor([white, { ...u, undertone: undefined }], [8, 1]);
    expect(withU).not.toEqual(withoutU);
  });

  it("goldenRatio still yields a valid, self-consistent recipe", () => {
    const r = generateRecipe(target, pigs, "simple", "classic", {
      goldenRatio: true,
    });
    expect(r.match).toBe(matchScore(r.deltaE));
  });

  it("km2 engine produces a finite result", () => {
    const r = generateRecipe(target, pigs, "precise", "km2");
    expect(Number.isFinite(r.deltaE)).toBe(true);
    expect(r.match).toBe(matchScore(r.deltaE));
  });

  it("spectral engine runs, incl. a pigment with an undertone", () => {
    const u = P("U", { r: 40, g: 40, b: 160 }, { undertone: { r: 150, g: 30, b: 200 } });
    const r = generateRecipe(target, [white, red, u], "simple", "spectral");
    expect(Number.isFinite(r.deltaE)).toBe(true);
    expect(r.match).toBe(matchScore(r.deltaE));
  });

  it("reachEstimate returns a finite non-negative ΔE", () => {
    const d = reachEstimate(target, pigs);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(d)).toBe(true);
  });

  it("value-first doesn't collapse an out-of-reach dark target to one neutral", () => {
    const black = P("Black", { r: 50, g: 50, b: 50 }, { strength: 0.9 });
    const redp = P("Redp", { r: 200, g: 30, b: 40 });
    const pal = [white, black, redp];
    const dark: RGB = { r: 40, g: 22, b: 20 }; // darker than every pigment
    const vp = generateRecipe(dark, pal, "simple", "classic", {
      valuePriority: true,
    });
    // must keep a hue pigment, not drop to 100% of the dark neutral
    expect(vp.items.length).toBeGreaterThan(1);
    // and stay within the color guard of the best plain mix
    const plain = generateRecipe(dark, pal, "simple", "classic");
    expect(vp.deltaE).toBeLessThanOrEqual(plain.deltaE + 2.0001);
  });

  it("an empty palette gives match 0", () => {
    const r = generateRecipe({ r: 10, g: 20, b: 30 }, []);
    expect(r.match).toBe(0);
    expect(r.items).toHaveLength(0);
  });
});
