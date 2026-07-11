import { describe, it, expect } from "vitest";
import {
  buildChartCells,
  cellPaintRect,
  cellLabelRect,
  chartAspect,
  observationsFromChart,
  chartDuplicates,
  CHART_COLS,
} from "@/lib/chart";
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

const white = P("white", { r: 250, g: 250, b: 250 });
const red = P("red", { r: 200, g: 30, b: 40 });
const blue = P("blue", { r: 30, g: 50, b: 170 });

describe("calibration chart", () => {
  it("builds paper + pures + tints (tints skip the white itself)", () => {
    const { cells, white: w } = buildChartCells([white, red, blue]);
    expect(w?.id).toBe("white");
    expect(cells[0].kind).toBe("paper");
    expect(cells.filter((c) => c.kind === "pure")).toHaveLength(3);
    const tints = cells.filter((c) => c.kind === "tint");
    expect(tints).toHaveLength(2); // red, blue — not white+white
    expect(tints.every((c) => c.pigmentId !== "white")).toBe(true);
  });

  it("skips disabled pigments and works without a white", () => {
    const { cells, white: w } = buildChartCells([
      { ...red, enabled: false },
      P("dark", { r: 40, g: 40, b: 40 }),
      blue,
    ]);
    expect(w).toBeNull(); // nothing light enough
    expect(cells.filter((c) => c.kind === "pure")).toHaveLength(2);
    expect(cells.filter((c) => c.kind === "tint")).toHaveLength(0);
  });

  it("cell rects stay inside the border and don't overlap their label", () => {
    const n = 11;
    for (let i = 0; i < n; i++) {
      const p = cellPaintRect(i, n);
      const l = cellLabelRect(i, n);
      for (const r of [p, l]) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(1);
        expect(r.y + r.h).toBeLessThanOrEqual(1);
      }
      expect(p.y + p.h).toBeLessThanOrEqual(l.y + 1e-9); // paint above label
    }
    expect(chartAspect(n)).toBeGreaterThan(0);
    expect(CHART_COLS).toBeGreaterThan(1);
  });

  it("turns sampled colors into observations, white-balanced vs paper", () => {
    const { cells, white: w } = buildChartCells([white, red]);
    // paper photographed with a warm cast; red patch carries the same cast
    const colors: (RGB | null)[] = cells.map((c) =>
      c.kind === "paper"
        ? { r: 250, g: 240, b: 210 }
        : c.kind === "pure" && c.pigmentId === "red"
        ? { r: 210, g: 45, b: 40 }
        : { r: 240, g: 235, b: 205 }
    );
    const obs = observationsFromChart(cells, colors, w);
    // one per pure (2) + one tint (red) = 3
    expect(obs).toHaveLength(3);
    const pureRed = obs.find(
      (o) => o.items.length === 1 && o.items[0].pigmentId === "red"
    )!;
    // the warm cast is (partly) cancelled: blue channel lifted vs raw
    expect(pureRed.observed.b).toBeGreaterThan(40);
    const tint = obs.find((o) => o.items.length === 2)!;
    expect(tint.items.map((i) => i.pigmentId).sort()).toEqual(["red", "white"]);
    expect(tint.items.find((i) => i.pigmentId === "white")!.weight).toBe(3);
  });

  it("counts duplicates against existing observations", () => {
    const { cells, white: w } = buildChartCells([white, red]);
    const colors = cells.map(() => ({ r: 100, g: 100, b: 100 }));
    const obs = observationsFromChart(cells, colors, w);
    const dups = chartDuplicates(obs, [
      {
        id: "e1",
        items: [
          { pigmentId: "white", weight: 3 },
          { pigmentId: "red", weight: 1 },
        ],
        observed: { r: 1, g: 2, b: 3 },
      },
    ]);
    expect(dups).toBe(1); // the red tint repeats
  });
});
