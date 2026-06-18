import { useRef, useState, useCallback } from "react";
import { Upload, Search } from "lucide-react";
import { rgbToHex, type RGB } from "@/lib/color";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LOUPE = 132; // px diameter of the magnifier
const ZOOM = 6; // magnification factor

export function ImageSampler({ onSample }: { onSample: (rgb: RGB) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [hasImage, setHasImage] = useState(false);
  const [hover, setHover] = useState<RGB | null>(null);
  const [loupeOn, setLoupeOn] = useState(false);
  const [loupePos, setLoupePos] = useState<{ x: number; y: number } | null>(
    null
  );

  const drawFile = useCallback((file: File) => {
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
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

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
    const c = coordsAt(e);
    if (!c) return;
    setHover(pixelAt(c.x, c.y));
    if (loupeOn) {
      drawLoupe(c.x, c.y);
      // place the loupe near the cursor without covering the target, clamped
      const pad = 18;
      const x = Math.min(e.clientX + pad, window.innerWidth - LOUPE - 8);
      const y = Math.max(8, e.clientY - LOUPE - pad);
      setLoupePos({ x, y });
    }
  };

  return (
    <div className="space-y-3">
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
        <button
          onClick={() => fileRef.current?.click()}
          className="flex h-64 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
        >
          <Upload className="h-8 w-8" />
          <span className="text-sm font-medium">
            Upload an image to sample colors
          </span>
          <span className="text-xs">Click anywhere on it to pick a color</span>
        </button>
      )}

      <div className={hasImage ? "block" : "hidden"}>
        <canvas
          ref={canvasRef}
          onClick={(e) => {
            const c = coordsAt(e);
            if (!c) return;
            const rgb = pixelAt(c.x, c.y);
            if (rgb) onSample(rgb);
          }}
          onMouseMove={handleMove}
          onMouseLeave={() => {
            setHover(null);
            setLoupePos(null);
          }}
          className="w-full cursor-crosshair rounded-lg border border-border"
        />

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> Replace image
          </Button>
          <Button
            variant={loupeOn ? "accent" : "outline"}
            size="sm"
            onClick={() => setLoupeOn((z) => !z)}
            title="Magnifier loupe for precise sampling"
          >
            <Search className="h-4 w-4" /> Zoom {loupeOn ? "on" : "off"}
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
    </div>
  );
}
