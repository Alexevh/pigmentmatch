import { useRef, useState, useCallback, useEffect } from "react";
import {
  Upload,
  Search,
  SearchX,
  Camera,
  Plus,
  Minus,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import { rgbToHex, type RGB } from "@/lib/color";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { CameraCapture } from "@/components/CameraCapture";
import { cn } from "@/lib/utils";

// --- Local image adjustments (no dependencies, runs on the canvas) ---

interface Adjust {
  sharpen: number; // 0..100
  brightness: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
  temperature: number; // -100..100 (warm +)
}
const DEFAULT_ADJUST: Adjust = {
  sharpen: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
};
const adjustActive = (a: Adjust) =>
  a.sharpen !== 0 ||
  a.brightness !== 0 ||
  a.contrast !== 0 ||
  a.saturation !== 0 ||
  a.temperature !== 0;

const clampByte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

// 3x3 sharpen kernel, blended into the original by `amount` (0..1).
function sharpenImage(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  amount: number
): Uint8ClampedArray {
  const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        const py = y + ky < 0 ? 0 : y + ky >= h ? h - 1 : y + ky;
        for (let kx = -1; kx <= 1; kx++) {
          const px = x + kx < 0 ? 0 : x + kx >= w ? w - 1 : x + kx;
          const idx = (py * w + px) * 4;
          const kk = k[(ky + 1) * 3 + (kx + 1)];
          r += data[idx] * kk;
          g += data[idx + 1] * kk;
          b += data[idx + 2] * kk;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = clampByte(data[o] + (r - data[o]) * amount);
      out[o + 1] = clampByte(data[o + 1] + (g - data[o + 1]) * amount);
      out[o + 2] = clampByte(data[o + 2] + (b - data[o + 2]) * amount);
      out[o + 3] = data[o + 3];
    }
  }
  return out;
}

const LOUPE = 132; // px diameter of the magnifier
const ZOOM = 6; // magnification factor

// Eyedropper cursor for the sampling canvas — an inline SVG pipette with a white
// halo + black stroke so it reads on any image, hotspot at the tip (2,22).
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

export function ImageSampler({
  onSample,
  onImage,
  onSamplePos,
  probe,
}: {
  onSample: (rgb: RGB) => void;
  onImage?: (img: HTMLImageElement) => void;
  onSamplePos?: (nx: number, ny: number) => void;
  probe?: string;
}) {
  const { t } = useT();
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

  // In-box zoom + pan: the canvas is scaled/translated with a CSS transform so
  // the container stays the same size; you can drag the image around for a finer
  // pick. Color sampling still works because coordsAt uses the canvas's
  // bounding rect, which already reflects the transform.
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

  // Image adjustments: the untouched scaled image is kept as `baseRef`; sliders
  // recompute the visible canvas from it. Sampling reads the adjusted canvas.
  const baseRef = useRef<ImageData | null>(null);
  const [adjust, setAdjust] = useState<Adjust>(DEFAULT_ADJUST);
  const [showAdjust, setShowAdjust] = useState(false);
  const [loupePos, setLoupePos] = useState<{ x: number; y: number } | null>(
    null
  );

  const drawFile = useCallback((file: Blob) => {
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
      // keep the untouched scaled pixels so adjustments are non-destructive
      baseRef.current =
        ctx?.getImageData(0, 0, canvas.width, canvas.height) ?? null;
      imgRef.current = img; // keep the full-res image for a crisp loupe
      setHasImage(true);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setAdjust(DEFAULT_ADJUST);
      onImage?.(img);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [onImage]);

  // cursor -> canvas pixel coordinates
  const coordsAt = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const x = Math.round(((e.clientX - rect.left) / rect.width) * canvas.width);
      const y = Math.round(((e.clientY - rect.top) / rect.height) * canvas.height);
      return { x, y };
    },
    []
  );

  const pixelAt = useCallback(
    (x: number, y: number): RGB | null => {
      const ctx = canvasRef.current?.getContext("2d", {
        willReadFrequently: true,
      });
      const d = ctx?.getImageData(x, y, 1, 1).data;
      if (!d) return null;
      return { r: d[0], g: d[1], b: d[2] };
    },
    []
  );

  // Draw the magnified region (from the original image, so it stays crisp)
  // centered on the cursor, plus a crosshair marking the exact pixel.
  const drawLoupe = useCallback((cx: number, cy: number) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const loupe = loupeRef.current;
    if (!canvas || !img || !loupe) return;
    const lctx = loupe.getContext("2d");
    if (!lctx) return;

    const ox = (cx / canvas.width) * img.naturalWidth;
    const oy = (cy / canvas.height) * img.naturalHeight;
    const region = LOUPE / ZOOM; // original-image px shown in the loupe

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

    // crosshair
    lctx.strokeStyle = "rgba(255,255,255,0.85)";
    lctx.lineWidth = 1;
    lctx.beginPath();
    lctx.moveTo(LOUPE / 2, 0);
    lctx.lineTo(LOUPE / 2, LOUPE);
    lctx.moveTo(0, LOUPE / 2);
    lctx.lineTo(LOUPE, LOUPE / 2);
    lctx.stroke();
    // exact-pixel box at center
    lctx.strokeStyle = "rgba(0,0,0,0.9)";
    lctx.strokeRect(LOUPE / 2 - ZOOM / 2, LOUPE / 2 - ZOOM / 2, ZOOM, ZOOM);
  }, []);

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Dragging to pan (only meaningful when zoomed in).
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
        return;
      }
    }

    const c = coordsAt(e);
    if (!c) return;
    setHover(pixelAt(c.x, c.y));
    if (probe) setProbePos({ x: e.clientX, y: e.clientY });
    if (loupeOn) {
      drawLoupe(c.x, c.y);
      // place the loupe near the cursor without covering the target, clamped
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

  // Recompute the visible canvas from the untouched base whenever a slider moves.
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const base = baseRef.current;
    if (!canvas || !base) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const { width: w, height: h } = base;
    const px = new Uint8ClampedArray(base.data);
    const { sharpen, brightness, contrast, saturation, temperature } = adjust;
    const cf = (259 * (contrast + 255)) / (255 * (259 - contrast)); // contrast factor
    const satF = 1 + saturation / 100;
    for (let i = 0; i < px.length; i += 4) {
      let r = px[i],
        g = px[i + 1],
        b = px[i + 2];
      r += brightness;
      g += brightness;
      b += brightness;
      r = cf * (r - 128) + 128;
      g = cf * (g - 128) + 128;
      b = cf * (b - 128) + 128;
      r += temperature * 0.6; // warm: more red, less blue
      b -= temperature * 0.6;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * satF;
      g = gray + (g - gray) * satF;
      b = gray + (b - gray) * satF;
      px[i] = clampByte(r);
      px[i + 1] = clampByte(g);
      px[i + 2] = clampByte(b);
    }
    const out = sharpen > 0 ? sharpenImage(px, w, h, sharpen / 100) : px;
    const result = ctx.createImageData(w, h);
    result.data.set(out);
    ctx.putImageData(result, 0, 0);
  }, [adjust]);

  // Coalesce rapid slider changes to one repaint per frame.
  useEffect(() => {
    if (!hasImage) return;
    const id = requestAnimationFrame(redraw);
    return () => cancelAnimationFrame(id);
  }, [redraw, hasImage]);

  return (
    <div className="space-y-3">
      {showCam && (
        <CameraCapture
          onCapture={(b) => drawFile(b)}
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
          if (f) drawFile(f);
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
              const rgb = pixelAt(c.x, c.y);
              if (rgb) onSample(rgb);
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
          <Button
            variant={showAdjust || adjustActive(adjust) ? "accent" : "outline"}
            size="sm"
            onClick={() => setShowAdjust((s) => !s)}
          >
            <SlidersHorizontal className="h-4 w-4" /> {t("image.adjust")}
          </Button>
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

        {showAdjust && (
          <div className="mt-2 space-y-2 rounded-md border border-border bg-secondary/30 p-3">
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
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted-foreground">
                {t("image.adjustHint")}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAdjust(DEFAULT_ADJUST)}
                disabled={!adjustActive(adjust)}
              >
                <RotateCcw className="h-3.5 w-3.5" /> {t("image.reset")}
              </Button>
            </div>
          </div>
        )}
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
        style={
          loupePos ? { left: loupePos.x, top: loupePos.y } : undefined
        }
      />

      {/* Optional probe: the color under the cursor (left) next to the `probe`
          color (right), flanking the pointer for direct comparison */}
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
            style={{ left: probePos.x + 14, top: probePos.y, backgroundColor: probe }}
          />
        </>
      )}
    </div>
  );
}
