import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, Camera, RefreshCw, Repeat } from "lucide-react";
import { rgbToHex, labToRgb, type RGB } from "@/lib/color";
import {
  buildSceneProfile,
  analyzeZone,
  sceneAdvice,
  type SceneProfile,
} from "@/lib/scene";
import { generateRecipe } from "@/lib/mixer";
import { useRecipeMode } from "@/hooks/useRecipeMode";
import { useMixEngine } from "@/hooks/useMixEngine";
import {
  useMaxColors,
  useValuePriority,
  useGoldenRatio,
} from "@/hooks/useRecipeLimits";
import { useActiveImage } from "@/hooks/useActiveImage";
import { useT } from "@/lib/i18n";
import type { Pigment } from "@/lib/pigments";
import { Button } from "@/components/ui/button";
import { CameraCapture } from "@/components/CameraCapture";
import { RecipeView } from "./RecipeView";

const DISPLAY_MAX = 760;
type Rect = { x: number; y: number; w: number; h: number }; // normalized 0..1

export function SceneView({ pigments }: { pigments: Pigment[] }) {
  const { lang, t } = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<ImageData | null>(null);
  const dragRef = useRef<{ x0: number; y0: number; cur: Rect | null } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastLoaded = useRef<Blob | null>(null);

  const [hasImage, setHasImage] = useState(false);
  const [showCam, setShowCam] = useState(false);
  const [profile, setProfile] = useState<SceneProfile | null>(null);
  const [selection, setSelection] = useState<Rect | null>(null);
  const [flip, setFlip] = useState(false);

  const { blob: storedBlob, save: saveSlot } = useActiveImage("scene.reference");

  const mode = useRecipeMode();
  const engine = useMixEngine();
  const maxColors = useMaxColors();
  const valuePriority = useValuePriority();
  const goldenRatio = useGoldenRatio();

  // Collect pixels from the cached base image, optionally only inside `sel`.
  const pixelsIn = useCallback((sel: Rect | null, target: number): RGB[] => {
    const base = baseRef.current;
    if (!base) return [];
    const { width: w, height: h, data } = base;
    // Clamp: float error can make (sel.x + sel.w) exceed 1 by an epsilon at the
    // right/bottom edge, and ceil would then read one row/column past the
    // buffer (undefined channels → NaN poisons the zone mean).
    const rx0 = sel ? Math.max(0, Math.floor(sel.x * w)) : 0;
    const ry0 = sel ? Math.max(0, Math.floor(sel.y * h)) : 0;
    const rx1 = sel ? Math.min(w, Math.ceil((sel.x + sel.w) * w)) : w;
    const ry1 = sel ? Math.min(h, Math.ceil((sel.y + sel.h) * h)) : h;
    const area = Math.max(1, (rx1 - rx0) * (ry1 - ry0));
    const step = Math.max(1, Math.round(Math.sqrt(area / target)));
    const out: RGB[] = [];
    for (let y = ry0; y < ry1; y += step) {
      for (let x = rx0; x < rx1; x += step) {
        const i = (y * w + x) * 4;
        if (data[i + 3] < 128) continue;
        out.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
      }
    }
    return out;
  }, []);

  const redraw = useCallback((liveRectPx?: Rect) => {
    const canvas = canvasRef.current;
    const base = baseRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !base || !ctx) return;
    ctx.putImageData(base, 0, 0);
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
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.setLineDash([]);
    }
  }, [selection]);

  useEffect(() => {
    if (hasImage) redraw();
  }, [redraw, hasImage]);

  const loadFile = useCallback(
    (file: Blob, persist = false) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const scale = Math.min(1, DISPLAY_MAX / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        baseRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        setProfile(buildSceneProfile(pixelsIn(null, 12000)));
        // default zone: a centered ~30% box
        setSelection({ x: 0.35, y: 0.35, w: 0.3, h: 0.3 });
        setHasImage(true);
      };
      img.src = url;
      if (persist) saveSlot(file);
    },
    [pixelsIn, saveSlot]
  );

  // restore / react to a stored (or cloud-pulled) scene image
  useEffect(() => {
    if (storedBlob) {
      if (storedBlob !== lastLoaded.current) {
        lastLoaded.current = storedBlob;
        loadFile(storedBlob, false);
      }
    } else if (lastLoaded.current) {
      lastLoaded.current = null;
      baseRef.current = null;
      setHasImage(false);
      setProfile(null);
      setSelection(null);
    }
  }, [storedBlob, loadFile]);

  const toCanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    };
  };

  // Effective profile honoring the "flip light" override. The override says
  // "my READ of the light is the opposite" — so it inverts only the polarity
  // (the interpretation). lightTemp/shadowTemp/lightLab/shadowLab stay as
  // measured: they're facts of the image, and sceneAdvice compares the zone
  // against its own family's measured mean; swapping them would compare a
  // shadow against the light family's temperature and produce large spurious
  // adjustments (and swatches inconsistent with the labels).
  const effProfile = useMemo<SceneProfile | null>(() => {
    if (!profile) return null;
    if (!flip) return profile;
    return {
      ...profile,
      polarity:
        profile.polarity === "warm-light"
          ? "cool-light"
          : profile.polarity === "cool-light"
          ? "warm-light"
          : "flat",
    };
  }, [profile, flip]);

  const zone = useMemo(
    () =>
      effProfile && selection && hasImage
        ? analyzeZone(pixelsIn(selection, 4000), effProfile)
        : null,
    [effProfile, selection, hasImage, pixelsIn]
  );
  const advice = useMemo(
    () => (zone && effProfile ? sceneAdvice(zone, effProfile, pigments, lang) : null),
    [zone, effProfile, pigments, lang]
  );
  const opts = { maxColors, valuePriority, goldenRatio };
  const measuredRecipe = useMemo(
    () => (zone ? generateRecipe(zone.mean, pigments, mode, engine, opts) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zone, pigments, mode, engine, maxColors, valuePriority, goldenRatio]
  );
  const adjustedRecipe = useMemo(
    () =>
      advice ? generateRecipe(advice.adjustedRgb, pigments, mode, engine, opts) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [advice, pigments, mode, engine, maxColors, valuePriority, goldenRatio]
  );

  const Swatch = ({ rgb, label }: { rgb: RGB; label: string }) => (
    <div className="flex items-center gap-2">
      <span
        className="h-8 w-8 shrink-0 rounded-md border border-border/50"
        style={{ backgroundColor: rgbToHex(rgb) }}
      />
      <div className="text-xs">
        <div className="uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-mono text-muted-foreground">{rgbToHex(rgb)}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {showCam && (
        <CameraCapture
          onCapture={(b) => loadFile(b, true)}
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
          if (f) loadFile(f, true);
          e.target.value = "";
        }}
      />

      <p className="text-sm text-muted-foreground">{t("scene.intro")}</p>

      {!hasImage && (
        <div className="space-y-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-56 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
          >
            <Upload className="h-8 w-8" />
            <span className="text-sm font-medium">{t("scene.upload")}</span>
            <span className="text-xs">{t("scene.uploadHint")}</span>
          </button>
          <Button variant="outline" size="sm" className="w-full" onClick={() => setShowCam(true)}>
            <Camera className="h-4 w-4" /> {t("camera.use")}
          </Button>
        </div>
      )}

      <div className={hasImage ? "grid gap-4 lg:grid-cols-2" : "hidden"}>
        <div className="space-y-2">
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
              const rx = Math.min(d.x0, p.x), ry = Math.min(d.y0, p.y);
              const rw = Math.abs(p.x - d.x0), rh = Math.abs(p.y - d.y0);
              d.cur = { x: rx / canvas.width, y: ry / canvas.height, w: rw / canvas.width, h: rh / canvas.height };
              redraw({ x: rx, y: ry, w: rw, h: rh });
            }}
            onMouseUp={() => {
              const d = dragRef.current;
              dragRef.current = null;
              if (d?.cur && d.cur.w > 0.02 && d.cur.h > 0.02) setSelection(d.cur);
              else redraw();
            }}
            onMouseLeave={() => {
              if (dragRef.current) {
                dragRef.current = null;
                redraw();
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> {t("image.replace")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCam(true)}>
              <Camera className="h-4 w-4" /> {t("camera.use")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("scene.selectHint")}</p>
        </div>

        <div className="space-y-4">
          {/* Scene profile */}
          {effProfile && (
            <div className="space-y-2 rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium">{t("scene.profileTitle")}</p>
              <div className="flex flex-wrap gap-4">
                <Swatch rgb={labSwatch(effProfile, "light")} label={t("scene.light")} />
                <Swatch rgb={labSwatch(effProfile, "shadow")} label={t("scene.shadow")} />
              </div>
              <p className="text-sm text-accent">
                {t(`scene.pol_${effProfile.polarity.replace("-", "")}`)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("scene.key")}: {t(`scene.key${cap(effProfile.key)}`)}
              </p>
              <button
                onClick={() => setFlip((f) => !f)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
              >
                <Repeat className="h-3.5 w-3.5" /> {t("scene.override")}
              </button>
              <p className="text-[11px] text-muted-foreground">{t("scene.overrideHint")}</p>
            </div>
          )}

          {/* Zone + advice */}
          {zone && advice ? (
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t("scene.zoneTitle")}</p>
                <span
                  className="h-8 w-8 rounded-md border border-border/50"
                  style={{ backgroundColor: rgbToHex(zone.mean) }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("scene.zoneFamily")}: <span className="text-foreground">{t(`scene.fam_${zone.family}`)}</span>
                {" · "}
                {zone.chromaRel > 6
                  ? t("scene.zoneChromaHi")
                  : zone.chromaRel < -6
                  ? t("scene.zoneChromaLo")
                  : t("scene.zoneChromaEq")}
              </p>

              <div className="border-t border-border/60 pt-2">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <RefreshCw className="h-3.5 w-3.5 text-accent" /> {t("scene.adviceTitle")}
                </p>
                <p className="mt-1 text-sm">{advice.headline}</p>
                <ul className="mt-1.5 space-y-1.5">
                  {advice.tips.map((tip) => (
                    <li key={tip.id} className="flex items-start gap-2 text-sm text-foreground/90">
                      {tip.swatchHex ? (
                        <span
                          className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-border/50"
                          style={{ backgroundColor: tip.swatchHex }}
                        />
                      ) : (
                        <span className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <span>{tip.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-3 border-t border-border/60 pt-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("scene.measured")}
                  </p>
                  {measuredRecipe && <RecipeView recipe={measuredRecipe} compact />}
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("scene.adjusted")}
                  </p>
                  {adjustedRecipe && <RecipeView recipe={adjustedRecipe} compact />}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("scene.dragToStart")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// The mean light/shadow color as an RGB swatch (from the Lab means).
function labSwatch(p: SceneProfile, which: "light" | "shadow"): RGB {
  return labToRgb(which === "light" ? p.lightLab : p.shadowLab);
}
