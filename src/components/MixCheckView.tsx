import { useEffect, useMemo, useRef, useState } from "react";
import { GraduationCap } from "lucide-react";
import { rgbToHex, rgbToLab, type RGB } from "@/lib/color";
import { coach } from "@/lib/coach";
import { analysisSentence } from "@/lib/describe";
import { toLabField, renderGrayscale } from "@/lib/compare";
import { useT } from "@/lib/i18n";
import type { Pigment } from "@/lib/pigments";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageSampler } from "./ImageSampler";

// Perceptual (Lab-L) grayscale of a square crop centered on (nx, ny), so it
// shows just the region around the sampled color. Capped for speed.
const CROP_FRAC = 0.4; // window side as a fraction of the image's short side

function grayscaleCrop(
  img: HTMLImageElement,
  nx: number,
  ny: number
): ImageData {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const side = Math.max(8, Math.min(iw, ih) * CROP_FRAC);
  const sx = Math.min(Math.max(0, nx * iw - side / 2), iw - side);
  const sy = Math.min(Math.max(0, ny * ih - side / 2), ih - side);
  const out = Math.min(360, Math.round(side));
  const c = document.createElement("canvas");
  c.width = out;
  c.height = out;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
  return renderGrayscale(toLabField(ctx.getImageData(0, 0, out, out)));
}

// The grayscale value of a color as a #gggggg hex (Lab L mapped to 0..255).
function grayHex(rgb: RGB): string {
  const v = Math.max(0, Math.min(255, Math.round((rgbToLab(rgb).L / 100) * 255)));
  const h = v.toString(16).padStart(2, "0");
  return `#${h}${h}${h}`;
}

function GrayCanvas({ data, probe }: { data: ImageData; probe?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [underHex, setUnderHex] = useState<string | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = data.width;
    c.height = data.height;
    c.getContext("2d")!.putImageData(data, 0, 0);
  }, [data]);
  return (
    <div
      className="relative"
      onMouseMove={
        probe
          ? (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
              const px = Math.min(
                data.width - 1,
                Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * data.width))
              );
              const py = Math.min(
                data.height - 1,
                Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * data.height))
              );
              const v = data.data[(py * data.width + px) * 4];
              const h = v.toString(16).padStart(2, "0");
              setUnderHex(`#${h}${h}${h}`);
            }
          : undefined
      }
      onMouseLeave={() => {
        setPos(null);
        setUnderHex(null);
      }}
    >
      <canvas
        ref={ref}
        className="rounded-lg border border-border"
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          cursor: probe ? "crosshair" : undefined,
        }}
      />
      {probe && pos && underHex && (
        <span
          className="pointer-events-none absolute h-7 w-7 -translate-x-full -translate-y-1/2 rounded border-2 border-white shadow-md"
          style={{ left: pos.x - 14, top: pos.y, backgroundColor: underHex }}
        />
      )}
      {probe && pos && (
        <span
          className="pointer-events-none absolute h-7 w-7 -translate-y-1/2 rounded border-2 border-white shadow-md"
          style={{ left: pos.x + 14, top: pos.y, backgroundColor: probe }}
        />
      )}
    </div>
  );
}

function matchColor(match: number): string {
  if (match >= 90) return "text-emerald-400";
  if (match >= 75) return "text-amber-400";
  return "text-rose-400";
}

// A swatch + hex + painter description for one sampled color.
function ColorCard({ rgb, label }: { rgb: RGB; label: string }) {
  const { lang } = useT();
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span
          className="h-12 w-12 shrink-0 rounded-lg border border-border/50"
          style={{ backgroundColor: rgbToHex(rgb) }}
        />
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="font-mono text-sm">{rgbToHex(rgb)}</div>
        </div>
      </div>
      <p className="text-xs italic text-muted-foreground">
        {analysisSentence(rgb, lang)}
      </p>
    </div>
  );
}

export function MixCheckView({ pigments }: { pigments: Pigment[] }) {
  const { lang, t } = useT();
  const [target, setTarget] = useState<RGB | null>(null);
  const [mix, setMix] = useState<RGB | null>(null);
  const [refImg, setRefImg] = useState<HTMLImageElement | null>(null);
  const [mixImg, setMixImg] = useState<HTMLImageElement | null>(null);
  const [refPos, setRefPos] = useState<{ x: number; y: number } | null>(null);
  const [mixPos, setMixPos] = useState<{ x: number; y: number } | null>(null);
  const [showGray, setShowGray] = useState(false);

  const refGray = useMemo(
    () => (refImg && refPos ? grayscaleCrop(refImg, refPos.x, refPos.y) : null),
    [refImg, refPos]
  );
  const mixGray = useMemo(
    () => (mixImg && mixPos ? grayscaleCrop(mixImg, mixPos.x, mixPos.y) : null),
    [mixImg, mixPos]
  );

  const advice = target && mix ? coach(target, mix, pigments, lang) : null;
  const tL = target ? rgbToLab(target).L : 0;
  const mL = mix ? rgbToLab(mix).L : 0;
  const dL = mL - tL;
  const valueDir =
    Math.abs(dL) < 3
      ? t("mix.sameValue")
      : dL > 0
      ? t("mix.lighter")
      : t("mix.darker");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t("mix.referenceTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ImageSampler
              onSample={setTarget}
              onImage={setRefImg}
              onSamplePos={(x, y) => setRefPos({ x, y })}
              probe={mix ? rgbToHex(mix) : undefined}
            />
            {target && <ColorCard rgb={target} label={t("mix.reference")} />}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t("mix.mixTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ImageSampler
              onSample={setMix}
              onImage={setMixImg}
              onSamplePos={(x, y) => setMixPos({ x, y })}
            />
            {mix && <ColorCard rgb={mix} label={t("mix.yourMix")} />}
          </CardContent>
        </Card>
      </div>

      {/* Grayscale value view — optional, cropped to the sampled regions */}
      {target && mix && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showGray}
            onChange={(e) => setShowGray(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          {t("mix.showGrayscale")}
        </label>
      )}

      {showGray && refGray && mixGray && (
        <Card>
          <CardHeader>
            <CardTitle>{t("mix.grayscale")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("mix.reference")}
                </p>
                <GrayCanvas data={refGray} probe={mix ? grayHex(mix) : undefined} />
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("mix.yourMix")}
                </p>
                <GrayCanvas data={mixGray} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("mix.probeHint")}</p>
          </CardContent>
        </Card>
      )}

      {!target || !mix ? (
        <p className="text-sm text-muted-foreground">{t("mix.prompt")}</p>
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 normal-case tracking-normal text-foreground">
              <GraduationCap className="h-4 w-4 text-accent" />
              {t("mix.colorHeading")}
            </CardTitle>
            {advice && (
              <span className={cn("text-lg font-bold", matchColor(advice.match))}>
                {advice.match}%
              </span>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Value comparison */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("mix.valueHeading")} —{" "}
                <span className="normal-case text-foreground">
                  {valueDir} ({t("mix.deltaLabel", { n: (dL > 0 ? "+" : "") + dL.toFixed(0) })})
                </span>
              </p>
              <div className="relative h-6 rounded-md border border-border/50"
                style={{ background: "linear-gradient(to right, #000, #fff)" }}>
                <Marker l={tL} label={t("mix.reference")} accent />
                <Marker l={mL} label={t("mix.yourMix")} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>{t("analysis.dark")}</span>
                <span>{t("analysis.light")}</span>
              </div>
            </div>

            {/* Coach advice */}
            {advice && (
              <div className="space-y-2.5 border-t border-border/60 pt-4">
                <p
                  className={cn(
                    "text-sm font-medium",
                    advice.onTarget ? "text-emerald-400" : "text-foreground/90"
                  )}
                >
                  {advice.headline}
                </p>
                <ul className="space-y-2">
                  {advice.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                      {tip.swatchHex && (
                        <span
                          className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-border/50"
                          style={{ backgroundColor: tip.swatchHex }}
                        />
                      )}
                      {tip.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Marker({ l, label, accent }: { l: number; label: string; accent?: boolean }) {
  return (
    <div
      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${l}%` }}
      title={`${label} · L ${l.toFixed(0)}`}
    >
      <span
        className={cn(
          "block h-5 w-5 rounded-full border-2 shadow",
          accent ? "border-accent bg-white" : "border-white bg-accent"
        )}
      />
    </div>
  );
}
