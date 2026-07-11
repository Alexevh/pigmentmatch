import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layers } from "lucide-react";
import { valuePlanes, type ValuePlane } from "@/lib/extract";
import { generateRecipe } from "@/lib/mixer";
import { rgbToLab, rgbToHex, isLight, type RGB } from "@/lib/color";
import type { Pigment } from "@/lib/pigments";
import { useActiveImage } from "@/hooks/useActiveImage";
import { useRecipeMode } from "@/hooks/useRecipeMode";
import { useMixEngine } from "@/hooks/useMixEngine";
import { useT } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecipeView } from "./RecipeView";
import { cn } from "@/lib/utils";

const PLANE_COUNTS = [3, 4, 5] as const;
const DISPLAY_MAX = 560;

// Value study: posterize the reference into 3-5 VALUE planes (the notan) and
// give the mixing recipe for each plane's average color with the active
// palette — the bridge between "extract the colors" and how a painting is
// actually started (big value masses first). Reads the same stored image as
// the palette extractor (slot extract.source); fully additive.
export function ValueStudyView({ pigments }: { pigments: Pigment[] }) {
  const { t } = useT();
  const mode = useRecipeMode();
  const engine = useMixEngine();
  const { blob } = useActiveImage("extract.source");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<ImageData | null>(null);
  const [ready, setReady] = useState(0); // bumps when the image (re)loads
  const [count, setCount] = useState<(typeof PLANE_COUNTS)[number]>(4);
  const [sel, setSel] = useState<number | null>(null);

  // Draw the stored extractor image (if any) to an offscreen-ish canvas.
  useEffect(() => {
    if (!blob) {
      baseRef.current = null;
      setReady((r) => r + 1);
      return;
    }
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = Math.min(1, DISPLAY_MAX / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      baseRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setReady((r) => r + 1);
    };
    img.src = url;
  }, [blob]);

  const pixels = useMemo<RGB[]>(() => {
    void ready;
    const base = baseRef.current;
    if (!base) return [];
    const { width: w, height: h, data } = base;
    const step = Math.max(1, Math.round(Math.sqrt((w * h) / 12000)));
    const out: RGB[] = [];
    for (let y = 0; y < h; y += step)
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        if (data[i + 3] < 128) continue;
        out.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
      }
    return out;
  }, [ready]);

  const planes = useMemo<ValuePlane[]>(
    () => valuePlanes(pixels, count),
    [pixels, count]
  );

  // Posterized notan map: each pixel painted with its plane's mean color.
  const drawMap = useCallback(() => {
    const canvas = canvasRef.current;
    const base = baseRef.current;
    if (!canvas || !base || !planes.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const out = new ImageData(base.width, base.height);
    const centers = planes.map((p) => p.centerL);
    const colors = planes.map((p) => p.mean);
    const d = base.data;
    for (let i = 0; i < d.length; i += 4) {
      const L = rgbToLab({ r: d[i], g: d[i + 1], b: d[i + 2] }).L;
      let bi = 0;
      let bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const dd = Math.abs(L - centers[c]);
        if (dd < bd) {
          bd = dd;
          bi = c;
        }
      }
      out.data[i] = colors[bi].r;
      out.data[i + 1] = colors[bi].g;
      out.data[i + 2] = colors[bi].b;
      out.data[i + 3] = d[i + 3];
    }
    ctx.putImageData(out, 0, 0);
  }, [planes]);

  useEffect(() => {
    drawMap();
  }, [drawMap, ready]);

  const selPlane = sel != null ? planes[sel] : null;
  const recipe = useMemo(
    () =>
      selPlane && pigments.length
        ? generateRecipe(selPlane.mean, pigments, mode, engine)
        : null,
    [selPlane, pigments, mode, engine]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-accent" /> {t("valueStudy.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t("valueStudy.intro")}</p>
        {!blob && (
          <p className="text-sm text-muted-foreground">
            {t("valueStudy.empty")}
          </p>
        )}
        <div className={blob ? "space-y-3" : "hidden"}>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t("valueStudy.planes")}
            </span>
            {PLANE_COUNTS.map((n) => (
              <Button
                key={n}
                size="sm"
                variant={count === n ? "accent" : "outline"}
                onClick={() => {
                  setCount(n);
                  setSel(null);
                }}
              >
                {n}
              </Button>
            ))}
          </div>
          <canvas
            ref={canvasRef}
            className="block max-w-full rounded-lg border border-border"
          />
          <div className="flex overflow-hidden rounded-lg border border-border">
            {planes.map((p, i) => (
              <button
                key={i}
                onClick={() => setSel(sel === i ? null : i)}
                className={cn(
                  "relative h-14 transition-transform hover:z-10 hover:scale-105",
                  sel === i && "z-10 ring-2 ring-accent"
                )}
                style={{
                  backgroundColor: rgbToHex(p.mean),
                  flexGrow: Math.max(0.15, p.share),
                  flexBasis: 0,
                }}
                title={`L* ${Math.round(p.centerL)}`}
              >
                <span
                  className={cn(
                    "absolute bottom-1 left-0 right-0 text-center text-[10px] tabular-nums",
                    isLight(p.mean) ? "text-black/60" : "text-white/70"
                  )}
                >
                  {Math.round(p.share * 100)}%
                </span>
              </button>
            ))}
          </div>
          {selPlane && recipe && (
            <div className="space-y-1.5 rounded-md border border-border bg-secondary/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("valueStudy.recipeFor", {
                  lo: Math.round(selPlane.loL),
                  hi: Math.round(selPlane.hiL),
                })}
              </p>
              <RecipeView recipe={recipe} compact />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
