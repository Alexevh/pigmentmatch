import { useRef, useState, useCallback } from "react";
import { Upload, Search, SearchX, Camera, Plus, Minus } from "lucide-react";
import { rgbToHex, type RGB } from "@/lib/color";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { CameraCapture } from "@/components/CameraCapture";
import { cn } from "@/lib/utils";

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
      imgRef.current = img; // keep the full-res image for a crisp loupe
      setHasImage(true);
      setZoom(1);
      setPan({ x: 0, y: 0 });
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

  const zoomIn = () => setZoom((z) => Math.min(6, +(z + 0.5).toFixed(2)));
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
              disabled={zoom >= 6}
              title="Zoom in"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
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
