// Calibration chart: a printable grid of patches the painter fills with real
// paint, photographs, and reads back to calibrate the WHOLE palette in one
// pass. The chart's geometry lives here (pure math) so the PDF generator and
// the photo reader can never disagree about where a cell is.
//
// Layout contract: the chart has a BOLD outer border rectangle; the user
// aligns that border's 4 corners in the photo (same de-keystone flow as
// Compare). Every cell rect below is normalized (0..1) WITHIN that border.
// Cell 0 is blank paper — the white-balance reference that cancels the phone
// camera's color cast for every painted patch in the same shot.

import { whiteBalance, rgbToLab, type RGB } from "./color";
import { isEnabled, type Pigment } from "./pigments";
import type { Observation, ObservationItem } from "./calibration";

export interface ChartCell {
  kind: "paper" | "pure" | "tint";
  pigmentId?: string;
  label: string;
}

export const CHART_COLS = 5;
// Fractions of the bordered area reserved for padding and the label strip
// under each patch.
const PAD = 0.02;
const LABEL_FRAC = 0.32; // bottom of each cell = printed label, not paint

// The paint cells: blank paper first, then every enabled pigment's masstone,
// then each non-white pigment's 1:3 tint with the palette's white (the classic
// strength-revealing mix). If the palette has no light pigment, tints are
// skipped and the chart still calibrates masstones/strengths from pures.
export function buildChartCells(pigments: Pigment[]): {
  cells: ChartCell[];
  white: Pigment | null;
} {
  const enabled = pigments.filter(isEnabled);
  const byL = [...enabled].sort(
    (a, b) => rgbToLab(b.rgb).L - rgbToLab(a.rgb).L
  );
  const white = byL.length && rgbToLab(byL[0].rgb).L > 75 ? byL[0] : null;
  const cells: ChartCell[] = [{ kind: "paper", label: "" }];
  for (const p of enabled)
    cells.push({ kind: "pure", pigmentId: p.id, label: p.name });
  if (white)
    for (const p of enabled) {
      if (p.id === white.id) continue;
      cells.push({
        kind: "tint",
        pigmentId: p.id,
        label: `${p.name} + ${white.name} 1:3`,
      });
    }
  return { cells, white };
}

export function chartRows(cellCount: number): number {
  return Math.ceil(cellCount / CHART_COLS);
}

// Height/width ratio of the border rectangle. Mirrors the PDF's A4 layout
// (182mm wide frame, capped at 251mm tall) — the reader needs the same aspect
// to sample cells where the printer put them.
export function chartAspect(cellCount: number): number {
  const bw = 182;
  const maxH = 251;
  const cellSide = bw / CHART_COLS;
  const bh = Math.min(maxH, chartRows(cellCount) * cellSide * 1.05);
  return bh / bw;
}

// Normalized rect (within the border) of cell i's PAINT area (label excluded).
export function cellPaintRect(
  i: number,
  cellCount: number
): { x: number; y: number; w: number; h: number } {
  const rows = chartRows(cellCount);
  const cw = (1 - PAD * 2) / CHART_COLS;
  const ch = (1 - PAD * 2) / rows;
  const col = i % CHART_COLS;
  const row = Math.floor(i / CHART_COLS);
  return {
    x: PAD + col * cw + cw * 0.08,
    y: PAD + row * ch + ch * 0.06,
    w: cw * 0.84,
    h: ch * (1 - LABEL_FRAC) - ch * 0.06,
  };
}

// Normalized rect of cell i's label strip (for the PDF generator).
export function cellLabelRect(
  i: number,
  cellCount: number
): { x: number; y: number; w: number; h: number } {
  const rows = chartRows(cellCount);
  const cw = (1 - PAD * 2) / CHART_COLS;
  const ch = (1 - PAD * 2) / rows;
  const col = i % CHART_COLS;
  const row = Math.floor(i / CHART_COLS);
  return {
    x: PAD + col * cw + cw * 0.08,
    y: PAD + row * ch + ch * (1 - LABEL_FRAC),
    w: cw * 0.84,
    h: ch * (LABEL_FRAC - 0.08),
  };
}

// Turn the sampled patch colors into calibration observations. Colors are
// white-balanced against the blank paper cell (cancels the camera cast; the
// value is kept as measured since paper ~ the white the tints sit on). A null
// color (unpainted / unreadable patch) is skipped.
export function observationsFromChart(
  cells: ChartCell[],
  colors: (RGB | null)[],
  white: Pigment | null
): { items: ObservationItem[]; observed: RGB }[] {
  const paper = cells[0]?.kind === "paper" ? colors[0] : null;
  const out: { items: ObservationItem[]; observed: RGB }[] = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const raw = colors[i];
    if (!raw || cell.kind === "paper" || !cell.pigmentId) continue;
    const observed = paper ? whiteBalance(raw, paper) : raw;
    if (cell.kind === "pure") {
      out.push({ items: [{ pigmentId: cell.pigmentId, weight: 1 }], observed });
    } else if (cell.kind === "tint" && white) {
      out.push({
        items: [
          { pigmentId: white.id, weight: 3 },
          { pigmentId: cell.pigmentId, weight: 1 },
        ],
        observed,
      });
    }
  }
  return out;
}

// Convenience for tests / callers: which existing observations would the chart
// duplicate (same pigment-id set)?
export function chartDuplicates(
  chartObs: { items: ObservationItem[] }[],
  existing: Observation[]
): number {
  const seen = new Set(
    existing.map((o) =>
      o.items
        .filter((i) => i.weight > 0)
        .map((i) => i.pigmentId)
        .sort()
        .join("+")
    )
  );
  return chartObs.filter((o) =>
    seen.has(
      o.items
        .map((i) => i.pigmentId)
        .sort()
        .join("+")
    )
  ).length;
}
