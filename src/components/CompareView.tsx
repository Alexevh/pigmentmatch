import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Layers, BarChart3, Grid2x2, Pipette, Award } from "lucide-react";
import { rgbToHex, type RGB } from "@/lib/color";
import type { Pigment } from "@/lib/pigments";
import { extractPalette } from "@/lib/extract";
import { coach } from "@/lib/coach";
import { useT, type Lang } from "@/lib/i18n";
import {
  warpImage,
  toLabField,
  normalizeLighting,
  renderGrayscale,
  renderNotan,
  renderDiff,
  valueHistogram,
  scoreCompare,
  sampleRegion,
  dataToPixels,
  type Pt,
  type LabField,
  type DiffMetric,
} from "@/lib/compare";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Swatch } from "./Swatch";

const DEFAULT_CORNERS: Pt[] = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 },
  { x: 0.1, y: 0.9 },
];

// Paint an ImageData onto a canvas, scaled to fit its container width.
function CanvasView({
  data,
  className,
  onPick,
  blur = 0,
}: {
  data: ImageData | null;
  className?: string;
  onPick?: (nx: number, ny: number) => void;
  blur?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !data) return;
    c.width = data.width;
    c.height = data.height;
    c.getContext("2d")!.putImageData(data, 0, 0);
  }, [data]);
  return (
    <canvas
      ref={ref}
      onClick={
        onPick
          ? (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              onPick((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
            }
          : undefined
      }
      className={className}
      style={{
        width: "100%",
        height: "auto",
        display: "block",
        filter: blur ? `blur(${blur}px)` : undefined,
        cursor: onPick ? "crosshair" : undefined,
      }}
    />
  );
}

// Image with four draggable corner handles for de-keystoning.
function CornerAligner({
  img,
  corners,
  onChange,
}: {
  img: HTMLImageElement;
  corners: Pt[];
  onChange: (c: Pt[]) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const move = (clientX: number, clientY: number) => {
    if (drag == null || !wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    const nx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const ny = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    const next = corners.slice();
    next[drag] = { x: nx, y: ny };
    onChange(next);
  };
  return (
    <div
      ref={wrap}
      className="relative select-none overflow-hidden rounded-lg border border-border"
      onMouseMove={(e) => move(e.clientX, e.clientY)}
      onMouseUp={() => setDrag(null)}
      onMouseLeave={() => setDrag(null)}
    >
      <img src={img.src} className="block w-full" draggable={false} alt="" />
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
      >
        <polygon
          points={corners.map((c) => `${c.x},${c.y}`).join(" ")}
          fill="hsl(var(--accent) / 0.12)"
          stroke="hsl(var(--accent))"
          strokeWidth={0.004}
        />
      </svg>
      {corners.map((c, i) => (
        <button
          key={i}
          onMouseDown={() => setDrag(i)}
          className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow-md"
          style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
          aria-label={`corner ${i + 1}`}
        />
      ))}
    </div>
  );
}

function Dropzone({
  label,
  onFile,
}: {
  label: string;
  onFile: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <button
        onClick={() => ref.current?.click()}
        className="flex h-48 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
      >
        <Upload className="h-7 w-7" />
        <span className="text-sm font-medium">{label}</span>
      </button>
    </div>
  );
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = url;
  });
}

function outputSize(corners: Pt[], natW: number, natH: number) {
  const px = corners.map((c) => ({ x: c.x * natW, y: c.y * natH }));
  const d = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  const w = (d(px[0], px[1]) + d(px[3], px[2])) / 2;
  const h = (d(px[0], px[3]) + d(px[1], px[2])) / 2;
  const aspect = Math.max(0.2, Math.min(5, w / (h || 1)));
  const LONG = 560;
  return aspect >= 1
    ? { w: LONG, h: Math.max(80, Math.round(LONG / aspect)) }
    : { w: Math.max(80, Math.round(LONG * aspect)), h: LONG };
}

interface Analyzed {
  refData: ImageData;
  wipData: ImageData;
  refLab: LabField;
  wipLab: LabField;
}

type View = "overlay" | "value" | "color" | "region" | "palette" | "score";

export function CompareView({ pigments }: { pigments: Pigment[] }) {
  const { lang, t } = useT();
  const [refImg, setRefImg] = useState<HTMLImageElement | null>(null);
  const [wipImg, setWipImg] = useState<HTMLImageElement | null>(null);
  const [refCorners, setRefCorners] = useState<Pt[]>(DEFAULT_CORNERS);
  const [wipCorners, setWipCorners] = useState<Pt[]>(DEFAULT_CORNERS);
  const [analyzed, setAnalyzed] = useState<Analyzed | null>(null);
  const [view, setView] = useState<View>("overlay");
  const [normalize, setNormalize] = useState(false);

  const analyze = () => {
    if (!refImg || !wipImg) return;
    const size = outputSize(refCorners, refImg.naturalWidth, refImg.naturalHeight);
    const refData = warpImage(refImg, refCorners, size.w, size.h);
    const wipData = warpImage(wipImg, wipCorners, size.w, size.h);
    setAnalyzed({
      refData,
      wipData,
      refLab: toLabField(refData),
      wipLab: toLabField(wipData),
    });
  };

  // wip Lab used for analysis (optionally lighting-normalized to the reference)
  const wipLabEff = useMemo(() => {
    if (!analyzed) return null;
    return normalize
      ? normalizeLighting(analyzed.refLab, analyzed.wipLab, {
          value: true,
          color: true,
        })
      : analyzed.wipLab;
  }, [analyzed, normalize]);

  return (
    <div className="space-y-5">
      {/* Step 1: upload */}
      {(!refImg || !wipImg) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {refImg ? (
            <img src={refImg.src} className="h-48 w-full rounded-lg border border-border object-contain" alt="" />
          ) : (
            <Dropzone label={t("compare.uploadRef")} onFile={(f) => loadImage(f).then(setRefImg)} />
          )}
          {wipImg ? (
            <img src={wipImg.src} className="h-48 w-full rounded-lg border border-border object-contain" alt="" />
          ) : (
            <Dropzone label={t("compare.uploadWip")} onFile={(f) => loadImage(f).then(setWipImg)} />
          )}
        </div>
      )}

      {/* Step 2: align */}
      {refImg && wipImg && (
        <Card>
          <CardHeader>
            <CardTitle>{t("compare.alignTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("compare.reference")}</p>
                <CornerAligner img={refImg} corners={refCorners} onChange={(c) => { setRefCorners(c); setAnalyzed(null); }} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("compare.yourPainting")}</p>
                <CornerAligner img={wipImg} corners={wipCorners} onChange={(c) => { setWipCorners(c); setAnalyzed(null); }} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="accent" onClick={analyze}>{t("compare.analyze")}</Button>
              <Button variant="ghost" size="sm" onClick={() => { setRefImg(null); setWipImg(null); setAnalyzed(null); }} className="text-muted-foreground">{t("compare.startOver")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: results */}
      {analyzed && wipLabEff && (
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="normal-case tracking-normal text-foreground">{t("compare.title")}</CardTitle>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={normalize} onChange={(e) => setNormalize(e.target.checked)} className="h-3.5 w-3.5 accent-accent" />
              {t("compare.normalize")}
            </label>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-1">
              {([
                ["overlay", t("compare.overlay"), Layers],
                ["value", t("compare.values"), BarChart3],
                ["color", t("compare.color"), Grid2x2],
                ["region", t("compare.regionCoach"), Pipette],
                ["palette", t("compare.palettes"), Grid2x2],
                ["score", t("compare.scorecard"), Award],
              ] as const).map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    view === id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>

            {view === "overlay" && <OverlayView a={analyzed} />}
            {view === "value" && <ValueView refLab={analyzed.refLab} wipLab={wipLabEff} lang={lang} />}
            {view === "color" && <ColorView refLab={analyzed.refLab} wipLab={wipLabEff} lang={lang} />}
            {view === "region" && <RegionView a={analyzed} pigments={pigments} />}
            {view === "palette" && <PaletteCompare a={analyzed} />}
            {view === "score" && <ScoreView refLab={analyzed.refLab} wipLab={wipLabEff} lang={lang} />}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">{t("compare.tip")}</p>
    </div>
  );
}

// --- Overlay: swipe / onion-skin / squint ---
function OverlayView({ a }: { a: Analyzed }) {
  const { t } = useT();
  const [mode, setMode] = useState<"swipe" | "onion">("swipe");
  const [pos, setPos] = useState(50);
  const [blur, setBlur] = useState(0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1 rounded-md bg-secondary/60 p-0.5 text-xs">
          {(["swipe", "onion"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn("rounded px-2 py-0.5 font-medium", mode === m ? "bg-background shadow-sm" : "text-muted-foreground")}>{t(`compare.${m}`)}</button>
          ))}
        </div>
        <label className="flex flex-1 items-center gap-2 text-xs text-muted-foreground">
          {mode === "swipe" ? t("compare.swipe") : t("compare.paintingOpacity")}
          <Slider value={pos} min={0} max={100} step={1} onChange={setPos} />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {t("compare.squint")}
          <Slider value={blur} min={0} max={12} step={1} onChange={setBlur} className="w-28" />
        </label>
      </div>
      <div className="relative overflow-hidden rounded-lg border border-border" style={{ filter: blur ? `blur(${blur}px)` : undefined }}>
        <CanvasView data={a.refData} />
        <div
          className="absolute inset-0"
          style={mode === "swipe" ? { clipPath: `inset(0 0 0 ${pos}%)` } : { opacity: pos / 100 }}
        >
          <CanvasView data={a.wipData} />
        </div>
        {mode === "swipe" && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-white/80" style={{ left: `${pos}%` }} />
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("compare.overlayHint")}</p>
    </div>
  );
}

// --- Values ---
function ValueView({ refLab, wipLab, lang }: { refLab: LabField; wipLab: LabField; lang: Lang }) {
  const { t } = useT();
  const [steps, setSteps] = useState(4);
  const grayRef = useMemo(() => renderGrayscale(refLab), [refLab]);
  const grayWip = useMemo(() => renderGrayscale(wipLab), [wipLab]);
  const notanRef = useMemo(() => renderNotan(refLab, steps), [refLab, steps]);
  const notanWip = useMemo(() => renderNotan(wipLab, steps), [wipLab, steps]);
  const diff = useMemo(() => renderDiff(refLab, wipLab, "value", lang), [refLab, wipLab, lang]);
  const hRef = useMemo(() => valueHistogram(refLab), [refLab]);
  const hWip = useMemo(() => valueHistogram(wipLab), [wipLab]);
  return (
    <div className="space-y-4">
      <Pair title={t("compare.grayscale")} left={grayRef} right={grayWip} />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {t("compare.notanSteps")}
        <Slider value={steps} min={2} max={6} step={1} onChange={setSteps} className="w-40" />
        <span className="tabular-nums">{steps}</span>
      </div>
      <Pair title={t("compare.notan")} left={notanRef} right={notanWip} />
      <DiffPanel title={t("compare.valueDiff")} diff={diff} />
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("compare.valueDist")}</p>
        <Histogram ref={hRef} wip={hWip} />
        <p className="mt-1 text-xs text-muted-foreground">{t("compare.histHint")}</p>
      </div>
    </div>
  );
}

function Histogram({ ref: r, wip }: { ref: number[]; wip: number[] }) {
  return (
    <div className="flex h-20 items-end gap-px">
      {r.map((_, i) => (
        <div key={i} className="relative flex-1">
          <div className="absolute bottom-0 w-full rounded-t bg-accent/50" style={{ height: `${r[i] * 100}%` }} />
          <div className="absolute bottom-0 w-full rounded-t bg-foreground/70" style={{ height: `${wip[i] * 100}%`, width: "45%", left: "27%" }} />
        </div>
      ))}
    </div>
  );
}

// --- Color heatmaps ---
function ColorView({ refLab, wipLab, lang }: { refLab: LabField; wipLab: LabField; lang: Lang }) {
  const { t } = useT();
  const [metric, setMetric] = useState<DiffMetric>("deltaE");
  const diff = useMemo(() => renderDiff(refLab, wipLab, metric, lang), [refLab, wipLab, metric, lang]);
  const opts: [DiffMetric, string][] = [
    ["deltaE", t("compare.overallDE")],
    ["temp", t("compare.temperature")],
    ["sat", t("compare.saturation")],
    ["hue", t("compare.hue")],
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 text-xs">
        {opts.map(([id, label]) => (
          <button key={id} onClick={() => setMetric(id)} className={cn("rounded-md px-2.5 py-1 font-medium", metric === id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}>{label}</button>
        ))}
      </div>
      <DiffPanel title={`${opts.find((o) => o[0] === metric)![1]}${t("compare.diffSuffix")}`} diff={diff} />
    </div>
  );
}

function DiffPanel({ title, diff }: { title: string; diff: ReturnType<typeof renderDiff> }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <CanvasView data={diff.image} className="rounded-lg border border-border" />
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: diff.legend.signedScale ? "rgb(60,120,245)" : "rgb(240,240,240)" }} /> {diff.legend.low}
        </span>
        <span>{diff.legend.unit}</span>
        <span className="flex items-center gap-1">
          {diff.legend.high} <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "rgb(230,40,40)" }} />
        </span>
      </div>
    </div>
  );
}

function Pair({ title, left, right }: { title: string; left: ImageData; right: ImageData }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        <CanvasView data={left} className="rounded-lg border border-border" />
        <CanvasView data={right} className="rounded-lg border border-border" />
      </div>
    </div>
  );
}

// --- Region coach ---
function RegionView({ a, pigments }: { a: Analyzed; pigments: Pigment[] }) {
  const { lang, t } = useT();
  const [pick, setPick] = useState<{ nx: number; ny: number } | null>(null);
  const result = useMemo(() => {
    if (!pick) return null;
    const target = sampleRegion(a.refData, pick.nx, pick.ny);
    const current = sampleRegion(a.wipData, pick.nx, pick.ny);
    return { target, current, advice: coach(target, current, pigments, lang) };
  }, [pick, a, pigments, lang]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="relative">
        <CanvasView data={a.refData} className="rounded-lg border border-border" onPick={(nx, ny) => setPick({ nx, ny })} />
        {pick && (
          <span className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${pick.nx * 100}%`, top: `${pick.ny * 100}%` }} />
        )}
        <p className="mt-1 text-xs text-muted-foreground">{t("compare.pickHint")}</p>
      </div>
      <div>
        {!result ? (
          <p className="text-sm text-muted-foreground">{t("compare.pickPrompt")}</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2"><span className="h-8 w-8 rounded border border-border" style={{ background: rgbToHex(result.target) }} /> {t("compare.refLabel")}</div>
              <div className="flex items-center gap-2"><span className="h-8 w-8 rounded border border-border" style={{ background: rgbToHex(result.current) }} /> {t("compare.yoursLabel")}</div>
              <span className="ml-auto font-bold text-foreground">{result.advice.match}%</span>
            </div>
            <p className="text-sm font-medium">{result.advice.headline}</p>
            <ul className="space-y-1.5 text-sm text-foreground/90">
              {result.advice.tips.map((t, i) => (
                <li key={i} className="flex items-start gap-2">
                  {t.swatchHex && <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-border/50" style={{ background: t.swatchHex }} />}
                  {t.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Palette compare ---
function PaletteCompare({ a }: { a: Analyzed }) {
  const { t } = useT();
  const refPal = useMemo(() => extractPalette(dataToPixels(a.refData), 8), [a]);
  const wipPal = useMemo(() => extractPalette(dataToPixels(a.wipData), 8), [a]);
  const row = (title: string, pal: RGB[]) => (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid grid-cols-8 gap-1">
        {pal.map((c, i) => <Swatch key={i} rgb={c} className="h-12" />)}
      </div>
    </div>
  );
  return (
    <div className="space-y-3">
      {row(t("compare.refPalette"), refPal)}
      {row(t("compare.yourPalette"), wipPal)}
      <p className="text-xs text-muted-foreground">{t("compare.paletteHint")}</p>
    </div>
  );
}

// --- Scorecard ---
function ScoreView({ refLab, wipLab, lang }: { refLab: LabField; wipLab: LabField; lang: Lang }) {
  const { t } = useT();
  const s = useMemo(() => scoreCompare(refLab, wipLab, lang), [refLab, wipLab, lang]);
  const color = (v: number) => (v >= 85 ? "text-emerald-400" : v >= 70 ? "text-amber-400" : "text-rose-400");
  const bias = (v: number, neg: string, pos: string) =>
    Math.abs(v) < 1 ? t("compare.neutral") : `${v > 0 ? pos : neg} (${v > 0 ? "+" : ""}${v.toFixed(1)})`;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-secondary/20 p-4 text-center">
          <div className={cn("text-3xl font-bold", color(s.valueScore))}>{s.valueScore}%</div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("compare.valueAccuracy")}</div>
        </div>
        <div className="rounded-lg border border-border bg-secondary/20 p-4 text-center">
          <div className={cn("text-3xl font-bold", color(s.colorScore))}>{s.colorScore}%</div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("compare.colorAccuracy")}</div>
        </div>
      </div>
      <div className="divide-y divide-border/50 text-sm">
        <Row label={t("compare.valueBias")} value={bias(s.valueBias, t("compare.darker"), t("compare.lighter"))} />
        <Row label={t("compare.tempBias")} value={bias(s.tempBias, t("compare.cooler"), t("compare.warmer"))} />
        <Row label={t("compare.satBias")} value={bias(s.satBias, t("compare.duller"), t("compare.moreSat"))} />
        <Row label={t("compare.meanError")} value={`ΔE ${s.meanDE.toFixed(1)}`} />
      </div>
      <p className="rounded-lg border border-border bg-secondary/20 p-3 text-sm italic text-foreground/90">"{s.sentence}"</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
