import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  Loader2,
  Grid2x2,
  X,
  FlaskConical,
  FlipHorizontal,
} from "lucide-react";
import { rgbToHex, rgbToLab, deltaE, type RGB } from "@/lib/color";
import { extractPalette, relationshipHint } from "@/lib/extract";
import {
  generateRecipe,
  planPalette,
  type Recipe,
  type PalettePlan,
} from "@/lib/mixer";
import { libraryPigments } from "@/lib/pigments";
import { useRecipeMode } from "@/hooks/useRecipeMode";
import { useMixEngine } from "@/hooks/useMixEngine";
import {
  useMaxColors,
  useValuePriority,
  useGoldenRatio,
} from "@/hooks/useRecipeLimits";
import { useActiveImage } from "@/hooks/useActiveImage";
import { useT } from "@/lib/i18n";
import { analysisSentence } from "@/lib/describe";
import { cn } from "@/lib/utils";
import type { Pigment } from "@/lib/pigments";
import { Button } from "@/components/ui/button";
import { Swatch } from "./Swatch";
import { RecipeView, RecipeControls } from "./RecipeView";
import { PaletteChipSelect } from "./PaletteChipSelect";

const COUNTS = [4, 8, 12, 20] as const;
const DISPLAY_MAX = 760;

function planMatchClass(m: number): string {
  if (m >= 90) return "text-emerald-400";
  if (m >= 75) return "text-amber-400";
  return "text-rose-400";
}

interface Extracted {
  rgb: RGB;
  recipe: Recipe;
  description: string;
  hint: string | null;
}

type Rect = { x: number; y: number; w: number; h: number }; // normalized 0..1

export function PaletteExtractor({
  pigments,
  onPick,
  palettes,
  activeId,
  onSelectPalette,
  onCreatePalette,
}: {
  pigments: Pigment[];
  onPick: (rgb: RGB) => void;
  palettes?: { id: string; name: string }[];
  activeId?: string;
  onSelectPalette?: (id: string) => void;
  // Create + activate a palette from an explicit pigment list (planner tubes).
  onCreatePalette?: (name: string, pigments: Pigment[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<ImageData | null>(null);
  const dragRef = useRef<{ x0: number; y0: number; cur: Rect | null } | null>(
    null
  );

  const [count, setCount] = useState<(typeof COUNTS)[number]>(8);
  const [busy, setBusy] = useState(false);
  const [palette, setPalette] = useState<RGB[]>([]);
  const [hasImage, setHasImage] = useState(false);
  const [posterize, setPosterize] = useState(false); // optional, off by default
  const [selection, setSelection] = useState<Rect | null>(null); // optional area
  // Invert the selection: extract from everything EXCEPT the dragged box —
  // e.g. draw a box over the background to exclude it. Off = old behavior.
  const [invertSel, setInvertSel] = useState(false);

  const mode = useRecipeMode();
  const engine = useMixEngine();
  const maxColors = useMaxColors();
  const valuePriority = useValuePriority();
  const goldenRatio = useGoldenRatio();
  const { lang, t } = useT();
  const { blob: storedBlob, save: saveSlot } = useActiveImage("extract.source");

  // Collect pixels from the cached base image, optionally only inside `sel` —
  // or, with invert on, only OUTSIDE it (exclude the background). Bounds are
  // clamped: float error at the right/bottom edge could push ceil() one past
  // the buffer.
  const pixelsIn = useCallback(
    (sel: Rect | null, invert = false): RGB[] => {
      const base = baseRef.current;
      if (!base) return [];
      const { width: w, height: h, data } = base;
      const inverted = invert && sel != null;
      const rx0 = sel && !inverted ? Math.max(0, Math.floor(sel.x * w)) : 0;
      const ry0 = sel && !inverted ? Math.max(0, Math.floor(sel.y * h)) : 0;
      const rx1 =
        sel && !inverted ? Math.min(w, Math.ceil((sel.x + sel.w) * w)) : w;
      const ry1 =
        sel && !inverted ? Math.min(h, Math.ceil((sel.y + sel.h) * h)) : h;
      // exclusion rect (pixel coords) when inverting
      const ex0 = inverted ? Math.max(0, Math.floor(sel!.x * w)) : 0;
      const ey0 = inverted ? Math.max(0, Math.floor(sel!.y * h)) : 0;
      const ex1 = inverted ? Math.min(w, Math.ceil((sel!.x + sel!.w) * w)) : 0;
      const ey1 = inverted ? Math.min(h, Math.ceil((sel!.y + sel!.h) * h)) : 0;
      const area = Math.max(1, (rx1 - rx0) * (ry1 - ry0));
      const step = Math.max(1, Math.round(Math.sqrt(area / 12000)));
      const out: RGB[] = [];
      for (let y = ry0; y < ry1; y += step) {
        for (let x = rx0; x < rx1; x += step) {
          if (inverted && x >= ex0 && x < ex1 && y >= ey0 && y < ey1) continue;
          const i = (y * w + x) * 4;
          if (data[i + 3] < 128) continue;
          out.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
        }
      }
      return out;
    },
    []
  );

  // k-means only (expensive) — its result doesn't depend on the recipe settings.
  const runExtract = useCallback(
    (sel: Rect | null, k: number, invert = false) => {
      setBusy(true);
      setTimeout(() => {
        setPalette(extractPalette(pixelsIn(sel, invert), k));
        setBusy(false);
      }, 30);
    },
    [pixelsIn]
  );

  // Recipes/descriptions recompute live when the palette OR the recipe settings
  // (palette tab, mode, engine, max colors, value-first) change — no re-cluster.
  const colors: Extracted[] = useMemo(
    () =>
      palette.map((rgb) => ({
        rgb,
        recipe: generateRecipe(rgb, pigments, mode, engine, {
          maxColors,
          valuePriority,
          goldenRatio,
        }),
        description: analysisSentence(rgb, lang),
        hint: relationshipHint(rgb, palette, pigments, lang),
      })),
    [palette, pigments, mode, engine, maxColors, valuePriority, goldenRatio, lang]
  );

  // Limited-palette planner: the smallest set of library tubes that can mix the
  // whole extracted palette. Computed on demand (it's heavier than a recipe).
  const candidates = useMemo(() => {
    const seen = new Set<string>();
    const out: Pigment[] = [];
    for (const { pigment } of libraryPigments()) {
      const k = pigment.name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(pigment);
    }
    return out;
  }, []);
  const [plan, setPlan] = useState<PalettePlan | null>(null);
  const [planning, setPlanning] = useState(false);
  useEffect(() => {
    setPlan(null); // a new/changed palette invalidates the plan
  }, [palette]);
  const runPlan = () => {
    setPlanning(true);
    setTimeout(() => {
      setPlan(planPalette(palette, candidates));
      setPlanning(false);
    }, 30);
  };

  const loadFile = useCallback(
    (file: Blob, persist = false) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Cap by the LONGEST side so a tall portrait photo is downscaled too
        // (width-only let e.g. 800x6000 through at full size, making the
        // posterize/extract loops needlessly heavy).
        const scale = Math.min(
          1,
          DISPLAY_MAX / Math.max(img.width, img.height)
        );
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        baseRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        setSelection(null);
        setInvertSel(false);
        setPosterize(false);
        setHasImage(true);
        runExtract(null, count);
      };
      img.src = url;
      if (persist) saveSlot(file);
    },
    [runExtract, count, saveSlot]
  );

  // Restore (or react to a cloud pull / deletion of) the stored Extract image.
  const lastLoaded = useRef<Blob | null>(null);
  useEffect(() => {
    if (storedBlob) {
      if (storedBlob !== lastLoaded.current) {
        lastLoaded.current = storedBlob;
        loadFile(storedBlob, false);
      }
    } else if (lastLoaded.current) {
      // Cleared / deleted by a sync — reset the Extract view.
      lastLoaded.current = null;
      baseRef.current = null;
      setHasImage(false);
      setPalette([]);
      setSelection(null);
      setPosterize(false);
    }
  }, [storedBlob, loadFile]);

  // Redraw the canvas: base or posterized, plus a selection/drag rectangle.
  const redraw = useCallback(
    (liveRectPx?: Rect) => {
      const canvas = canvasRef.current;
      const base = baseRef.current;
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !base || !ctx) return;

      if (posterize && palette.length) {
        const labs = palette.map((p) => rgbToLab(p));
        const out = ctx.createImageData(base.width, base.height);
        const s = base.data;
        const d = out.data;
        for (let i = 0; i < s.length; i += 4) {
          const lab = rgbToLab({ r: s[i], g: s[i + 1], b: s[i + 2] });
          let best = 0;
          let bestD = Infinity;
          for (let c = 0; c < labs.length; c++) {
            const dd = deltaE(lab, labs[c]);
            if (dd < bestD) {
              bestD = dd;
              best = c;
            }
          }
          const p = palette[best];
          d[i] = p.r;
          d[i + 1] = p.g;
          d[i + 2] = p.b;
          d[i + 3] = s[i + 3];
        }
        ctx.putImageData(out, 0, 0);
      } else {
        ctx.putImageData(base, 0, 0);
      }

      const rect =
        liveRectPx ??
        (selection
          ? {
              x: selection.x * canvas.width,
              y: selection.y * canvas.height,
              w: selection.w * canvas.width,
              h: selection.h * canvas.height,
            }
          : null);
      if (rect) {
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        ctx.setLineDash([]);
      }
    },
    [posterize, palette, selection]
  );

  useEffect(() => {
    if (hasImage) redraw();
  }, [redraw, hasImage]);

  // --- area selection (drag a box) ---
  const toCanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    };
  };

  return (
    <div className="space-y-5">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadFile(f, true);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> {t("extract.upload")}
        </Button>
        <div className="flex items-center gap-1 rounded-lg bg-secondary/60 p-1">
          {COUNTS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setCount(c);
                if (hasImage) runExtract(selection, c, invertSel);
              }}
              className={
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                (count === c
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {t("extract.colors", { n: c })}
            </button>
          ))}
        </div>
        {hasImage && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPosterize((p) => !p)}
            className={
              posterize
                ? "border-accent/40 bg-accent/15 text-accent hover:bg-accent/25"
                : undefined
            }
          >
            <Grid2x2 className="h-4 w-4" /> {t("extract.mapView")}
          </Button>
        )}
        {selection && (
          <>
            <Button
              variant={invertSel ? "accent" : "outline"}
              size="sm"
              onClick={() => {
                const next = !invertSel;
                setInvertSel(next);
                runExtract(selection, count, next);
              }}
              title={t("extract.invertHint")}
            >
              <FlipHorizontal className="h-4 w-4" /> {t("extract.invert")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelection(null);
                setInvertSel(false);
                runExtract(null, count);
              }}
            >
              <X className="h-3.5 w-3.5" /> {t("extract.wholeImage")}
            </Button>
          </>
        )}
        {busy && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("extract.extracting")}
          </span>
        )}
      </div>

      {!hasImage && !busy && (
        <p className="text-sm text-muted-foreground">{t("extract.prompt")}</p>
      )}

      <div className={hasImage ? "block space-y-2" : "hidden"}>
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair rounded-lg border border-border"
          onMouseDown={(e) => {
            const p = toCanvas(e);
            dragRef.current = { x0: p.x, y0: p.y, cur: null };
          }}
          onMouseMove={(e) => {
            const d = dragRef.current;
            if (!d) return;
            const p = toCanvas(e);
            const canvas = canvasRef.current!;
            const rx = Math.min(d.x0, p.x);
            const ry = Math.min(d.y0, p.y);
            const rw = Math.abs(p.x - d.x0);
            const rh = Math.abs(p.y - d.y0);
            d.cur = {
              x: rx / canvas.width,
              y: ry / canvas.height,
              w: rw / canvas.width,
              h: rh / canvas.height,
            };
            redraw({ x: rx, y: ry, w: rw, h: rh });
          }}
          onMouseUp={() => {
            const d = dragRef.current;
            dragRef.current = null;
            if (!d) return;
            // a real box selects an area; a tiny drag/click clears the selection
            if (d.cur && d.cur.w > 0.03 && d.cur.h > 0.03) {
              setSelection(d.cur);
              runExtract(d.cur, count, invertSel);
            } else if (selection) {
              setSelection(null);
              setInvertSel(false);
              runExtract(null, count);
            } else {
              redraw();
            }
          }}
          onMouseLeave={() => {
            if (dragRef.current) {
              dragRef.current = null;
              redraw();
            }
          }}
        />
        <p className="text-xs text-muted-foreground">{t("extract.selectHint")}</p>
      </div>

      {colors.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          {palettes && activeId && onSelectPalette ? (
            <PaletteChipSelect
              palettes={palettes}
              activeId={activeId}
              onSelect={onSelectPalette}
            />
          ) : (
            <span />
          )}
          <RecipeControls />
        </div>
      )}

      {/* Limited-palette planner */}
      {palette.length > 0 && (
        <div className="space-y-3 border-t border-border/60 pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={runPlan}
              disabled={planning}
            >
              {planning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="h-4 w-4" />
              )}
              {t("plan.button")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t("plan.hint")}
            </span>
          </div>

          {plan && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium">
                {t("plan.result", { n: plan.pigments.length })}
              </p>
              {!plan.covered && (
                <p className="text-xs text-amber-400">{t("plan.partial")}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {plan.pigments.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-xs"
                  >
                    <span
                      className="h-3 w-3 rounded-full border border-border/50"
                      style={{ backgroundColor: rgbToHex(p.rgb) }}
                    />
                    {p.name}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-border/60 pt-2">
                {plan.perTarget.map((pt, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 text-xs tabular-nums"
                    title={rgbToHex(pt.rgb)}
                  >
                    <span
                      className="h-4 w-4 rounded border border-border/50"
                      style={{ backgroundColor: rgbToHex(pt.rgb) }}
                    />
                    <span className={planMatchClass(pt.match)}>{pt.match}%</span>
                  </span>
                ))}
              </div>
              {onCreatePalette && (
                <div className="border-t border-border/60 pt-3">
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={() =>
                      onCreatePalette(t("plan.newPaletteName"), plan.pigments)
                    }
                  >
                    <FlaskConical className="h-4 w-4" /> {t("plan.use")}
                  </Button>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t("plan.useHint")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {colors.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {colors.map((c, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <Swatch
                rgb={c.rgb}
                label={`#${i + 1}`}
                sub={rgbToHex(c.rgb)}
                className={cn("h-24")}
                onClick={() => onPick(c.rgb)}
              />
              <div className="space-y-3 p-4">
                <p className="text-xs italic leading-relaxed text-muted-foreground">
                  {c.description}
                </p>
                <RecipeView recipe={c.recipe} compact />
                {c.hint && (
                  <p className="border-t border-border/60 pt-2 text-xs text-accent">
                    {c.hint}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
