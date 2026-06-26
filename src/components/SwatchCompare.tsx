import { useState } from "react";
import {
  rgbToLab,
  deltaE2000,
  matchScore,
  rgbToHex,
  type RGB,
} from "@/lib/color";
import { coach } from "@/lib/coach";
import { useT } from "@/lib/i18n";
import type { Pigment } from "@/lib/pigments";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageSampler } from "./ImageSampler";

function matchColor(m: number): string {
  if (m >= 90) return "text-emerald-400";
  if (m >= 75) return "text-amber-400";
  return "text-rose-400";
}

// Inline "did my swatch match?" — upload a photo of your painted swatch, click
// it, and see how it compares to the current target color (match %, value ΔL,
// and Coach advice to close the gap). Reuses ImageSampler + coach().
export function SwatchCompare({
  target,
  pigments,
}: {
  target: RGB;
  pigments: Pigment[];
}) {
  const { lang, t } = useT();
  const [swatch, setSwatch] = useState<RGB | null>(null);

  const dE = swatch ? deltaE2000(rgbToLab(target), rgbToLab(swatch)) : 0;
  const match = matchScore(dE);
  const dL = swatch ? rgbToLab(target).L - rgbToLab(swatch).L : 0; // + → yours darker
  const advice = swatch ? coach(target, swatch, pigments, lang) : null;

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>{t("image.compareTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t("image.compareHint")}</p>
        <ImageSampler onSample={setSwatch} probe={rgbToHex(target)} />

        {swatch && (
          <div className="space-y-3 border-t border-border/60 pt-3">
            <div className="flex items-center gap-3">
              {[
                { rgb: target, label: t("match.targetColor") },
                { rgb: swatch, label: t("mix.yourMix") },
              ].map((c, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span
                    className="h-10 w-10 rounded-md border border-border"
                    style={{ backgroundColor: rgbToHex(c.rgb) }}
                  />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {c.label}
                  </span>
                </div>
              ))}
              <div className="ml-auto text-right">
                <div className={cn("text-lg font-bold", matchColor(match))}>
                  {match}%
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {t("recipe.match")} · ΔE {dE.toFixed(1)}
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {Math.abs(dL) < 2
                ? t("mix.sameValue")
                : dL > 0
                ? t("mix.darker")
                : t("mix.lighter")}{" "}
              · {t("mix.deltaLabel", { n: Math.abs(dL).toFixed(1) })}
            </p>

            {advice && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("image.compareHowTo")}
                </p>
                <p className="text-sm font-medium">{advice.headline}</p>
                {!advice.onTarget && (
                  <ul className="space-y-1.5">
                    {advice.tips.map((tip) => (
                      <li
                        key={tip.id}
                        className="flex items-start gap-2 text-sm"
                      >
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
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
