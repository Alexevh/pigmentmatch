// Elegant user-manual PDF, generated on demand from manual.ts in the user's
// active language (jsPDF, lazy-loaded — same pattern as the logbook and chart
// PDFs; no backend). Cover page, table of contents with page numbers, sections
// with worked examples, tips, page footers — and FIGURES drawn as vectors from
// REAL engine output (actual recipes, value strings, gamut hulls, white-balance
// corrections), so every illustration shows true colors, not screenshots.

import type { ManualContent } from "./manual";
import { rgbToLab, whiteBalance, buildVariations, type RGB } from "./color";
import { generateRecipe, predictMix } from "./mixer";
import { buildColorString } from "./strings";
import { quantifyAdjustment } from "./coach";
import { valuePlanes } from "./extract";
import { DEFAULT_PIGMENTS, WINSOR_NEWTON_PIGMENTS } from "./pigments";

// Which figure illustrates which section, BY INDEX — must follow the section
// order in manual.ts (same order in both languages).
const FIGURES: Record<number, string> = {
  1: "recipe",
  2: "string",
  3: "vargamut",
  4: "wb",
  5: "notan",
  6: "scene",
  7: "coach",
  9: "compare",
  10: "stencil",
  12: "chart",
  13: "tubes",
};

const ACCENT: [number, number, number] = [226, 105, 30];
const INK: [number, number, number] = [28, 28, 32];
const MUTED: [number, number, number] = [116, 116, 124];
const LINE: [number, number, number] = [222, 222, 227];
const BOX: [number, number, number] = [247, 244, 240];

const M = 18; // page margin (mm)

// ---------------------------------------------------------------------------
// Figures — vector illustrations computed from the REAL engine at build time.
// ---------------------------------------------------------------------------

type Doc = InstanceType<(typeof import("jspdf"))["jsPDF"]>;

const ROSE: RGB = { r: 146, g: 112, b: 115 }; // the app's classic example
const SKIN: RGB = { r: 205, g: 155, b: 130 };

const FIG_H: Record<string, number> = {
  recipe: 26,
  string: 20,
  vargamut: 42,
  wb: 24,
  notan: 20,
  scene: 24,
  coach: 26,
  compare: 26,
  stencil: 24,
  chart: 34,
  tubes: 14,
};

function chip(doc: Doc, x: number, y: number, w: number, h: number, c: RGB) {
  doc.setFillColor(c.r, c.g, c.b);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 1.2, 1.2, "FD");
}

function tinyLabel(
  doc: Doc,
  text: string,
  x: number,
  y: number,
  align: "left" | "center" | "right" = "center"
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.3);
  doc.setTextColor(...MUTED);
  doc.text(text, x, y, { align });
}

function arrow(doc: Doc, x1: number, y: number, x2: number) {
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.35);
  doc.line(x1, y, x2, y);
  doc.line(x2 - 1.4, y - 1, x2, y);
  doc.line(x2 - 1.4, y + 1, x2, y);
}

// Draw figure `id` at (x, y) within width w; returns the height used.
function drawFigure(doc: Doc, id: string, x: number, y: number, w: number): number {
  const lighten = (c: RGB, f: number): RGB => ({
    r: Math.round(c.r + (255 - c.r) * f),
    g: Math.round(c.g + (255 - c.g) * f),
    b: Math.round(c.b + (255 - c.b) * f),
  });

  if (id === "recipe") {
    // A real recipe for the classic example color, with true pigment colors.
    const r = generateRecipe(ROSE, DEFAULT_PIGMENTS, "simple");
    let cx = x + 2;
    const cy = y + 4;
    r.items.forEach((it, i) => {
      if (i > 0) {
        doc.setFontSize(9);
        doc.setTextColor(...MUTED);
        doc.text("+", cx + 1.2, cy + 5.4);
        cx += 5;
      }
      chip(doc, cx, cy, 8, 8, it.pigment.rgb);
      tinyLabel(doc, it.parts != null ? `${it.parts}×` : "·", cx + 4, cy + 11.6);
      cx += 9.5;
    });
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("=", cx + 1.6, cy + 5.4);
    cx += 6.5;
    chip(doc, cx, cy - 1, 10, 10, r.mixed);
    tinyLabel(doc, `${r.match}%`, cx + 5, cy + 12.4);
    cx += 13;
    doc.setFontSize(8);
    doc.text("≈", cx, cy + 5.2);
    cx += 4;
    chip(doc, cx, cy - 1, 10, 10, ROSE);
    tinyLabel(doc, "#927073", cx + 5, cy + 12.4);
    return FIG_H.recipe;
  }

  if (id === "string") {
    // The real light→shadow string of the example mix.
    const cs = buildColorString(ROSE, DEFAULT_PIGMENTS);
    if (!cs) return 0;
    const n = cs.steps.length;
    const sw = Math.min(16, (w - 4) / n);
    const total = sw * n;
    const x0 = x + (w - total) / 2;
    cs.steps.forEach((s, i) => {
      doc.setFillColor(s.rgb.r, s.rgb.g, s.rgb.b);
      doc.rect(x0 + i * sw, y + 2, sw, 10, "F");
      tinyLabel(doc, String(Math.round(s.L)), x0 + i * sw + sw / 2, y + 15.4);
      if (i === cs.baseIndex) {
        doc.setFillColor(255, 255, 255);
        doc.circle(x0 + i * sw + sw / 2, y + 4, 0.8, "F");
      }
    });
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.rect(x0, y + 2, total, 10);
    return FIG_H.string;
  }

  if (id === "vargamut") {
    // Left: the six real variations. Right: a mini gamut hull of the default
    // palette with an out-of-reach target crosshair.
    const vars = buildVariations(ROSE);
    let cx = x + 2;
    vars.forEach((v) => {
      chip(doc, cx, y + 2, 9, 9, v.rgb);
      cx += 11;
    });
    chip(doc, x + 2, y + 14, 9, 9, ROSE);
    tinyLabel(doc, "•", x + 6.5, y + 19.5);

    const gx = x + w - 40;
    const gy = y + 2;
    const gs = 36;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.rect(gx, gy, gs, gs);
    doc.line(gx, gy + gs / 2, gx + gs, gy + gs / 2);
    doc.line(gx + gs / 2, gy, gx + gs / 2, gy + gs);
    const m = 75;
    const px = (a: number) => gx + gs / 2 + (a / m) * (gs / 2);
    const py = (b: number) => gy + gs / 2 - (b / m) * (gs / 2);
    const pts = DEFAULT_PIGMENTS.map((p) => {
      const lab = rgbToLab(p.rgb);
      return { a: lab.a, b: lab.b, rgb: p.rgb };
    });
    // convex hull (monotone chain) over (a, b)
    const sorted = [...pts].sort((p, q) => p.a - q.a || p.b - q.b);
    const cross = (o: typeof pts[0], A: typeof pts[0], B: typeof pts[0]) =>
      (A.a - o.a) * (B.b - o.b) - (A.b - o.b) * (B.a - o.a);
    const lower: typeof pts = [];
    for (const p of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper: typeof pts = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
    doc.setDrawColor(...MUTED);
    doc.setLineWidth(0.35);
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i];
      const b = hull[(i + 1) % hull.length];
      doc.line(px(a.a), py(a.b), px(b.a), py(b.b));
    }
    for (const p of pts) {
      doc.setFillColor(p.rgb.r, p.rgb.g, p.rgb.b);
      doc.circle(px(p.a), py(p.b), 1.3, "F");
    }
    // an out-of-gamut target (vivid teal): crosshair outside the hull
    const tl = rgbToLab({ r: 0, g: 190, b: 170 });
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.5);
    const tx = px(tl.a);
    const ty = py(tl.b);
    doc.line(tx - 2.2, ty, tx + 2.2, ty);
    doc.line(tx, ty - 2.2, tx, ty + 2.2);
    doc.circle(tx, ty, 1.5);
    return FIG_H.vargamut;
  }

  if (id === "wb") {
    // Real whiteBalance() output: warm-cast samples vs corrected.
    const cast = (c: RGB): RGB => ({
      r: Math.min(255, Math.round(c.r * 1.1)),
      g: c.g,
      b: Math.round(c.b * 0.74),
    });
    const castedWhite = cast({ r: 245, g: 245, b: 243 });
    const samples: RGB[] = [SKIN, { r: 160, g: 160, b: 158 }, { r: 70, g: 100, b: 150 }];
    let cx = x + 2;
    for (const s of samples) {
      const bad = cast(s);
      const good = whiteBalance(bad, castedWhite);
      chip(doc, cx, y + 3, 9, 9, bad);
      arrow(doc, cx + 10.5, y + 7.5, cx + 16.5);
      chip(doc, cx + 18, y + 3, 9, 9, good);
      cx += 34;
    }
    tinyLabel(doc, "⌂", x + w - 14, y + 8);
    chip(doc, x + w - 12, y + 3, 9, 9, castedWhite);
    tinyLabel(doc, "→ ⚪", x + w - 7.5, y + 15.6);
    return FIG_H.wb;
  }

  if (id === "notan") {
    // Real valuePlanes() over a synthetic value distribution.
    const mk = (c: RGB, n: number) => Array.from({ length: n }, () => c);
    const pixels: RGB[] = [
      ...mk({ r: 238, g: 224, b: 200 }, 30),
      ...mk({ r: 190, g: 150, b: 118 }, 26),
      ...mk({ r: 118, g: 88, b: 68 }, 26),
      ...mk({ r: 48, g: 40, b: 36 }, 18),
    ];
    const planes = valuePlanes(pixels, 4);
    let cx = x + 2;
    const total = w - 4;
    for (const p of planes) {
      const pw = Math.max(8, total * p.share);
      doc.setFillColor(p.mean.r, p.mean.g, p.mean.b);
      doc.rect(cx, y + 2, pw, 10, "F");
      tinyLabel(doc, `${Math.round(p.share * 100)}%`, cx + pw / 2, y + 15.4);
      cx += pw;
    }
    doc.setDrawColor(...LINE);
    doc.rect(x + 2, y + 2, total, 10);
    return FIG_H.notan;
  }

  if (id === "scene") {
    // Warm light / cool shadow, and a warm zone nudged cool.
    const light: RGB = { r: 236, g: 208, b: 160 };
    const shadow: RGB = { r: 92, g: 96, b: 122 };
    chip(doc, x + 2, y + 3, 12, 12, light);
    // little sun
    doc.setFillColor(255, 214, 90);
    doc.circle(x + 5.4, y + 6.4, 1.5, "F");
    chip(doc, x + 17, y + 3, 12, 12, shadow);
    // the relational nudge: warm shadow → cooled shadow (+ ultramarine dot)
    const zone: RGB = { r: 124, g: 102, b: 92 };
    const cooled: RGB = { r: 108, g: 102, b: 110 };
    const zx = x + w - 62;
    chip(doc, zx, y + 3, 10, 10, zone);
    arrow(doc, zx + 12, y + 8, zx + 20);
    const ub = DEFAULT_PIGMENTS.find((p) => p.id === "ultramarine-blue");
    if (ub) {
      doc.setFillColor(ub.rgb.r, ub.rgb.g, ub.rgb.b);
      doc.circle(zx + 24, y + 8, 2, "F");
      tinyLabel(doc, "+3%", zx + 24, y + 14.6);
    }
    arrow(doc, zx + 28, y + 8, zx + 36);
    chip(doc, zx + 38, y + 3, 10, 10, cooled);
    return FIG_H.scene;
  }

  if (id === "coach") {
    // A real quantified adjustment: current puddle → best addition → predicted.
    const current: RGB = { r: 182, g: 152, b: 142 };
    const q = quantifyAdjustment(SKIN, current, DEFAULT_PIGMENTS);
    let cx = x + 2;
    chip(doc, cx, y + 3, 10, 10, current);
    cx += 13;
    if (q) {
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text("+", cx, y + 9);
      cx += 4;
      doc.setFillColor(q.pigment.rgb.r, q.pigment.rgb.g, q.pigment.rgb.b);
      doc.circle(cx + 2, y + 8, 2.4, "F");
      const per = q.fraction > 0 ? Math.round((1 - q.fraction) / q.fraction) : 0;
      tinyLabel(doc, `1 : ${per}`, cx + 2, y + 15.6);
      cx += 8;
      arrow(doc, cx, y + 8, cx + 8);
      cx += 10;
      chip(doc, cx, y + 3, 10, 10, q.predicted);
      cx += 13;
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text("≈", cx, y + 8.8);
      cx += 4;
      chip(doc, cx, y + 3, 10, 10, SKIN);
    }
    return FIG_H.coach;
  }

  if (id === "compare") {
    // Reference vs WIP value bands + a difference strip.
    const ref = [
      { r: 226, g: 210, b: 184 },
      { r: 168, g: 136, b: 108 },
      { r: 84, g: 66, b: 54 },
    ];
    const wip = [
      { r: 236, g: 226, b: 206 },
      { r: 186, g: 160, b: 128 },
      { r: 76, g: 62, b: 52 },
    ];
    const bw = 30;
    const bh = 6;
    ref.forEach((c, i) => {
      doc.setFillColor(c.r, c.g, c.b);
      doc.rect(x + 2, y + 2 + i * bh, bw, bh, "F");
    });
    wip.forEach((c, i) => {
      doc.setFillColor(c.r, c.g, c.b);
      doc.rect(x + 2 + bw + 6, y + 2 + i * bh, bw, bh, "F");
    });
    doc.setDrawColor(...LINE);
    doc.rect(x + 2, y + 2, bw, bh * 3);
    doc.rect(x + 2 + bw + 6, y + 2, bw, bh * 3);
    // difference "heat" strip
    const heat: RGB[] = [
      { r: 60, g: 170, b: 90 },
      { r: 150, g: 190, b: 70 },
      { r: 235, g: 190, b: 60 },
      { r: 225, g: 90, b: 60 },
    ];
    heat.forEach((c, i) => {
      doc.setFillColor(c.r, c.g, c.b);
      doc.rect(x + 2 + bw * 2 + 12 + i * 6, y + 8, 6, 6, "F");
    });
    return FIG_H.compare;
  }

  if (id === "stencil") {
    // Photo → line art.
    chip(doc, x + 2, y + 2, 24, 18, { r: 205, g: 150, b: 95 });
    doc.setFillColor(178, 62, 48);
    doc.circle(x + 14, y + 11, 5.4, "F");
    doc.setFillColor(90, 130, 60);
    doc.circle(x + 17.5, y + 5.6, 1.5, "F");
    arrow(doc, x + 30, y + 11, x + 38);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x + 40, y + 2, 24, 18, 1.2, 1.2, "FD");
    doc.setDrawColor(40, 40, 44);
    doc.setLineWidth(0.5);
    doc.circle(x + 52, y + 11, 5.4);
    doc.circle(x + 55.5, y + 5.6, 1.5);
    return FIG_H.stencil;
  }

  if (id === "chart") {
    // Mini calibration chart: bold border, paper cell, masstones + real tints.
    const white = WINSOR_NEWTON_PIGMENTS[0];
    const picks = WINSOR_NEWTON_PIGMENTS.slice(1, 6);
    const cell = 11;
    const bw = cell * 6 + 4;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.rect(x + 2, y + 2, bw, cell * 2 + 6);
    doc.setLineWidth(0.25);
    // paper cell (dashed)
    doc.setDrawColor(...MUTED);
    doc.setLineDashPattern([1, 1], 0);
    doc.rect(x + 4.5, y + 4.5, cell - 2, cell - 2);
    doc.setLineDashPattern([], 0);
    picks.forEach((p, i) => {
      const cx = x + 4.5 + (i + 1) * cell;
      chip(doc, cx, y + 4.5, cell - 2, cell - 2, p.rgb);
      // 1:3 tint row, predicted with the real engine
      const tint = predictMix([p, white], [0.25, 0.75]);
      chip(doc, cx, y + 4.5 + cell, cell - 2, cell - 2, tint);
    });
    chip(doc, x + 4.5, y + 4.5 + cell, cell - 2, cell - 2, lighten(white.rgb, 0.1));
    return FIG_H.chart;
  }

  if (id === "tubes") {
    // A strip of the W&N palette's real masstones.
    let cx = x + 2;
    for (const p of WINSOR_NEWTON_PIGMENTS.slice(0, 14)) {
      doc.setFillColor(p.rgb.r, p.rgb.g, p.rgb.b);
      doc.setDrawColor(...LINE);
      doc.circle(cx + 3, y + 6, 3, "FD");
      cx += 8.2;
    }
    return FIG_H.tubes;
  }

  return 0;
}

export async function exportManualPdf(
  content: ManualContent,
  filename = "pigmentmatch-manual.pdf"
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const CW = W - M * 2; // content width
  const BOTTOM = H - 20;

  // ---------- cover ----------
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, W, 6, "F");
  // a painterly strip of swatches
  const swatches = [
    [226, 105, 30],
    [196, 44, 36],
    [123, 73, 140],
    [28, 26, 64],
    [44, 117, 170],
    [10, 58, 48],
    [252, 205, 42],
    [170, 110, 47],
    [46, 34, 28],
    [248, 244, 234],
  ] as const;
  const sw = 12;
  const startX = (W - swatches.length * (sw + 2)) / 2;
  swatches.forEach((c, i) => {
    doc.setFillColor(c[0], c[1], c[2]);
    doc.roundedRect(startX + i * (sw + 2), 92, sw, sw, 1.6, 1.6, "F");
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.setTextColor(...INK);
  doc.text(content.title, W / 2, 126, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(...MUTED);
  const sub = doc.splitTextToSize(content.subtitle, CW - 20);
  doc.text(sub, W / 2, 137, { align: "center" });
  doc.setFontSize(9);
  doc.text(content.generatedNote, W / 2, H - 24, { align: "center" });
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.8);
  doc.line(W / 2 - 22, 145 + sub.length * 4, W / 2 + 22, 145 + sub.length * 4);

  // ---------- reserve the TOC page ----------
  doc.addPage();
  const tocPage = 2;

  // ---------- sections ----------
  doc.addPage();
  let y = M;
  const tocEntries: { title: string; page: number }[] = [];

  const pageNum = () => doc.getCurrentPageInfo().pageNumber;
  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      y = M;
    }
  };
  const paragraph = (
    text: string,
    size: number,
    color: readonly [number, number, number],
    lineH: number,
    indent = 0
  ) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines: string[] = doc.splitTextToSize(text, CW - indent);
    for (const line of lines) {
      ensure(lineH);
      doc.text(line, M + indent, y);
      y += lineH;
    }
  };

  content.sections.forEach((s, idx) => {
    // keep the header + first lines together
    ensure(26);
    tocEntries.push({ title: s.title, page: pageNum() });

    // section header: number chip + title + accent underline
    doc.setFillColor(...ACCENT);
    doc.circle(M + 3, y - 1.4, 3.4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(String(idx + 1), M + 3, y - 0.1, { align: "center" });
    doc.setFontSize(14.5);
    doc.setTextColor(...INK);
    doc.text(s.title, M + 9.5, y);
    y += 2.6;
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.5);
    doc.line(M, y, M + CW, y);
    y += 5.5;

    paragraph(s.intro, 10, INK, 4.7);
    y += 1.5;

    // Illustration for this section — drawn from real engine output.
    const fig = FIGURES[idx];
    if (fig) {
      ensure(FIG_H[fig] + 2);
      const fh = drawFigure(doc, fig, M, y, CW);
      y += fh + 2;
    }

    if (s.steps?.length) {
      ensure(6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...ACCENT);
      doc.text(content.stepsLabel.toUpperCase(), M, y);
      y += 4.4;
      s.steps.forEach((st, i) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(...MUTED);
        ensure(4.5);
        doc.text(`${i + 1}.`, M + 1, y);
        paragraph(st, 9.5, INK, 4.3, 7);
        y += 0.6;
      });
      y += 1.4;
    }

    if (s.example) {
      // tinted example box
      doc.setFontSize(9.5);
      const lines: string[] = doc.splitTextToSize(s.example, CW - 12);
      const boxH = lines.length * 4.3 + 10;
      ensure(boxH + 2);
      doc.setFillColor(...BOX);
      doc.setDrawColor(...LINE);
      doc.roundedRect(M, y - 3.5, CW, boxH, 1.6, 1.6, "FD");
      doc.setFillColor(...ACCENT);
      doc.rect(M, y - 3.5, 1.4, boxH, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...ACCENT);
      doc.text(content.exampleLabel.toUpperCase(), M + 5, y + 0.6);
      let ly = y + 5.4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      for (const line of lines) {
        doc.text(line, M + 5, ly);
        ly += 4.3;
      }
      y += boxH + 2;
    }

    if (s.tips?.length) {
      ensure(6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...ACCENT);
      doc.text(content.tipsLabel.toUpperCase(), M, y);
      y += 4.4;
      for (const tip of s.tips) {
        ensure(4.5);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(...ACCENT);
        doc.text("•", M + 1.5, y);
        paragraph(tip, 9.5, MUTED, 4.3, 6);
        y += 0.6;
      }
    }
    y += 8;
  });

  // ---------- fill the TOC ----------
  doc.setPage(tocPage);
  let ty = M + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text(content.tocTitle, M, ty);
  ty += 3.4;
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.8);
  doc.line(M, ty, M + 26, ty);
  ty += 8;
  doc.setFontSize(10.5);
  content.sections.forEach((s, i) => {
    const entry = tocEntries[i];
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    const title = `${i + 1}.  ${s.title}`;
    doc.text(title, M, ty);
    // dotted leader + page number
    doc.setTextColor(...MUTED);
    const tw = doc.getTextWidth(title);
    const pn = String(entry?.page ?? "");
    const pnw = doc.getTextWidth(pn);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([0.6, 1.4], 0);
    doc.line(M + tw + 3, ty - 1, M + CW - pnw - 3, ty - 1);
    doc.setLineDashPattern([], 0);
    doc.text(pn, M + CW, ty, { align: "right" });
    ty += 7;
  });

  // ---------- footers (skip the cover) ----------
  const pages = doc.getNumberOfPages();
  for (let p = 2; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(M, H - 13, W - M, H - 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(content.footer, M, H - 8.5);
    doc.text(String(p), W - M, H - 8.5, { align: "right" });
  }

  doc.save(filename);
}
