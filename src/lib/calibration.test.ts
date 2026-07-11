import { describe, it, expect } from "vitest";
import {
  fitCalibration,
  applyCalibration,
  averageError,
  type Observation,
} from "@/lib/calibration";
import type { Pigment } from "@/lib/pigments";
import type { RGB } from "@/lib/color";

const P = (id: string, rgb: RGB, strength = 0.8): Pigment => ({
  id,
  name: id,
  rgb,
  opacity: 0.8,
  temperature: "neutral",
  strength,
});

const pigs = [
  P("white", { r: 250, g: 250, b: 250 }, 0.9),
  P("red", { r: 200, g: 30, b: 40 }),
];

const obs: Observation[] = [
  { id: "o1", items: [{ pigmentId: "white", weight: 3 }, { pigmentId: "red", weight: 1 }], observed: { r: 210, g: 150, b: 150 } },
  { id: "o2", items: [{ pigmentId: "white", weight: 1 }, { pigmentId: "red", weight: 1 }], observed: { r: 200, g: 110, b: 110 } },
];

describe("calibration", () => {
  it("strength-only fit returns strengths and no color maps", () => {
    const cal = fitCalibration(obs, pigs);
    expect(Object.keys(cal.strengthById)).toHaveLength(2);
    expect(cal.rgbById).toBeUndefined();
    expect(cal.avgError).toBeGreaterThanOrEqual(0);
  });

  it("color fit does not do worse and produces fitted colors", () => {
    const sOnly = fitCalibration(obs, pigs);
    const withColor = fitCalibration(obs, pigs, { fitColor: true });
    expect(withColor.rgbById).toBeDefined();
    // color descent runs after strengths and only accepts improvements
    expect(withColor.avgError).toBeLessThanOrEqual(sOnly.avgError + 1e-6);
    // fitted masstone stays within the ±60 bound of the original
    const red = withColor.rgbById!["red"];
    expect(Math.abs(red.r - 200)).toBeLessThanOrEqual(60);
  });

  it("applyCalibration applies fitted color + strength", () => {
    const cal = fitCalibration(obs, pigs, { fitColor: true });
    const out = applyCalibration(pigs, cal);
    expect(out[0].strength).toBe(cal.strengthById["white"]);
    expect(out[1].rgb).toEqual(cal.rgbById!["red"]);
  });

  it("ignores observations that reference pigments missing from the palette", () => {
    // This observation used a tube ("blue") that was later deleted from the
    // palette. If it were fitted anyway (the missing pigment maps to weight 0),
    // it would be treated as pure red against a red+blue color and corrupt
    // red's fitted strength.
    const orphan: Observation = {
      id: "o3",
      items: [
        { pigmentId: "blue", weight: 1 },
        { pigmentId: "red", weight: 1 },
      ],
      observed: { r: 90, g: 20, b: 120 },
    };
    expect(averageError([orphan], pigs)).toBe(0); // filtered out → no data
    const cal = fitCalibration([orphan], pigs);
    // With no usable observation the fit keeps the original strengths.
    expect(cal.strengthById["white"]).toBe(0.9);
    expect(cal.strengthById["red"]).toBe(0.8);
    // …and a mixed batch fits only from the intact observations.
    const mixed = fitCalibration([...obs, orphan], pigs);
    const clean = fitCalibration(obs, pigs);
    expect(mixed.strengthById).toEqual(clean.strengthById);
    expect(mixed.avgError).toBeCloseTo(clean.avgError, 10);
  });
});
