import { describe, it, expect } from "vitest";
import {
  warmCool,
  buildSceneProfile,
  analyzeZone,
  sceneAdvice,
} from "@/lib/scene";
import { rgbToLab, type RGB } from "@/lib/color";
import type { Pigment } from "@/lib/pigments";

const P = (name: string, rgb: RGB): Pigment => ({
  id: name,
  name,
  rgb,
  opacity: 0.8,
  temperature: "neutral",
  strength: 0.8,
});
const palette = [
  P("White", { r: 250, g: 250, b: 250 }),
  P("Ultramarine", { r: 30, g: 34, b: 110 }), // the coolest
  P("Burnt Sienna", { r: 90, g: 45, b: 30 }),
  P("Yellow Ochre", { r: 180, g: 130, b: 50 }),
];

// A warm-light / cool-shadow scene: bright warm pixels + dark cool pixels.
const warmLightPixels: RGB[] = [
  ...Array(60).fill({ r: 232, g: 200, b: 150 }), // warm lights
  ...Array(40).fill({ r: 40, g: 46, b: 72 }), // cool shadows
];

describe("scene", () => {
  it("warmCool: yellow is warm (+), blue is cool (−)", () => {
    expect(warmCool(rgbToLab({ r: 230, g: 210, b: 90 }))).toBeGreaterThan(0);
    expect(warmCool(rgbToLab({ r: 40, g: 50, b: 130 }))).toBeLessThan(0);
  });

  it("profile detects a warm-light / cool-shadow scene", () => {
    const prof = buildSceneProfile(warmLightPixels);
    expect(prof.polarity).toBe("warm-light");
    expect(prof.lightTemp).toBeGreaterThan(prof.shadowTemp);
    expect(prof.split).toBeGreaterThan(0);
    expect(prof.split).toBeLessThan(100);
  });

  it("analyzeZone classifies light vs shadow by value", () => {
    const prof = buildSceneProfile(warmLightPixels);
    const light = analyzeZone([{ r: 235, g: 205, b: 155 }], prof);
    const shadow = analyzeZone([{ r: 42, g: 48, b: 74 }], prof);
    expect(light.family).toBe("light");
    expect(shadow.family).toBe("shadow");
  });

  it("warm shadow in a warm-light scene → advises cooling with the bluest tube", () => {
    const prof = buildSceneProfile(warmLightPixels);
    // a shadow zone that reads too warm (brown) for a warm-light scene
    const zone = analyzeZone([{ r: 74, g: 48, b: 34 }], prof);
    expect(zone.family).toBe("shadow");
    const adv = sceneAdvice(zone, prof, palette, "en");
    expect(adv.addPigment).not.toBeNull();
    expect(adv.addPigment!.pigment.name).toBe("Ultramarine");
    // the adjusted target is cooler than the measured zone
    expect(warmCool(rgbToLab(adv.adjustedRgb))).toBeLessThan(warmCool(zone.lab));
    expect(adv.tips.some((t) => t.id === "temp")).toBe(true);
  });

  it("empty palette still returns advice without a pigment pick", () => {
    const prof = buildSceneProfile(warmLightPixels);
    const zone = analyzeZone([{ r: 74, g: 48, b: 34 }], prof);
    const adv = sceneAdvice(zone, prof, [], "en");
    expect(adv.addPigment).toBeNull();
  });
});
