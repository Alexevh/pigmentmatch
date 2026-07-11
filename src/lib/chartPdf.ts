// Printable calibration chart PDF (jsPDF, lazy-loaded). The geometry comes
// from chart.ts (cellPaintRect/cellLabelRect within a bold border rectangle),
// so what the reader samples is exactly what this prints.

import {
  buildChartCells,
  cellPaintRect,
  cellLabelRect,
  chartAspect,
} from "./chart";
import type { Pigment } from "./pigments";

export interface ChartPdfLabels {
  title: string;
  intro: string;
  paper: string;
}

export async function exportCalibrationChartPdf(
  pigments: Pigment[],
  paletteName: string,
  labels: ChartPdfLabels
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth(); // 210
  const pageH = doc.internal.pageSize.getHeight(); // 297

  const { cells } = buildChartCells(pigments);

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(28, 28, 32);
  doc.text(`${labels.title} — ${paletteName}`, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 118);
  const intro = doc.splitTextToSize(labels.intro, pageW - 28);
  doc.text(intro, 14, 22);

  // Bold border rectangle — the registration frame the user aligns in the
  // photo. Its aspect comes from chart.ts so the reader samples exactly here.
  const bx = 14;
  const by = 34;
  const bw = pageW - 28;
  const bh = Math.min(pageH - by - 12, bw * chartAspect(cells.length));
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1.6);
  doc.rect(bx, by, bw, bh);
  doc.setLineWidth(0.25);

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const pr = cellPaintRect(i, cells.length);
    const lr = cellLabelRect(i, cells.length);
    const px = bx + pr.x * bw;
    const py = by + pr.y * bh;
    const pw = pr.w * bw;
    const ph = pr.h * bh;
    // paint area outline (dashed-ish light grey so paint edges don't matter)
    doc.setDrawColor(170, 170, 178);
    doc.rect(px, py, pw, ph);
    if (cell.kind === "paper") {
      doc.setFontSize(7.5);
      doc.setTextColor(150, 150, 158);
      doc.text(labels.paper, px + pw / 2, py + ph / 2, {
        align: "center",
        baseline: "middle",
      });
    }
    // label
    if (cell.label) {
      doc.setFontSize(7);
      doc.setTextColor(60, 60, 66);
      const tx = bx + lr.x * bw;
      const ty = by + lr.y * bh + 3;
      const wrapped = doc.splitTextToSize(cell.label, lr.w * bw);
      doc.text(wrapped.slice(0, 2), tx, ty);
    }
  }

  doc.save("pigmentmatch-calibration-chart.pdf");
}
