import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { rgbToHex, rgbToLab, type RGB } from "@/lib/color";
import { coach } from "@/lib/coach";
import { analysisSentence } from "@/lib/describe";
import { useT } from "@/lib/i18n";
import type { Pigment } from "@/lib/pigments";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageSampler } from "./ImageSampler";

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
            <ImageSampler onSample={setTarget} />
            {target && <ColorCard rgb={target} label={t("mix.reference")} />}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t("mix.mixTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ImageSampler onSample={setMix} />
            {mix && <ColorCard rgb={mix} label={t("mix.yourMix")} />}
          </CardContent>
        </Card>
      </div>

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
