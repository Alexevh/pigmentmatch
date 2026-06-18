import { useRef, useState, useCallback } from "react";
import { Upload } from "lucide-react";
import type { RGB } from "@/lib/color";
import { Button } from "@/components/ui/button";

export function ImageSampler({ onSample }: { onSample: (rgb: RGB) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasImage, setHasImage] = useState(false);
  const [hover, setHover] = useState<RGB | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
      setHasImage(true);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const pixelAt = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): RGB | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const x = Math.round(((e.clientX - rect.left) / rect.width) * canvas.width);
      const y = Math.round(((e.clientY - rect.top) / rect.height) * canvas.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const d = ctx?.getImageData(x, y, 1, 1).data;
      if (!d) return null;
      return { r: d[0], g: d[1], b: d[2] };
    },
    []
  );

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
            const c = pixelAt(e);
            if (c) onSample(c);
          }}
          onMouseMove={(e) => setHover(pixelAt(e))}
          onMouseLeave={() => setHover(null)}
          className="w-full cursor-crosshair rounded-lg border border-border"
        />
        <div className="mt-2 flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> Replace image
          </Button>
          {hover && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="h-5 w-5 rounded border border-border"
                style={{ backgroundColor: `rgb(${hover.r},${hover.g},${hover.b})` }}
              />
              <span className="font-mono">
                {hover.r}, {hover.g}, {hover.b}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
