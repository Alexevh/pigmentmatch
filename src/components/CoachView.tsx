import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Droplets,
  Thermometer,
  Check,
  GraduationCap,
  Beaker,
} from "lucide-react";
import { rgbToHex, matchScore, type RGB } from "@/lib/color";
import { coach, quantifyAdjustment, type TipKind } from "@/lib/coach";
import { useT } from "@/lib/i18n";
import { useCoachUnit, setCoachUnit, COACH_UNITS } from "@/hooks/useCoachUnit";
import type { Pigment } from "@/lib/pigments";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColorInput } from "./ColorInput";
import { ImageSampler } from "./ImageSampler";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TIP_ICON: Record<TipKind, typeof Droplets> = {
  value: ArrowUpDown,
  saturation: Droplets,
  hue: Thermometer,
  done: Check,
};

function matchColor(match: number): string {
  if (match >= 90) return "text-emerald-400";
  if (match >= 75) return "text-amber-400";
  return "text-rose-400";
}

export function CoachView({
  target,
  onTargetChange,
  pigments,
}: {
  target: RGB;
  onTargetChange: (rgb: RGB) => void;
  pigments: Pigment[];
}) {
  const { lang, t } = useT();
  // The current mixture on the painter's palette — starts as a neutral grey.
  const [current, setCurrent] = useState<RGB>({ r: 170, g: 170, b: 165 });
  const [sampling, setSampling] = useState(false);
  // How to express the addition (unit-free ratio, or a quantity in the unit the
  // painter thinks their puddle is in) + the puddle size for the quantity units.
  const unit = useCoachUnit();
  const [batch, setBatch] = useState(20);

  const result = coach(target, current, pigments, lang);
  const quant = useMemo(
    () => quantifyAdjustment(target, current, pigments),
    [target, current, pigments]
  );
  // Adding to an EXISTING puddle: if the final mix is fraction f new pigment,
  // the added quantity is batch · f / (1 − f) in whatever unit `batch` is; the
  // ratio form is puddle : added = (1 − f) : f, i.e. "1 part per N of puddle".
  const f = quant?.fraction ?? 0;
  const addQty = quant ? (batch * f) / (1 - f) : 0;
  const perPart = quant && f > 0 ? (1 - f) / f : 0; // parts of puddle per 1 part added

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("coach.target")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className="h-16 w-full rounded-lg border border-border/40"
              style={{ backgroundColor: rgbToHex(target) }}
            />
            <ColorInput rgb={target} onChange={onTargetChange} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("coach.yourMix")}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSampling((s) => !s)}
              className="text-xs text-muted-foreground"
            >
              {sampling ? t("coach.enterManually") : t("coach.sampleFromPhoto")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className="h-16 w-full rounded-lg border border-border/40"
              style={{ backgroundColor: rgbToHex(current) }}
            />
            {sampling ? (
              <ImageSampler onSample={setCurrent} slot="coach.sample" />
            ) : (
              <ColorInput rgb={current} onChange={setCurrent} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 normal-case tracking-normal text-foreground">
            <GraduationCap className="h-4 w-4 text-accent" />
            {t("coach.title")}
          </CardTitle>
          <div className="text-right">
            <div className={cn("text-lg font-bold", matchColor(result.match))}>
              {result.match}%
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t("recipe.match")} · ΔE {result.deltaE.toFixed(1)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p
            className={cn(
              "text-sm font-medium",
              result.onTarget ? "text-emerald-400" : "text-foreground/90"
            )}
          >
            {result.headline}
          </p>

          <ol className="space-y-2.5">
            {result.tips.map((tip, i) => {
              const Icon = TIP_ICON[tip.id];
              return (
                <li
                  key={tip.id + i}
                  className="flex items-start gap-3 rounded-lg border border-border/50 bg-secondary/20 p-3"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-accent">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm leading-relaxed text-foreground/90">
                    {tip.text}
                  </span>
                  {tip.swatchHex && (
                    <span
                      className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-border/50"
                      style={{ backgroundColor: tip.swatchHex }}
                    />
                  )}
                </li>
              );
            })}
          </ol>

          {quant && (
            <div className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-medium text-accent">
                  <Beaker className="h-4 w-4 shrink-0" /> {t("coach.quantTitle")}
                </p>
                <div className="flex items-center gap-1 rounded-lg bg-secondary/60 p-0.5">
                  {COACH_UNITS.map((u) => (
                    <button
                      key={u}
                      onClick={() => setCoachUnit(u)}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                        unit === u
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t(`coach.unit_${u}`)}
                    </button>
                  ))}
                </div>
              </div>

              {unit === "parts" ? (
                <p className="text-sm leading-relaxed text-foreground/90">
                  {t("coach.quantRatio", {
                    name: quant.pigment.name,
                    n: perPart < 10 ? perPart.toFixed(1) : Math.round(perPart),
                  })}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>{t("coach.quantBatch")}</span>
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      value={batch}
                      onChange={(e) =>
                        setBatch(
                          Math.max(1, Math.min(1000, Number(e.target.value) || 1))
                        )
                      }
                      className="h-8 w-20 text-center"
                    />
                    <span>{t(`coach.unit_${unit}`)}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {t("coach.quantAdvice", {
                      amount: addQty < 0.1 ? "<0.1" : addQty.toFixed(1),
                      unit: t(`coach.unit_${unit}`),
                      name: quant.pigment.name,
                      percent: Math.round(f * 100),
                      batch,
                    })}
                  </p>
                </>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className="h-5 w-5 rounded border border-border/60"
                  style={{ backgroundColor: rgbToHex(quant.predicted) }}
                />
                {t("coach.quantResult", {
                  match: matchScore(quant.after),
                  before: matchScore(quant.before),
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("coach.quantNote")}
              </p>
            </div>
          )}

          <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
            {t("coach.footer")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
