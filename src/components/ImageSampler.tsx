import { useRef, useState, useCallback, useEffect } from "react";
import {
  Upload,
  Search,
  SearchX,
  Camera,
  Plus,
  Minus,
  Pipette,
  Sigma,
  X,
} from "lucide-react";
import {
  rgbToHex,
  rgbToLab,
  deltaE2000,
  whiteBalance,
  type RGB,
} from "@/lib/color";
import { useT } from "@/lib/i18n";
import { useActiveImage } from "@/hooks/useActiveImage";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { CameraCapture } from "@/components/CameraCapture";
import { cn } from "@/lib/utils";

const LOUPE = 132; // px diameter of the magnifier
const ZOOM = 6; // magnification factor

// Eyedropper cursor for the sampling canvas — an inline SVG pipette with a white
// halo + black stroke so it reads on any image, hotspot at the tip.
// Falls back to crosshair where custom cursors aren't supported.
const PIPETTE_PATHS =
  "<path d='m2 22 1-1h3l9-9'/><path d='M3 21v-3l9-9'/><path d='m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z'/>";
const PICK_CURSOR =
  'url("data:image/svg+xml,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke-linecap='round' stroke-linejoin='round'>" +
      "<g stroke='white' stroke-width='3.5'>" +
      PIPETTE_PATHS +
      "</g><g stroke='black' stroke-width='1.5'>" +
      PIPETTE_PATHS +
      "</g></svg>"
  ) +
  '") 2 16, crosshair';

const meanRgb = (picks: RGB[]): RGB => ({
  r: Math.round(picks.reduce((s, p) => s + p.r, 0) / picks.length),
  g: Math.round(picks.reduce((s, p) => s + p.g, 0) / picks.length),
  b: Math.round(picks.reduce((s, p) => s + p.b, 0) / picks.length),
});

// Worst-case ΔE2000 from the mean to any individual pick — how much the takes
// disagree (camera noise). Shown so the painter knows how much to trust one.
const spreadDE = (picks: RGB[], mean: RGB): number => {
  const m = rgbToLab(mean);
  return picks.reduce(
    (mx, p) => Math.max(mx, deltaE2000(rgbToLab(p), m)),
    0
  );
};

// Color sampler: upload (or camera) a photo, optionally zoom/pan and use the
// magnifier loupe, then click to pick a color. Image editing (adjustments / AI)
// lives in the separate IMG Lab tab.
export function ImageSampler({
  onSample,
  onImage,
  onSamplePos,
  probe,
  slot,
}: {
  onSample: (rgb: RGB) => void;
  onImage?: (img: HTMLImageElement) => void;
  onSamplePos?: (nx: number, ny: number) => void;
  probe?: string;
  // Optional persistence: when set, the uploaded photo is saved to this slot
  // (IndexedDB + optional cloud sync) and restored on mount / across devices.
  slot?: string;
}) {
  const { t } = useT();
  const { blob: storedBlob, save: saveSlot } = useActiveImage(slot);
  const [probePos, setProbePos] = useState<{ x: number; y: number } | null>(
    null
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [hasImage, setHasImage] = useState(false);
  const [hover, setHover] = useState<RGB | null>(null);
  const [showCam, setShowCam] = useState(false);
  const [loupeOn, setLoupeOn] = useState(false);
  const [loupePos, setLoupePos] = useState<{ x: number; y: number } | null>(
    null
  );

  // In-box zoom + pan: the canvas is scaled/translated with a CSS transform so
  // the container stays the same size; drag to pan for a finer pick. Sampling
  // still works because coordsAt uses the canvas's bounding rect.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef({
    down: false,
    moved: false,
    startX: 0,
    startY: 0,
    panX: 0,
    panY: 0,
  });

  // Optional sample radius: 0 = a single pixel (default, exactly as before);
  // higher averages a (2r+1)² block so a click on a noisy/high-detail area
  // returns one representative color instead of one stray pixel.
  const [sampleR, setSampleR] = useState(0);
  // Cursor position (screen px) for the brush-size ring overlay.
  const [brushPos, setBrushPos] = useState<{ x: number; y: number } | null>(
    null
  );

  // Optional white-balance reference (opt-in). Phone cameras cast the whole
  // frame; if the painter includes a white/gray card in the SAME shot, clicking
  // it in "set reference" mode captures its raw color, and every subsequent
  // pick is neutralized against it (see whiteBalance). Off by default → the
  // sampler behaves exactly as before.
  const [wbPick, setWbPick] = useState(false); // next click sets the reference
  const [wbRef, setWbRef] = useState<RGB | null>(null);
  // Optional: correct only the color cast and keep the sampled color's own
  // lightness (off by default → full correction, exactly as before).
  const [wbKeepValue, setWbKeepValue] = useState(false);
  // Raw (uncorrected) RGB of the last real pick, so setting/clearing the
  // reference (or toggling keep-value) can re-emit that same color corrected —
  // the swatch updates immediately instead of waiting for the next click.
  const lastRawRef = useRef<RGB | null>(null);

  // Optional multi-pick averaging (opt-in): each click adds a take and emits
  // the running MEAN, with the takes' worst-case disagreement (ΔE2000 spread)
  // shown so the painter knows how noisy the captures are. One noisy phone
  // shot varies several ΔE between clicks on the same swatch — averaging 3-5
  // takes is much more trustworthy. Off by default = old single-pick behavior.
  const [avgOn, setAvgOn] = useState(false);
  const [avgPicks, setAvgPicks] = useState<RGB[]>([]);
  const correct = useCallback(
    (rgb: RGB | null): RGB | null =>
      rgb && wbRef ? whiteBalance(rgb, wbRef, wbKeepValue) : rgb,
    [wbRef, wbKeepValue]
  );

  const drawFile = useCallback(
    (file: Blob, persist = false) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const maxW = 900;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        imgRef.current = img; // full-res image for a crisp loupe
        setHasImage(true);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setWbRef(null); // a new photo has its own cast — drop the old reference
        setWbPick(false);
        lastRawRef.current = null;
        setAvgPicks([]); // takes belong to one photo
        onImage?.(img);
        URL.revokeObjectURL(url);
      };
      img.src = url;
      // Persist freshly uploaded/captured photos to the slot (if any). Restored
      // images pass persist=false so we don't re-save (which would loop).
      if (persist) saveSlot(file);
    },
    [onImage, saveSlot]
  );

  // Restore (or react to a cloud pull / other-tab update / deletion of) the
  // stored image — so a manual sync that pulls or clears it updates the view
  // immediately, without needing to switch tabs.
  const lastDrawn = useRef<Blob | null>(null);
  useEffect(() => {
    if (storedBlob) {
      if (storedBlob !== lastDrawn.current) {
        lastDrawn.current = storedBlob;
        drawFile(storedBlob, false);
      }
    } else if (lastDrawn.current) {
      // The stored image was removed (cleared / deleted by a sync) — reset.
      lastDrawn.current = null;
      setHasImage(false);
      imgRef.current = null;
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setHover(null);
      const c = canvasRef.current;
      c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    }
  }, [storedBlob, drawFile]);

  // cursor -> canvas pixel coordinates. Clamped to the last row/column: at the
  // extreme right/bottom edge the rounding yields x === width, and getImageData
  // out of bounds returns transparent black — a click there would sample #000.
  const coordsAt = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * canvas.height);
    return {
      x: Math.max(0, Math.min(canvas.width - 1, x)),
      y: Math.max(0, Math.min(canvas.height - 1, y)),
    };
  }, []);

  const pixelAt = useCallback((x: number, y: number): RGB | null => {
    const ctx = canvasRef.current?.getContext("2d", {
      willReadFrequently: true,
    });
    const d = ctx?.getImageData(x, y, 1, 1).data;
    if (!d) return null;
    return { r: d[0], g: d[1], b: d[2] };
  }, []);

  // Sample the color at (x,y): a single pixel when radius is 0 (default), else
  // the average of a (2r+1)² block — robust to high-detail / noisy areas.
  const sampleAt = useCallback(
    (x: number, y: number): RGB | null => {
      if (sampleR <= 0) return pixelAt(x, y);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !ctx) return null;
      const x0 = Math.max(0, x - sampleR);
      const y0 = Math.max(0, y - sampleR);
      const x1 = Math.min(canvas.width, x + sampleR + 1);
      const y1 = Math.min(canvas.height, y + sampleR + 1);
      const w = x1 - x0;
      const h = y1 - y0;
      if (w <= 0 || h <= 0) return pixelAt(x, y);
      const d = ctx.getImageData(x0, y0, w, h).data;
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue;
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        n++;
      }
      if (n === 0) return pixelAt(x, y);
      return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
    },
    [sampleR, pixelAt]
  );

  // Magnified region (from the original image, so it stays crisp) centered on
  // the cursor, plus a crosshair marking the exact pixel.
  const drawLoupe = useCallback((cx: number, cy: number) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const loupe = loupeRef.current;
    if (!canvas || !img || !loupe) return;
    const lctx = loupe.getContext("2d");
    if (!lctx) return;

    const ox = (cx / canvas.width) * img.naturalWidth;
    const oy = (cy / canvas.height) * img.naturalHeight;
    const region = LOUPE / ZOOM;

    lctx.imageSmoothingEnabled = false;
    lctx.clearRect(0, 0, LOUPE, LOUPE);
    lctx.drawImage(
      img,
      ox - region / 2,
      oy - region / 2,
      region,
      region,
      0,
      0,
      LOUPE,
      LOUPE
    );

    lctx.strokeStyle = "rgba(255,255,255,0.85)";
    lctx.lineWidth = 1;
    lctx.beginPath();
    lctx.moveTo(LOUPE / 2, 0);
    lctx.lineTo(LOUPE / 2, LOUPE);
    lctx.moveTo(0, LOUPE / 2);
    lctx.lineTo(LOUPE, LOUPE / 2);
    lctx.stroke();
    lctx.strokeStyle = "rgba(0,0,0,0.9)";
    lctx.strokeRect(LOUPE / 2 - ZOOM / 2, LOUPE / 2 - ZOOM / 2, ZOOM, ZOOM);
  }, []);

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (d.down) {
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      if (d.moved) {
        const cv = canvasRef.current;
        const maxX = cv ? (cv.clientWidth * (zoom - 1)) / 2 : 0;
        const maxY = cv ? (cv.clientHeight * (zoom - 1)) / 2 : 0;
        setPan({
          x: Math.max(-maxX, Math.min(maxX, d.panX + dx)),
          y: Math.max(-maxY, Math.min(maxY, d.panY + dy)),
        });
        setHover(null);
        setLoupePos(null);
        setProbePos(null);
        setBrushPos(null);
        return;
      }
    }

    const c = coordsAt(e);
    if (!c) return;
    // While picking the reference, show the raw color under the cursor; once a
    // reference is set, hover previews the corrected color.
    const raw = sampleAt(c.x, c.y);
    setHover(wbPick ? raw : correct(raw));
    setBrushPos(sampleR > 0 ? { x: e.clientX, y: e.clientY } : null);
    if (probe) setProbePos({ x: e.clientX, y: e.clientY });
    if (loupeOn) {
      drawLoupe(c.x, c.y);
      const pad = 18;
      const x = Math.min(e.clientX + pad, window.innerWidth - LOUPE - 8);
      const y = Math.max(8, e.clientY - LOUPE - pad);
      setLoupePos({ x, y });
    }
  };

  const zoomIn = () => setZoom((z) => Math.min(10, +(z + 0.5).toFixed(2)));
  const zoomOut = () =>
    setZoom((z) => {
      const nz = Math.max(1, +(z - 0.5).toFixed(2));
      if (nz === 1) setPan({ x: 0, y: 0 });
      return nz;
    });

  return (
    <div className="space-y-3">
      {showCam && (
        <CameraCapture
          onCapture={(b) => drawFile(b, true)}
          onClose={() => setShowCam(false)}
        />
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) drawFile(f, true);
        }}
      />

      {!hasImage && (
        <div className="space-y-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-64 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
          >
            <Upload className="h-8 w-8" />
            <span className="text-sm font-medium">{t("image.uploadTitle")}</span>
            <span className="text-xs">{t("image.uploadHint")}</span>
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

      <div className={hasImage ? "block" : "hidden"}>
        <div className="relative overflow-hidden rounded-lg border border-border">
          <canvas
            ref={canvasRef}
            onClick={(e) => {
              if (dragRef.current.moved) {
                dragRef.current.moved = false;
                return; // it was a pan, not a pick
              }
              const c = coordsAt(e);
              if (!c) return;
              const rgb = sampleAt(c.x, c.y);
              if (!rgb) return;
              if (wbPick) {
                // Capture the neutral reference (raw pixels) and switch to
                // correcting mode. This click doesn't pick a NEW color, but it
                // re-corrects the LAST picked color against the new reference so
                // the swatch updates right away.
                setWbRef(rgb);
                setWbPick(false);
                if (lastRawRef.current)
                  onSample(whiteBalance(lastRawRef.current, rgb, wbKeepValue));
                return;
              }
              lastRawRef.current = rgb; // remember the raw pick
              const out = correct(rgb) ?? rgb;
              if (avgOn) {
                // Averaging: accumulate takes and emit the running mean.
                const picks = [...avgPicks, out];
                setAvgPicks(picks);
                onSample(meanRgb(picks));
              } else {
                onSample(out);
              }
              const cv = canvasRef.current;
              if (cv) onSamplePos?.(c.x / cv.width, c.y / cv.height);
            }}
            onMouseDown={(e) => {
              dragRef.current = {
                down: true,
                moved: false,
                startX: e.clientX,
                startY: e.clientY,
                panX: pan.x,
                panY: pan.y,
              };
            }}
            onMouseUp={() => {
              dragRef.current.down = false;
            }}
            onMouseMove={handleMove}
            onMouseLeave={() => {
              dragRef.current.down = false;
              setHover(null);
              setLoupePos(null);
              setProbePos(null);
              setBrushPos(null);
            }}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              cursor: PICK_CURSOR,
            }}
            className="block w-full"
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
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
          <Button
            variant={loupeOn ? "accent" : "outline"}
            size="sm"
            onClick={() => setLoupeOn((z) => !z)}
            title={loupeOn ? t("image.zoomOn") : t("image.zoomOff")}
            className={
              loupeOn
                ? undefined
                : "border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"
            }
          >
            {loupeOn ? (
              <Search className="h-4 w-4" />
            ) : (
              <SearchX className="h-4 w-4" />
            )}{" "}
            {t("image.zoom")}
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
          <div
            className="flex items-center gap-2"
            title={t("image.brushTitle")}
          >
            <span className="text-xs text-muted-foreground">
              {t("image.brush")}
            </span>
            <Slider
              value={sampleR}
              min={0}
              max={24}
              step={1}
              onChange={setSampleR}
              className="w-24"
            />
            <span className="w-7 text-xs tabular-nums text-muted-foreground">
              {sampleR === 0 ? "1px" : `${sampleR * 2 + 1}`}
            </span>
          </div>
          {/* Multi-pick averaging (opt-in): each click adds a take, the swatch
              gets the running mean, and the chip shows how much the takes
              disagree. */}
          <div className="flex items-center gap-1.5">
            <Button
              variant={avgOn ? "accent" : "outline"}
              size="sm"
              onClick={() => {
                setAvgOn((v) => !v);
                setAvgPicks([]);
              }}
              title={t("image.avgHint")}
            >
              <Sigma className="h-4 w-4" /> {t("image.avg")}
            </Button>
            {avgOn && avgPicks.length > 0 && (
              <>
                <span
                  className="rounded-full border border-border bg-secondary/40 px-2 py-1 text-xs tabular-nums text-muted-foreground"
                  title={t("image.avgSpreadHint")}
                >
                  {t("image.avgCount", {
                    n: avgPicks.length,
                    d: spreadDE(avgPicks, meanRgb(avgPicks)).toFixed(1),
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setAvgPicks([])}
                  title={t("image.avgClear")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
          {/* White-balance reference (opt-in): neutralize the phone's color
              cast against a white/gray card in the same photo. */}
          {wbRef ? (
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300"
                title={t("image.wbActiveHint")}
              >
                <span
                  className="h-3.5 w-3.5 rounded-full border border-white/60"
                  style={{ backgroundColor: rgbToHex(wbRef) }}
                />
                {t("image.wbActive")}
              </span>
              <Button
                variant={wbKeepValue ? "accent" : "outline"}
                size="sm"
                className="h-7"
                onClick={() => {
                  const next = !wbKeepValue;
                  setWbKeepValue(next);
                  // Re-emit the last pick with the new setting.
                  if (lastRawRef.current && wbRef)
                    onSample(whiteBalance(lastRawRef.current, wbRef, next));
                }}
                title={t("image.wbKeepValueHint")}
              >
                {t("image.wbKeepValue")}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setWbRef(null);
                  setWbPick(false);
                  // Revert the swatch to the uncorrected color.
                  if (lastRawRef.current) onSample(lastRawRef.current);
                }}
                title={t("image.wbClear")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              variant={wbPick ? "accent" : "outline"}
              size="sm"
              onClick={() => setWbPick((v) => !v)}
              title={t("image.wbHint")}
            >
              <Pipette className="h-4 w-4" />{" "}
              {wbPick ? t("image.wbPicking") : t("image.wb")}
            </Button>
          )}
          {hover && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="h-5 w-5 rounded border border-border"
                style={{ backgroundColor: rgbToHex(hover) }}
              />
              <span className="font-mono">
                {rgbToHex(hover)} · {hover.r}, {hover.g}, {hover.b}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Floating magnifier — follows the cursor while hovering the image */}
      <canvas
        ref={loupeRef}
        width={LOUPE}
        height={LOUPE}
        className={cn(
          "pointer-events-none fixed z-50 rounded-full border-2 border-white shadow-xl",
          loupeOn && loupePos ? "block" : "hidden"
        )}
        style={loupePos ? { left: loupePos.x, top: loupePos.y } : undefined}
      />

      {/* Optional probe: color under the cursor (left) next to the `probe` color
          (right), flanking the pointer for direct comparison */}
      {probe && probePos && (
        <>
          {hover && (
            <span
              className="pointer-events-none fixed z-50 h-7 w-7 -translate-x-full -translate-y-1/2 rounded border-2 border-white shadow-md"
              style={{
                left: probePos.x - 14,
                top: probePos.y,
                backgroundColor: rgbToHex(hover),
              }}
            />
          )}
          <span
            className="pointer-events-none fixed z-50 h-7 w-7 -translate-y-1/2 rounded border-2 border-white shadow-md"
            style={{
              left: probePos.x + 14,
              top: probePos.y,
              backgroundColor: probe,
            }}
          />
        </>
      )}

      {/* Brush-size ring: shows the area a click will average (when radius > 0) */}
      {sampleR > 0 &&
        brushPos &&
        (() => {
          const cv = canvasRef.current;
          const pxPerCanvas = cv ? (cv.clientWidth / cv.width) * zoom : zoom;
          const d = Math.max(6, (sampleR * 2 + 1) * pxPerCanvas);
          return (
            <span
              className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
              style={{
                left: brushPos.x,
                top: brushPos.y,
                width: d,
                height: d,
              }}
            />
          );
        })()}
    </div>
  );
}
