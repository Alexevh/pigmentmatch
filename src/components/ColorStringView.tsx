import { useMemo, useState } from "react";
import { buildColorString } from "@/lib/strings";
import { rgbToHex, isLight, type RGB } from "@/lib/color";
import type { Pigment } from "@/lib/pigments";
import { useRecipeMode } from "@/hooks/useRecipeMode";
import { useMixEngine } from "@/hooks/useMixEngine";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// The light→shadow value string for the target's base mix: what a painter
// premixes before a session. Each step is a real prediction of base mix +
// added white / darkener, so the strip shows the honest drift of the tints
// and shadows with THIS palette.
export function ColorStringView({
  rgb,
  pigments,
}: {
  rgb: RGB;
  pigments: Pigment[];
}) {
  const { t } = useT();
  const mode = useRecipeMode();
  const engine = useMixEngine();
  const cs = useMemo(
    () => buildColorString(rgb, pigments, mode, engine),
    [rgb, pigments, mode, engine]
  );
  const [sel, setSel] = useState<number | null>(null);

  if (!cs || cs.steps.length < 2) {
    return <p className="text-sm text-muted-foreground">{t("strings.none")}</p>;
  }
  const selected = sel != null ? cs.steps[sel] : null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("strings.intro")}</p>
      <div className="flex overflow-hidden rounded-lg border border-border">
        {cs.steps.map((s, i) => (
          <button
            key={i}
            onClick={() => setSel(sel === i ? null : i)}
            className={cn(
              "group relative h-16 flex-1 transition-transform hover:z-10 hover:scale-105",
              sel === i && "z-10 ring-2 ring-accent"
            )}
            style={{ backgroundColor: s.hex }}
            title={s.hex}
          >
            <span
              className={cn(
                "absolute bottom-1 left-0 right-0 text-center text-[10px] font-medium tabular-nums",
                isLight(s.rgb) ? "text-black/60" : "text-white/70"
              )}
            >
              {Math.round(s.L)}
            </span>
            {i === cs.baseIndex && (
              <span
                className={cn(
                  "absolute left-1/2 top-1 h-1.5 w-1.5 -translate-x-1/2 rounded-full",
                  isLight(s.rgb) ? "bg-black/60" : "bg-white/80"
                )}
                title={t("strings.baseDot")}
              />
            )}
          </button>
        ))}
      </div>

      {selected && (
        <div className="space-y-2 rounded-md border border-border bg-secondary/20 p-3 text-sm">
          <p>
            {selected.add
              ? t("strings.addStep", {
                  percent: selected.add.percent,
                  name: selected.add.pigment.name,
                })
              : t("strings.baseStep")}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {cs.pigments
              .map((p, i) => ({ p, w: selected.weights[i] ?? 0 }))
              .filter((x) => x.w > 0.005)
              .sort((a, b) => b.w - a.w)
              .map(({ p, w }) => (
                <span key={p.id} className="flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 rounded-full border border-border/60"
                    style={{ backgroundColor: rgbToHex(p.rgb) }}
                  />
                  {p.name} · {Math.round(w * 100)}%
                </span>
              ))}
          </div>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">{t("strings.tip")}</p>
    </div>
  );
}
