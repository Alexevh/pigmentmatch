import { describe, it, expect } from "vitest";
import {
  oilPaintImage,
  bilateralImage,
  posterizeLabImage,
  xdogImage,
  claheImage,
  flattenLightImage,
  impastoImage,
  type PixelGrid,
} from "@/lib/imagefx";

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

describe("artistic filters", () => {
  const stddev = (vs: number[]) => {
    const m = vs.reduce((a, b) => a + b, 0) / vs.length;
    return Math.sqrt(vs.reduce((s, v) => s + (v - m) * (v - m), 0) / vs.length);
  };
  const reds = (d: Uint8ClampedArray) => {
    const out: number[] = [];
    for (let i = 0; i < d.length; i += 4) out.push(d[i]);
    return out;
  };

  it("bilateral: smooths noise but keeps a hard edge", () => {
    const g = grid(40, 20, (x, y) => {
      const base = x < 20 ? 40 : 210;
      const v = base + (((x * 31 + y * 17) % 7) - 3);
      return [v, v, v];
    });
    const out = bilateralImage(g, 4, 28);
    const px = (x: number, y: number) => out[(y * 40 + x) * 4];
    // sides stay on their own level (no bleed across the edge)
    expect(px(18, 10)).toBeLessThan(80);
    expect(px(21, 10)).toBeGreaterThan(170);
    // and the noisy field got flatter
    expect(stddev(reds(out).filter((_, i) => i % 40 < 18))).toBeLessThan(
      stddev(reds(g.data).filter((_, i) => i % 40 < 18))
    );
  });

  it("posterize: collapses a smooth gradient into few value bands", () => {
    const g = grid(64, 8, (x) => {
      const v = Math.round((x / 63) * 255);
      return [v, v, v];
    });
    const out = posterizeLabImage(g, 4);
    const distinct = new Set(reds(out));
    expect(distinct.size).toBeLessThanOrEqual(6); // ~4 bands (+rounding)
  });

  it("xdog: flat image renders paper-white, an edge renders dark ink", () => {
    const flat = xdogImage(grid(24, 24, () => [128, 128, 128]), 50, 60);
    expect(Math.min(...reds(flat))).toBeGreaterThan(240);
    const edged = xdogImage(
      grid(40, 20, (x) => (x < 20 ? [40, 40, 40] : [220, 220, 220])),
      50,
      80
    );
    expect(Math.min(...reds(edged))).toBeLessThan(160); // ink at the boundary
  });

  it("clahe: expands the range of a low-contrast image", () => {
    const g = grid(64, 64, (x, y) => {
      const v = 110 + (((x * 13 + y * 7) % 21) - 10); // murky mid band
      return [v, v, v];
    });
    const out = claheImage(g, 3);
    const inR = reds(g.data);
    const outR = reds(out);
    const range = (vs: number[]) => Math.max(...vs) - Math.min(...vs);
    expect(range(outR)).toBeGreaterThan(range(inR) * 1.5);
  });

  it("flatten: evens out a lighting gradient", () => {
    // same 'object' value everywhere, but lit twice as bright on the right
    const g = grid(80, 40, (x) => {
      const v = Math.round(80 + (x / 79) * 120);
      return [v, v, v];
    });
    const out = flattenLightImage(g, 100);
    const left = reds(out).filter((_, i) => i % 80 < 10);
    const right = reds(out).filter((_, i) => i % 80 >= 70);
    const mean = (vs: number[]) => vs.reduce((a, b) => a + b, 0) / vs.length;
    const before = 200 - 80; // input side difference
    expect(Math.abs(mean(right) - mean(left))).toBeLessThan(before * 0.35);
  });

  it("impasto: flat image unchanged, edges gain relief", () => {
    const flat = impastoImage(grid(16, 16, () => [120, 100, 90]), 60);
    for (let i = 0; i < flat.length; i += 4) expect(flat[i]).toBe(120);
    const edged = impastoImage(
      grid(20, 10, (x) => (x < 10 ? [60, 60, 60] : [200, 200, 200])),
      60
    );
    const vals = reds(edged);
    // relief adds values outside the two input levels near the boundary
    expect(Math.min(...vals)).toBeLessThan(60);
  });
});
