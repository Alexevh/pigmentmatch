import { describe, it, expect } from "vitest";
import { oilPaintImage, type PixelGrid } from "@/lib/imagefx";

// Build a PixelGrid from a per-pixel color function (node has no ImageData).
function grid(
  w: number,
  h: number,
  at: (x: number, y: number) => [number, number, number]
): PixelGrid {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = at(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  return { width: w, height: h, data };
}

describe("oilPaintImage (Kuwahara)", () => {
  it("leaves a flat image unchanged", () => {
    const g = grid(24, 24, () => [180, 120, 60]);
    const out = oilPaintImage(g, 4);
    for (let i = 0; i < out.length; i += 4) {
      expect(out[i]).toBe(180);
      expect(out[i + 1]).toBe(120);
      expect(out[i + 2]).toBe(60);
      expect(out[i + 3]).toBe(255);
    }
  });

  it("preserves a hard edge (no bleeding across it)", () => {
    // left half dark, right half light — the painterly filter must NOT smear
    // the boundary (that's the whole point vs a blur)
    const g = grid(40, 20, (x) => (x < 20 ? [30, 30, 30] : [220, 220, 220]));
    const out = oilPaintImage(g, 5);
    const px = (x: number, y: number) => out[(y * 40 + x) * 4];
    // the two pixels ADJACENT to the edge stay pure
    expect(px(19, 10)).toBe(30);
    expect(px(20, 10)).toBe(220);
  });

  it("flattens noise (color simplification)", () => {
    // deterministic 'noise': alternating values in a mid-grey field
    const g = grid(32, 32, (x, y) => {
      const v = 128 + (((x * 7919 + y * 104729) % 41) - 20);
      return [v, v, v];
    });
    const inVals: number[] = [];
    for (let i = 0; i < g.data.length; i += 4) inVals.push(g.data[i]);
    const out = oilPaintImage(g, 4);
    const outVals: number[] = [];
    for (let i = 0; i < out.length; i += 4) outVals.push(out[i]);
    const stddev = (vs: number[]) => {
      const m = vs.reduce((a, b) => a + b, 0) / vs.length;
      return Math.sqrt(vs.reduce((s, v) => s + (v - m) * (v - m), 0) / vs.length);
    };
    // the output is visibly flatter than the input
    expect(stddev(outVals)).toBeLessThan(stddev(inVals) * 0.7);
  });

  it("keeps dimensions and alpha", () => {
    const g = grid(15, 9, (x) => [x * 10, 0, 0]);
    g.data[3] = 77; // custom alpha on the first pixel
    const out = oilPaintImage(g, 3);
    expect(out.length).toBe(15 * 9 * 4);
    expect(out[3]).toBe(77);
  });
});
