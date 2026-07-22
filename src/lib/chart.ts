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

import { whiteBalance, rgbToLab, deltaE2000, type RGB } from "./color";
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

// Signature of a MIX: its pigments AND their proportions (normalized weights,
// rounded). Two observations with the same signature are "the same mix" — e.g.
// white:3+red:1 differs from white:2+red:1. Used to match a chart patch against
// what's already been recorded.
function mixSignature(items: { pigmentId: string; weight: number }[]): string {
  const active = items.filter((i) => i.weight > 0);
  const sum = active.reduce((s, i) => s + i.weight, 0) || 1;
  return active
    .map((i) => ({ id: i.pigmentId, w: i.weight / sum }))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((x) => `${x.id}:${x.w.toFixed(2)}`)
    .join("+");
}

export type ChartMatch = "new" | "exact" | "conflict";

export interface ClassifiedObs {
  items: ObservationItem[];
  observed: RGB;
  kind: ChartMatch;
  // The existing observation this one matches (for "exact" / "conflict").
  existing?: Observation;
  // ΔE2000 between the chart color and the existing one (for "conflict" UI).
  deltaE?: number;
}

// Classify each chart observation against what's already recorded:
//  • "new"      — no existing observation is the same mix → add it.
//  • "exact"    — same mix AND essentially the same measured color (ΔE ≤
//                 exactDE) → skip it (re-adding only double-weights the mix).
//  • "conflict" — same mix but a DIFFERENT color → let the user decide whether
//                 to keep the existing reading or replace it with the chart's.
export function classifyChartObservations(
  chartObs: { items: ObservationItem[]; observed: RGB }[],
  existing: Observation[],
  exactDE = 2
): ClassifiedObs[] {
  const bySig = new Map<string, Observation>();
  for (const o of existing) bySig.set(mixSignature(o.items), o);
  return chartObs.map((o) => {
    const ex = bySig.get(mixSignature(o.items));
    if (!ex) return { ...o, kind: "new" as const };
    const dE = deltaE2000(rgbToLab(o.observed), rgbToLab(ex.observed));
    return {
      ...o,
      kind: (dE <= exactDE ? "exact" : "conflict") as ChartMatch,
      existing: ex,
      deltaE: dE,
    };
  });
}
