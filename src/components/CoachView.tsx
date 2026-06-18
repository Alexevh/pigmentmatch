import { useState } from "react";
import {
  ArrowUpDown,
  Droplets,
  Thermometer,
  Check,
  GraduationCap,
} from "lucide-react";
import { rgbToHex, type RGB } from "@/lib/color";
import { coach, type TipKind } from "@/lib/coach";
import type { Pigment } from "@/lib/pigments";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColorInput } from "./ColorInput";
import { ImageSampler } from "./ImageSampler";
import { Button } from "@/components/ui/button";

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
  // The current mixture on the painter's palette — starts as a neutral grey.
  const [current, setCurrent] = useState<RGB>({ r: 170, g: 170, b: 165 });
  const [sampling, setSampling] = useState(false);

  const result = coach(target, current, pigments);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Target color</CardTitle>
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
            <CardTitle>Your current mix</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSampling((s) => !s)}
              className="text-xs text-muted-foreground"
            >
              {sampling ? "Enter manually" : "Sample from photo"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className="h-16 w-full rounded-lg border border-border/40"
              style={{ backgroundColor: rgbToHex(current) }}
            />
            {sampling ? (
              <ImageSampler onSample={setCurrent} />
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
            Coach
          </CardTitle>
          <div className="text-right">
            <div className={cn("text-lg font-bold", matchColor(result.match))}>
              {result.match}%
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              match · ΔE {result.deltaE.toFixed(1)}
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

          <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
            Add color in tiny steps and re-sample — chasing a target is always a
            few small corrections, not one big one.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
