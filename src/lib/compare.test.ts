import { describe, it, expect } from "vitest";
import { solveHomography, valueHistogram, type LabField, type Pt } from "@/lib/compare";

// Apply a homography given as 8 coeffs (row-major, with h33 = 1 implied).
function applyH(H: number[], p: Pt): Pt {
  const d = H[6] * p.x + H[7] * p.y + 1;
  return {
    x: (H[0] * p.x + H[1] * p.y + H[2]) / d,
    y: (H[3] * p.x + H[4] * p.y + H[5]) / d,
  };
}

describe("compare", () => {
  it("solveHomography maps the source corners onto the destination", () => {
    const src: Pt[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const dst: Pt[] = [
      { x: 10, y: 12 },
      { x: 30, y: 10 },
      { x: 28, y: 26 },
      { x: 8, y: 24 },
    ];
    const H = solveHomography(src, dst);
    expect(H).not.toBeNull();
    expect(H).toHaveLength(8);
    for (let i = 0; i < 4; i++) {
      const q = applyH(H!, src[i]);
      expect(q.x).toBeCloseTo(dst[i].x, 3);
      expect(q.y).toBeCloseTo(dst[i].y, 3);
    }
  });

  it("solveHomography returns null for degenerate (coincident) corners", () => {
    const src: Pt[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    // Two destination corners dragged onto the same point → no valid quad.
    const dst: Pt[] = [
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      { x: 30, y: 30 },
      { x: 10, y: 30 },
    ];
    expect(solveHomography(src, dst)).toBeNull();
  });

  it("valueHistogram is peak-normalized (max bin = 1)", () => {
    // Two value clusters of different sizes: 75 dark + 25 light pixels.
    const n = 100;
    const L = new Float32Array(n);
    L.fill(20, 0, 75);
    L.fill(80, 75);
    const f: LabField = {
      L,
      a: new Float32Array(n),
      b: new Float32Array(n),
      w: 10,
      h: 10,
    };
    const hist = valueHistogram(f, 24);
    expect(hist).toHaveLength(24);
    // Normalized by the MAX bin (bar heights), not by the sum: the tallest bin
    // is exactly 1 and the smaller cluster's bin is its relative share.
    expect(Math.max(...hist)).toBeCloseTo(1, 5);
    const sorted = [...hist].sort((a, b) => b - a);
    expect(sorted[1]).toBeCloseTo(25 / 75, 5);
    // everything at one L lands in a single bin per cluster
    expect(hist.filter((v) => v > 0)).toHaveLength(2);
  });
});
