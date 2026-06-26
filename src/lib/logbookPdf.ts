// Build a polished PDF for one Logbook project (jsPDF, lazy-loaded on use).
// Accent header bar, a palette strip of every color, framed project photos and
// a card-like row per color entry. Runs in the browser; no backend.

import { hexToRgb } from "./color";
import type { LogProject, LogEntry } from "./logbook";

export interface PdfLabels {
  reference: string;
  finished: string;
  colors: string;
  palette: string;
  recipe: string;
  notes: string;
  unnamed: string;
  generated: string;
}

const ACCENT: [number, number, number] = [226, 105, 30];
const INK: [number, number, number] = [28, 28, 32];
const MUTED: [number, number, number] = [122, 122, 130];
const LINE: [number, number, number] = [224, 224, 229];

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export async function exportProjectPdf(
  project: LogProject,
  entries: LogEntry[],
  labels: PdfLabels
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const M = 16; // margin
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const cw = pageW - M * 2;
  let y = M + 6;

  const ensure = (need: number) => {
    if (y + need > pageH - M) {
      doc.addPage();
      y = M + 6;
    }
  };

  const para = (
    text: string,
    size: number,
    color: [number, number, number],
    gap: number,
    style: "normal" | "italic" = "normal"
  ) => {
    if (!text) return;
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, cw) as string[];
    const lh = size * 0.42;
    for (const line of lines) {
      ensure(lh);
      doc.text(line, M, y);
      y += lh;
    }
    y += gap;
  };

  const swatch = (x: number, yy: number, size: number, hex?: string) => {
    const rgb = hex ? hexToRgb(hex) : null;
    if (rgb) doc.setFillColor(rgb.r, rgb.g, rgb.b);
    else doc.setFillColor(238, 238, 240);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, yy, size, size, 1.2, 1.2, rgb ? "FD" : "D");
  };

  const sectionLabel = (text: string) => {
    ensure(7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(text.toUpperCase(), M, y);
    y += 4;
  };

  const addImage = async (blob: Blob, label: string, maxH: number) => {
    let data: string;
    try {
      data = await blobToDataURL(blob);
    } catch {
      return;
    }
    let props: { width: number; height: number };
    try {
      props = doc.getImageProperties(data);
    } catch {
      return;
    }
    const ratio = props.height / props.width || 1;
    let w = cw;
    let h = w * ratio;
    if (h > maxH) {
      h = maxH;
      w = h / ratio;
    }
    sectionLabel(label);
    ensure(h + 2);
    const fmt = data.startsWith("data:image/png") ? "PNG" : "JPEG";
    doc.addImage(data, fmt, M, y, w, h);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, w, h, 1.5, 1.5, "D");
    y += h + 7;
  };

  // ---- Title ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text(project.name || "—", M, y + 4);
  y += 10;
  // accent underline
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.8);
  doc.line(M, y, M + 22, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(new Date(project.updatedAt).toLocaleDateString(), M, y);
  y += 7;

  if (project.notes) para(project.notes, 10, [70, 70, 76], 6);

  // ---- Palette strip (all entry colors at a glance) ----
  const hexes = entries.map((e) => e.hex).filter((h): h is string => !!h);
  if (hexes.length) {
    sectionLabel(labels.palette);
    const s = 9;
    const gap = 2.5;
    let x = M;
    ensure(s + 2);
    for (const hex of hexes) {
      if (x + s > M + cw) {
        x = M;
        y += s + gap;
        ensure(s + 2);
      }
      swatch(x, y, s, hex);
      x += s + gap;
    }
    y += s + 8;
  }

  // ---- Project photos ----
  if (project.reference) await addImage(project.reference, labels.reference, 95);
  if (project.finished) await addImage(project.finished, labels.finished, 95);

  // ---- Colors ----
  if (entries.length) {
    ensure(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(labels.colors, M, y);
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.6);
    doc.line(M, y + 1.6, M + doc.getTextWidth(labels.colors), y + 1.6);
    y += 8;
  }

  for (const e of entries) {
    ensure(16);
    // swatch + name + hex on one row
    const sw = 9;
    swatch(M, y - sw + 2, sw, e.hex);
    const tx = M + sw + 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(e.name || labels.unnamed, tx, y);
    if (e.hex) {
      const nameW = doc.getTextWidth(e.name || labels.unnamed);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...ACCENT);
      doc.text(e.hex, tx + nameW + 3, y);
    }
    y += 6;

    if (e.recipe) para(e.recipe, 10, INK, 2);
    if (e.notes) para(e.notes, 9, MUTED, 3, "italic");

    if (e.swatch) await addImage(e.swatch, labels.colors, 48);
    if (e.ref) await addImage(e.ref, labels.reference, 48);

    ensure(5);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, y, pageW - M, y);
    y += 6;
  }

  // ---- Accent top bar + footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(...ACCENT);
    doc.rect(0, 0, pageW, 3, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(165, 165, 170);
    doc.text(labels.generated, M, pageH - 8);
    doc.text(`${p} / ${pages}`, pageW - M, pageH - 8, { align: "right" });
  }

  const safe = (project.name || "project").replace(/[^\w-]+/g, "_").slice(0, 60);
  doc.save(`${safe}.pdf`);
}
