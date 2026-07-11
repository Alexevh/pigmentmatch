import { describe, it, expect } from "vitest";
import { buildColorString } from "@/lib/strings";
import type { Pigment } from "@/lib/pigments";
import type { RGB } from "@/lib/color";

const P = (id: string, rgb: RGB, extra: Partial<Pigment> = {}): Pigment => ({
  id,
  name: id,
  rgb,
  opacity: 0.8,
  temperature: "neutral",
  strength: 0.8,
  ...extra,
});

const white = P("white", { r: 250, g: 250, b: 250 }, { strength: 0.9 });
const red = P("red", { r: 200, g: 30, b: 40 });
const black = P("black", { r: 25, g: 25, b: 25 }, { strength: 0.9 });

describe("strings (value scale)", () => {
  it("builds a light→dark string around the base mix", () => {
    const cs = buildColorString({ r: 150, g: 90, b: 90 }, [white, red, black]);
    expect(cs).not.toBeNull();
    expect(cs!.steps.length).toBe(7); // 3 lighter + base + 3 darker
    expect(cs!.baseIndex).toBe(3);
    // Values are ordered light → dark.
    const Ls = cs!.steps.map((s) => s.L);
    for (let i = 1; i < Ls.length; i++) expect(Ls[i]).toBeLessThan(Ls[i - 1]);
    // Every step's weights are a normalized mix over the returned pigments.
    for (const s of cs!.steps) {
      const sum = s.weights.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 6);
      expect(s.weights).toHaveLength(cs!.pigments.length);
    }
    // Light steps add the white, dark steps add the black.
    expect(cs!.steps[0].add?.pigment.id).toBe("white");
    expect(cs!.steps[6].add?.pigment.id).toBe("black");
    expect(cs!.steps[3].add).toBeNull();
  });

  it("skips the light side when the palette has no white", () => {
    const cs = buildColorString({ r: 120, g: 60, b: 60 }, [red, black]);
    expect(cs).not.toBeNull();
    expect(cs!.white).toBeNull();
    expect(cs!.baseIndex).toBe(0); // no lighter steps
  });

  it("returns null for a one-pigment palette", () => {
    expect(buildColorString({ r: 120, g: 60, b: 60 }, [red])).toBeNull();
  });
});
