// Build a printable PDF for one Logbook project (jsPDF, lazy-loaded on use).
// Includes the project's reference + finished photos and every color entry
// (chip, name, recipe, notes, photos). Runs in the browser; no backend.

import { hexToRgb } from "./color";
import type { LogProject, LogEntry } from "./logbook";

export interface PdfLabels {
  reference: string;
  finished: string;
  colors: string;
  recipe: string;
  notes: string;
  unnamed: string;
  generated: string;
}

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

  const M = 15; // margin
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const cw = pageW - M * 2;
  let y = M;

  const ensure = (need: number) => {
    if (y + need > pageH - M) {
      doc.addPage();
      y = M;
    }
  };

  const para = (
    text: string,
    size = 10,
    color: [number, number, number] = [40, 40, 40],
    gap = 4
  ) => {
    if (!text) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, cw) as string[];
    const lh = size * 0.42;
    ensure(lines.length * lh);
    doc.text(lines, M, y);
    y += lines.length * lh + gap;
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
    // label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    ensure(5 + h);
    doc.text(label.toUpperCase(), M, y);
    y += 4;
    const fmt = data.startsWith("data:image/png") ? "PNG" : "JPEG";
    doc.addImage(data, fmt, M, y, w, h);
    y += h + 6;
  };

  // ---- Title ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text(project.name || "—", M, y + 6);
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(new Date(project.updatedAt).toLocaleDateString(), M, y);
  y += 7;

  if (project.notes) para(project.notes, 10, [60, 60, 60], 6);

  // ---- Project photos ----
  if (project.reference) await addImage(project.reference, labels.reference, 90);
  if (project.finished) await addImage(project.finished, labels.finished, 90);

  // ---- Colors ----
  ensure(10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(labels.colors, M, y);
  y += 7;

  for (const e of entries) {
    ensure(14);
    // chip + name + hex
    let x = M;
    if (e.hex) {
      const rgb = hexToRgb(e.hex);
      if (rgb) {
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        doc.setDrawColor(200, 200, 200);
        doc.rect(M, y - 3.5, 5, 5, "FD");
        x = M + 7;
      }
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(e.name || labels.unnamed, x, y);
    if (e.hex) {
      const nameW = doc.getTextWidth(e.name || labels.unnamed);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(130, 130, 130);
      doc.text(e.hex, x + nameW + 3, y);
    }
    y += 5;

    if (e.recipe) para(e.recipe, 10, [40, 40, 40], 2);
    if (e.notes) para(e.notes, 9, [110, 110, 110], 3);

    if (e.swatch) await addImage(e.swatch, labels.colors, 45);
    if (e.ref) await addImage(e.ref, labels.reference, 45);

    // separator
    ensure(4);
    doc.setDrawColor(225, 225, 225);
    doc.line(M, y, pageW - M, y);
    y += 5;
  }

  // ---- Footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(labels.generated, M, pageH - 8);
    doc.text(`${p} / ${pages}`, pageW - M, pageH - 8, { align: "right" });
  }

  const safe = (project.name || "project").replace(/[^\w\-]+/g, "_").slice(0, 60);
  doc.save(`${safe}.pdf`);
}
