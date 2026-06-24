import { useCallback, useEffect, useRef, useState } from "react";
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
  Stars,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  DEFAULT_ADJUST,
  adjustActive,
  computeAdjusted,
  upscaleImage,
  restoreImage,
  MAX_AI_OUTPUT,
  type Adjust,
  type AiModel,
  type Restore,
} from "@/lib/imagefx";
import { Button } from "@/components/ui/button";
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

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef({ down: false, startX: 0, startY: 0, panX: 0, panY: 0 });

  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiModelKey, setAiModelKey] = useState<AiModel>("slim-2x");
  const [restoreKey, setRestoreKey] = useState<Restore>("deblur");

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
    const out = computeAdjusted(base, adjust);
    const result = ctx.createImageData(base.width, base.height);
    result.data.set(out);
    ctx.putImageData(result, 0, 0);
  }, [adjust]);

  useEffect(() => {
    if (!hasImage) return;
    const id = requestAnimationFrame(redraw);
    return () => cancelAnimationFrame(id);
  }, [redraw, hasImage]);

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
    } catch {
      setAiError(t("image.aiError"));
      setAiBusy(false);
    }
  };

  const runRestore = async () => {
    const img = imgRef.current;
    if (!img || aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const src = await restoreImage(img, restoreKey);
      const im = new Image();
      im.onload = () => {
        drawImageElement(im, MAX_AI_OUTPUT);
        setAiBusy(false);
      };
      im.onerror = () => {
        setAiError(t("image.aiError"));
        setAiBusy(false);
      };
      im.src = src;
    } catch {
      setAiError(t("image.aiError"));
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

          {/* AI restore */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stars className="h-4 w-4 text-accent" />
                {t("imglab.restoreTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("imglab.restoreDesc")}
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={restoreKey}
                  onChange={(e) => setRestoreKey(e.target.value as Restore)}
                  disabled={aiBusy}
                  className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm disabled:opacity-50"
                >
                  <option value="deblur">{t("image.rDeblur")}</option>
                  <option value="denoise">{t("image.rDenoise")}</option>
                  <option value="lowlight">{t("image.rLowlight")}</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runRestore}
                  disabled={aiBusy}
                >
                  <Wand2 className="h-4 w-4" />{" "}
                  {aiBusy ? t("image.processing") : t("imglab.run")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </div>
  );
}
