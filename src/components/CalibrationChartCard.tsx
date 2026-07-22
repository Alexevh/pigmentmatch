import { useEffect, useMemo, useRef, useState } from "react";
import { Grid3x3, Download, Upload, ScanLine, Plus } from "lucide-react";
import { rgbToHex, type RGB } from "@/lib/color";
import type { Pigment } from "@/lib/pigments";
import {
  buildChartCells,
  cellPaintRect,
  chartAspect,
  observationsFromChart,
  classifyChartObservations,
  type ClassifiedObs,
} from "@/lib/chart";
import { exportCalibrationChartPdf } from "@/lib/chartPdf";
import { warpImage, type Pt } from "@/lib/compare";
import type { CalibrationApi } from "@/hooks/useCalibration";
import { useT } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CornerAligner } from "./CompareView";

const ALIGN_DEFAULT: Pt[] = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 },
  { x: 0.1, y: 0.9 },
];

// Calibration chart: print a grid, paint it with the real tubes, photograph
// it, align the bold border's 4 corners, and read EVERY patch in one pass —
// observations for the whole palette (masstones + 1:3 tints), white-balanced
// against the blank paper patch. The heavy lifting reuses Compare's
// homography warp and chart.ts's shared geometry.
export function CalibrationChartCard({
  pigments,
  cal,
  paletteName,
}: {
  pigments: Pigment[];
  cal: CalibrationApi;
  paletteName: string;
}) {
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null); // current photo's object URL
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [corners, setCorners] = useState<Pt[]>(ALIGN_DEFAULT);
  const [sampled, setSampled] = useState<(RGB | null)[] | null>(null);
  const [added, setAdded] = useState(false);

  const { cells, white } = useMemo(
    () => buildChartCells(pigments),
    [pigments]
  );

  // Release the photo's object URL when the card unmounts.
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  const download = () =>
    exportCalibrationChartPdf(pigments, paletteName, {
      title: t("chart.pdfTitle"),
      intro: t("chart.pdfIntro"),
      paper: t("chart.pdfPaper"),
    });

  const onFile = (f: Blob) => {
    // Keep the object URL alive while the photo is shown (CornerAligner renders
    // <img src>); revoking it immediately left a blank aligner. Release the
    // PREVIOUS photo's URL when a new one loads so nothing leaks.
    const url = URL.createObjectURL(f);
    const image = new Image();
    image.onload = () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setImg(image);
      setCorners(ALIGN_DEFAULT);
      setSampled(null);
      setAdded(false);
    };
    image.src = url;
  };

  const readChart = () => {
    if (!img) return;
    const W = 900;
    const H = Math.round(W * chartAspect(cells.length));
    const data = warpImage(img, corners, W, H);
    const out: (RGB | null)[] = cells.map((_, i) => {
      const pr = cellPaintRect(i, cells.length);
      // sample the central 50% of the paint area (edges are sloppy paint)
      const x0 = Math.round((pr.x + pr.w * 0.25) * W);
      const y0 = Math.round((pr.y + pr.h * 0.25) * H);
      const x1 = Math.round((pr.x + pr.w * 0.75) * W);
      const y1 = Math.round((pr.y + pr.h * 0.75) * H);
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const k = (y * W + x) * 4;
          r += data.data[k];
          g += data.data[k + 1];
          b += data.data[k + 2];
          n++;
        }
      if (!n) return null;
      return {
        r: Math.round(r / n),
        g: Math.round(g / n),
        b: Math.round(b / n),
      };
    });
    setSampled(out);
    setAdded(false);
  };

  const chartObs = useMemo(
    () => (sampled ? observationsFromChart(cells, sampled, white) : []),
    [cells, sampled, white]
  );
  // Classify each read patch against what's already recorded (new / exact
  // duplicate / conflicting), for the preview counts.
  const classified = useMemo(
    () => classifyChartObservations(chartObs, cal.observations),
    [chartObs, cal.observations]
  );
  const counts = useMemo(() => {
    const c = { new: 0, exact: 0, conflict: 0 };
    for (const o of classified) c[o.kind]++;
    return c;
  }, [classified]);

  // Conflicts awaiting a keep/replace decision, and a summary of what was added.
  const [conflicts, setConflicts] = useState<ClassifiedObs[]>([]);
  const [summary, setSummary] = useState<{ added: number; skipped: number } | null>(
    null
  );

  const addAll = () => {
    // Recompute against the current observations at click time.
    const fresh = classifyChartObservations(chartObs, cal.observations);
    const news = fresh.filter((o) => o.kind === "new");
    const skipped = fresh.filter((o) => o.kind === "exact").length;
    const conf = fresh.filter((o) => o.kind === "conflict");
    // Add all the new ones in a single batch (a per-item loop would lose all
    // but the last to stale state).
    cal.addObservations(news.map((o) => ({ items: o.items, observed: o.observed })));
    setSummary({ added: news.length, skipped });
    setConflicts(conf);
    if (conf.length === 0) setAdded(true);
  };

  // Resolve one conflict: keep the existing observation, or replace it with the
  // chart's reading.
  const resolveConflict = (c: ClassifiedObs, choice: "keep" | "replace") => {
    if (choice === "replace" && c.existing) {
      cal.removeObservation(c.existing.id);
      cal.addObservation(c.items, c.observed);
    }
    setConflicts((prev) => {
      const next = prev.filter((x) => x !== c);
      if (next.length === 0) setAdded(true);
      return next;
    });
  };

  const label = (o: { items: { pigmentId: string; weight: number }[] }) =>
    o.items
      .map((it) => {
        const p = pigments.find((pg) => pg.id === it.pigmentId);
        return `${it.weight} ${p?.name ?? "?"}`;
      })
      .join(" + ");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Grid3x3 className="h-4 w-4 text-accent" /> {t("chart.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t("chart.intro")}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={download}>
            <Download className="h-4 w-4" /> {t("chart.download")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />{" "}
            {img ? t("chart.replacePhoto") : t("chart.uploadPhoto")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </div>

        {img && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {t("chart.alignHint")}
            </p>
            <CornerAligner img={img} corners={corners} onChange={setCorners} />
            <Button size="sm" onClick={readChart}>
              <ScanLine className="h-4 w-4" /> {t("chart.read")}
            </Button>
          </div>
        )}

        {sampled && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("chart.preview", { n: chartObs.length })}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cells.map((cell, i) =>
                cell.kind === "paper" || !sampled[i] ? null : (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/30 px-2 py-0.5 text-[11px]"
                    title={cell.label}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-border/60"
                      style={{ backgroundColor: rgbToHex(sampled[i]!) }}
                    />
                    {cell.label}
                  </span>
                )
              )}
            </div>
            {(counts.exact > 0 || counts.conflict > 0) && (
              <p className="text-[11px] text-muted-foreground">
                {t("chart.classify", {
                  add: counts.new,
                  exact: counts.exact,
                  conflict: counts.conflict,
                })}
              </p>
            )}
            <Button
              size="sm"
              onClick={addAll}
              disabled={added || chartObs.length === 0}
            >
              <Plus className="h-4 w-4" />{" "}
              {added
                ? t("chart.added")
                : t("chart.addObs", { n: chartObs.length })}
            </Button>

            {/* Per-conflict keep/replace decisions (same mix, different color). */}
            {conflicts.length > 0 && (
              <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5">
                <p className="text-xs text-muted-foreground">
                  {t("chart.conflictIntro", { n: conflicts.length })}
                </p>
                {conflicts.map((c, i) => (
                  <div
                    key={i}
                    className="space-y-1.5 rounded-md border border-border/60 bg-background/40 p-2"
                  >
                    <p className="text-xs font-medium">{label(c)}</p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-4 w-4 rounded border border-border/60"
                          style={{
                            backgroundColor: c.existing
                              ? rgbToHex(c.existing.observed)
                              : undefined,
                          }}
                        />
                        {t("chart.conflictExisting")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-4 w-4 rounded border border-border/60"
                          style={{ backgroundColor: rgbToHex(c.observed) }}
                        />
                        {t("chart.conflictChart")}
                      </span>
                      <span>ΔE {(c.deltaE ?? 0).toFixed(1)}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => resolveConflict(c, "keep")}
                      >
                        {t("chart.conflictKeep")}
                      </Button>
                      <Button
                        variant="accent"
                        size="sm"
                        className="h-7"
                        onClick={() => resolveConflict(c, "replace")}
                      >
                        {t("chart.conflictReplace")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {added && summary && (
              <p className="text-xs text-emerald-400">
                {t("chart.addedSummary", {
                  added: summary.added,
                  skipped: summary.skipped,
                })}{" "}
                {t("chart.next")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
