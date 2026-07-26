import { useCallback, useEffect, useRef, useState } from "react";

// The optional extra filter and its parameter ranges/defaults. `a`/`b` are the
// per-filter sliders (label keys under i18n imglab.*).
type FxKind =
  | "none"
  | "bilateral"
  | "posterize"
  | "xdog"
  | "clahe"
  | "flatten"
  | "impasto";
const FX_CONFIG: Record<
  Exclude<FxKind, "none">,
  {
    a: { key: string; min: number; max: number; step: number; def: number };
    b?: { key: string; min: number; max: number; step: number; def: number };
  }
> = {
  bilateral: {
    a: { key: "imglab.fxStrength", min: 8, max: 60, step: 1, def: 35 },
    b: { key: "imglab.fxRadius", min: 2, max: 8, step: 1, def: 5 },
  },
  posterize: { a: { key: "imglab.fxLevels", min: 3, max: 8, step: 1, def: 5 } },
  xdog: {
    a: { key: "imglab.fxDetail", min: 0, max: 100, step: 1, def: 50 },
    b: { key: "imglab.fxInk", min: 0, max: 100, step: 1, def: 60 },
  },
  clahe: { a: { key: "imglab.fxClip", min: 1, max: 5, step: 0.5, def: 2.5 } },
  flatten: {
    a: { key: "imglab.fxStrength", min: 0, max: 100, step: 1, def: 60 },
  },
  impasto: {
    a: { key: "imglab.fxStrength", min: 0, max: 100, step: 1, def: 40 },
  },
};
import {
  Upload,
  Camera,
  Plus,
  Minus,
  RotateCcw,
  Wand2,
  Download,
  AlertTriangle,
  SlidersHorizontal,
  Sparkles,
  Cloud,
  PenTool,
  Brush,
  Loader2,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  DEFAULT_ADJUST,
  adjustActive,
  computeAdjusted,
  stencilImage,
  oilPaintImage,
  bilateralImage,
  posterizeLabImage,
  xdogImage,
  claheImage,
  flattenLightImage,
  impastoImage,
  upscaleImage,
  cloudEnhance,
  MAX_AI_OUTPUT,
  type Adjust,
  type AiModel,
} from "@/lib/imagefx";
import { anisoKuwaharaImage } from "@/lib/anisoKuwahara";
import { useGeminiKey, setGeminiKey } from "@/hooks/useGeminiKey";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CameraCapture } from "@/components/CameraCapture";

export function ImgLabView() {
  const { t } = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<ImageData | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [hasImage, setHasImage] = useState(false);
  const [showCam, setShowCam] = useState(false);
  const [adjust, setAdjust] = useState<Adjust>(DEFAULT_ADJUST);
  const [stencil, setStencil] = useState(false);
  const [stencilDetail, setStencilDetail] = useState(55);
  const [stencilWeight, setStencilWeight] = useState(1);
  const [oil, setOil] = useState(false);
  const [oilRadius, setOilRadius] = useState(4);
  // "classic" = CPU Kuwahara (square daubs); "aniso" = GPU anisotropic
  // Kuwahara (strokes follow the edges). Falls back to classic without WebGL2.
  const [oilMode, setOilMode] = useState<"classic" | "aniso">("classic");
  // Extra artistic/corrective filter (one at a time), chained around the oil
  // pass: corrections run before it, the impasto relief runs on top of it.
  const [fx, setFx] = useState<FxKind>("none");
  const [fxA, setFxA] = useState(0);
  const [fxB, setFxB] = useState(0);
  // Heavy filters (the iterated bilateral) don't recompute on every slider
  // tick: changes are debounced and a spinner confirms work is in flight.
  const [fxBusy, setFxBusy] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef({ down: false, startX: 0, startY: 0, panX: 0, panY: 0 });

  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiModelKey, setAiModelKey] = useState<AiModel>("slim-2x");

  // Cloud AI (Gemini) — bring-your-own key, shared via a store (Settings + here).
  const geminiKey = useGeminiKey();
  const [cloudPrompt, setCloudPrompt] = useState(() =>
    t("imglab.cloudPromptDefault")
  );

  const drawImageElement = useCallback((img: HTMLImageElement, maxW: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = Math.min(1, maxW / img.width);
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
    baseRef.current =
      ctx?.getImageData(0, 0, canvas.width, canvas.height) ?? null;
    imgRef.current = img;
    setHasImage(true);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setAdjust(DEFAULT_ADJUST);
    setStencil(false);
    setOil(false);
    setFx("none");
  }, []);

  const drawFile = useCallback(
    (file: Blob) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        drawImageElement(img, 1200);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    },
    [drawImageElement]
  );

  // Re-render the canvas from the untouched base whenever an adjustment changes.
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const base = baseRef.current;
    if (!canvas || !base) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    // Adjustments always run first; the painterly filter (if on) simplifies
    // that, and the stencil (if on) draws its lines from whatever came before —
    // so e.g. oil + stencil gives line art of the simplified shapes.
    const adjusted = computeAdjusted(base, adjust);
    let out = adjusted;
    const grid = () => ({ width: base.width, height: base.height, data: out });
    // Corrections / painterly extras run BEFORE the oil pass…
    // strength also drives the pass count — the watercolor look is iterative
    if (fx === "bilateral")
      out = bilateralImage(grid(), fxB, fxA, 1 + Math.floor(fxA / 30));
    else if (fx === "posterize") out = posterizeLabImage(grid(), fxA);
    else if (fx === "xdog") out = xdogImage(grid(), fxA, fxB);
    else if (fx === "clahe") out = claheImage(grid(), fxA);
    else if (fx === "flatten") out = flattenLightImage(grid(), fxA);
    if (oil) {
      out =
        (oilMode === "aniso" ? anisoKuwaharaImage(grid(), oilRadius + 2) : null) ??
        oilPaintImage(grid(), oilRadius);
    }
    // …except the impasto relief, which reads best ON TOP of the oil daubs.
    if (fx === "impasto") out = impastoImage(grid(), fxA);
    if (stencil) {
      const adjData = new ImageData(
        new Uint8ClampedArray(out),
        base.width,
        base.height
      );
      out = stencilImage(adjData, stencilDetail, stencilWeight);
    }
    const result = ctx.createImageData(base.width, base.height);
    result.data.set(out);
    ctx.putImageData(result, 0, 0);
  }, [adjust, oil, oilRadius, oilMode, fx, fxA, fxB, stencil, stencilDetail, stencilWeight]);

  const heavyFx = fx === "bilateral";
  useEffect(() => {
    if (!hasImage) return;
    if (!heavyFx) {
      setFxBusy(false); // don't leave a stale spinner when leaving the heavy fx
      const id = requestAnimationFrame(redraw);
      return () => cancelAnimationFrame(id);
    }
    // Heavy path: debounce slider spam, and double-rAF so the spinner PAINTS
    // before the synchronous filter blocks the main thread.
    setFxBusy(true);
    const t = setTimeout(() => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          redraw();
          setFxBusy(false);
        })
      );
    }, 250);
    return () => clearTimeout(t);
  }, [redraw, hasImage, heavyFx]);

  const runEnhance = async () => {
    const img = imgRef.current;
    if (!img || aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const src = await upscaleImage(img, aiModelKey);
      const up = new Image();
      up.onload = () => {
        drawImageElement(up, MAX_AI_OUTPUT);
        setAiBusy(false);
      };
      up.onerror = () => {
        setAiError(t("image.aiError"));
        setAiBusy(false);
      };
      up.src = src;
    } catch (e) {
      console.error("AI enhance failed:", e);
      setAiError(`${t("image.aiError")} [${(e as Error)?.message ?? e}]`);
      setAiBusy(false);
    }
  };

  const runCloud = async () => {
    const img = imgRef.current;
    if (!img || aiBusy) return;
    if (!geminiKey.trim()) {
      setAiError(t("imglab.cloudNoKey"));
      return;
    }
    setAiBusy(true);
    setAiError(null);
    try {
      const src = await cloudEnhance(img, geminiKey.trim(), cloudPrompt);
      const im = new Image();
      im.onload = () => {
        drawImageElement(im, MAX_AI_OUTPUT);
        setAiBusy(false);
      };
      im.onerror = () => {
        setAiError(t("imglab.cloudError"));
        setAiBusy(false);
      };
      im.src = src;
    } catch (e) {
      console.error("Cloud AI failed:", e);
      setAiError(`${t("imglab.cloudError")} [${(e as Error)?.message ?? e}]`);
      setAiBusy(false);
    }
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((b) => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pigment-image.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const zoomIn = () => setZoom((z) => Math.min(10, +(z + 0.5).toFixed(2)));
  const zoomOut = () =>
    setZoom((z) => {
      const nz = Math.max(1, +(z - 0.5).toFixed(2));
      if (nz === 1) setPan({ x: 0, y: 0 });
      return nz;
    });

  const onPanMove = (e: React.MouseEvent) => {
    const d = dragRef.current;
    if (!d.down) return;
    const cv = canvasRef.current;
    const maxX = cv ? (cv.clientWidth * (zoom - 1)) / 2 : 0;
    const maxY = cv ? (cv.clientHeight * (zoom - 1)) / 2 : 0;
    setPan({
      x: Math.max(-maxX, Math.min(maxX, d.panX + (e.clientX - d.startX))),
      y: Math.max(-maxY, Math.min(maxY, d.panY + (e.clientY - d.startY))),
    });
  };

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) drawFile(f);
        e.target.value = "";
      }}
    />
  );

  return (
    <div className="space-y-4">
      {showCam && (
        <CameraCapture
          onCapture={(b) => drawFile(b)}
          onClose={() => setShowCam(false)}
        />
      )}
      {fileInput}

      {!hasImage && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("imglab.intro")}</p>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-64 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
          >
            <Upload className="h-8 w-8" />
            <span className="text-sm font-medium">{t("imglab.upload")}</span>
            <span className="text-xs">{t("imglab.uploadHint")}</span>
          </button>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowCam(true)}
          >
            <Camera className="h-4 w-4" /> {t("camera.use")}
          </Button>
        </div>
      )}

      {/* The canvas must stay mounted so the first upload has a target. */}
      <div className={hasImage ? "block" : "hidden"}>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        {/* Viewer */}
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-lg border border-border bg-black/20">
            <canvas
              ref={canvasRef}
              onMouseDown={(e) => {
                dragRef.current = {
                  down: true,
                  startX: e.clientX,
                  startY: e.clientY,
                  panX: pan.x,
                  panY: pan.y,
                };
              }}
              onMouseUp={() => (dragRef.current.down = false)}
              onMouseLeave={() => (dragRef.current.down = false)}
              onMouseMove={onPanMove}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
                cursor: zoom > 1 ? "move" : "default",
              }}
              className="mx-auto block max-h-[60vh] w-full object-contain"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" /> {t("image.replace")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCam(true)}>
              <Camera className="h-4 w-4" /> {t("camera.use")}
            </Button>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={zoomOut}
                disabled={zoom <= 1}
                title="Zoom out"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center text-xs tabular-nums text-muted-foreground">
                {zoom.toFixed(1)}x
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={zoomIn}
                disabled={zoom >= 10}
                title="Zoom in"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="accent"
              size="sm"
              className="ml-auto"
              onClick={downloadImage}
            >
              <Download className="h-4 w-4" /> {t("image.download")}
            </Button>
          </div>
          {aiError && <p className="text-xs text-rose-400">{aiError}</p>}
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* Adjustments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-accent" />
                {t("imglab.adjustTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("imglab.adjustDesc")}
              </p>
              {(
                [
                  ["sharpen", 0, 100],
                  ["brightness", -100, 100],
                  ["contrast", -100, 100],
                  ["saturation", -100, 100],
                  ["temperature", -100, 100],
                ] as const
              ).map(([key, min, max]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground">
                    {t(`image.${key}`)}
                  </span>
                  <Slider
                    value={adjust[key]}
                    min={min}
                    max={max}
                    step={1}
                    onChange={(v) => setAdjust((a) => ({ ...a, [key]: v }))}
                  />
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAdjust(DEFAULT_ADJUST)}
                disabled={!adjustActive(adjust)}
              >
                <RotateCcw className="h-3.5 w-3.5" /> {t("image.reset")}
              </Button>
            </CardContent>
          </Card>

          {/* Oil-painting / painterly simplification (Kuwahara) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brush className="h-4 w-4 text-accent" />
                {t("imglab.oilTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("imglab.oilDesc")}
              </p>
              <button
                onClick={() => setOil((s) => !s)}
                className={
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                  (oil
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary/60 text-muted-foreground hover:text-foreground")
                }
              >
                {t("imglab.oilToggle")}
              </button>
              {oil && (
                <>
                  <div className="flex items-center gap-1 pt-1">
                    {(["classic", "aniso"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setOilMode(m)}
                        className={
                          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors " +
                          (oilMode === m
                            ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground")
                        }
                      >
                        {t(`imglab.oilMode_${m}`)}
                      </button>
                    ))}
                  </div>
                  {oilMode === "aniso" && (
                    <p className="text-[11px] text-muted-foreground">
                      {t("imglab.oilAnisoHint")}
                    </p>
                  )}
                  <div className="flex items-center gap-3 pt-1">
                    <span className="w-16 shrink-0 text-xs text-muted-foreground">
                      {t("imglab.oilBrush")}
                    </span>
                    <Slider
                      value={oilRadius}
                      min={2}
                      max={10}
                      step={1}
                      onChange={setOilRadius}
                    />
                    <span className="w-6 text-xs tabular-nums text-muted-foreground">
                      {oilRadius}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {t("imglab.oilHint")}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Extra artistic / corrective filters (one at a time) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-accent" />
                {t("imglab.fxTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("imglab.fxDesc")}
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={fx}
                  onChange={(e) => {
                    const next = e.target.value as FxKind;
                    setFx(next);
                    if (next !== "none") {
                      const cfg = FX_CONFIG[next];
                      setFxA(cfg.a.def);
                      setFxB(cfg.b?.def ?? 0);
                    }
                  }}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                <option value="none">{t("imglab.fxNone")}</option>
                <option value="bilateral">{t("imglab.fxBilateral")}</option>
                <option value="posterize">{t("imglab.fxPosterize")}</option>
                <option value="xdog">{t("imglab.fxXdog")}</option>
                <option value="clahe">{t("imglab.fxClahe")}</option>
                <option value="flatten">{t("imglab.fxFlatten")}</option>
                <option value="impasto">{t("imglab.fxImpasto")}</option>
                </select>
                {fxBusy && (
                  <span className="flex items-center gap-1.5 text-xs text-accent">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("imglab.fxApplying")}
                  </span>
                )}
              </div>
              {fx !== "none" && (
                <>
                  <div className="flex items-center gap-3 pt-1">
                    <span className="w-20 shrink-0 text-xs text-muted-foreground">
                      {t(FX_CONFIG[fx].a.key)}
                    </span>
                    <Slider
                      value={fxA}
                      min={FX_CONFIG[fx].a.min}
                      max={FX_CONFIG[fx].a.max}
                      step={FX_CONFIG[fx].a.step}
                      onChange={setFxA}
                    />
                    <span className="w-8 text-xs tabular-nums text-muted-foreground">
                      {fxA}
                    </span>
                  </div>
                  {FX_CONFIG[fx].b && (
                    <div className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-xs text-muted-foreground">
                        {t(FX_CONFIG[fx].b!.key)}
                      </span>
                      <Slider
                        value={fxB}
                        min={FX_CONFIG[fx].b!.min}
                        max={FX_CONFIG[fx].b!.max}
                        step={FX_CONFIG[fx].b!.step}
                        onChange={setFxB}
                      />
                      <span className="w-8 text-xs tabular-nums text-muted-foreground">
                        {fxB}
                      </span>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {t(`imglab.fxHint_${fx}`)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Stencil / line art */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PenTool className="h-4 w-4 text-accent" />
                {t("imglab.stencilTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("imglab.stencilDesc")}
              </p>
              <button
                onClick={() => setStencil((s) => !s)}
                className={
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                  (stencil
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary/60 text-muted-foreground hover:text-foreground")
                }
              >
                {t("imglab.stencilToggle")}
              </button>
              {stencil && (
                <>
                  <div className="flex items-center gap-3 pt-1">
                    <span className="w-16 shrink-0 text-xs text-muted-foreground">
                      {t("imglab.stencilDetail")}
                    </span>
                    <Slider
                      value={stencilDetail}
                      min={0}
                      max={100}
                      step={1}
                      onChange={setStencilDetail}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs text-muted-foreground">
                      {t("imglab.stencilThickness")}
                    </span>
                    <Input
                      type="number"
                      min={0.3}
                      max={5}
                      step={0.1}
                      value={stencilWeight}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setStencilWeight(
                          Number.isFinite(v) ? Math.min(5, Math.max(0.3, v)) : 1
                        );
                      }}
                      className="h-8 w-20"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {t("imglab.stencilThicknessHint")}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* AI warning */}
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-2 font-medium text-amber-400">
              <AlertTriangle className="h-4 w-4" /> {t("imglab.aiExperimental")}
            </p>
            <p className="mt-1">{t("imglab.aiWarning")}</p>
          </div>

          {/* AI enhance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                {t("imglab.enhanceTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("imglab.enhanceDesc")}
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={aiModelKey}
                  onChange={(e) => setAiModelKey(e.target.value as AiModel)}
                  disabled={aiBusy}
                  className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm disabled:opacity-50"
                >
                  <option value="slim-2x">{t("image.aiFast")} · 2x</option>
                  <option value="slim-4x">{t("image.aiFast")} · 4x</option>
                  <option value="medium-4x">{t("image.aiBetter")} · 4x</option>
                  <option value="thick-4x">{t("image.aiBest")} · 4x</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runEnhance}
                  disabled={aiBusy}
                >
                  <Wand2 className="h-4 w-4" />{" "}
                  {aiBusy ? t("image.aiBusy") : t("imglab.run")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Cloud AI — Gemini (bring your own key) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-accent" />
                {t("imglab.cloudTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("imglab.cloudDesc")}
              </p>
              <div className="space-y-1">
                <label className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  {t("imglab.cloudKey")}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-normal text-accent hover:underline"
                  >
                    {t("imglab.cloudGetKey")}
                  </a>
                </label>
                <Input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder={t("imglab.cloudKeyPh")}
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("imglab.cloudKeyNote")}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {t("imglab.cloudInstruction")}
                </label>
                <textarea
                  value={cloudPrompt}
                  onChange={(e) => setCloudPrompt(e.target.value)}
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={runCloud}
                disabled={aiBusy}
              >
                <Cloud className="h-4 w-4" />{" "}
                {aiBusy ? t("image.processing") : t("imglab.cloudRun")}
              </Button>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </div>
  );
}
