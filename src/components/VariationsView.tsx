import { useEffect, useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { buildVariations, type RGB, type Variation } from "@/lib/color";
import { generateRecipe } from "@/lib/mixer";
import { coach } from "@/lib/coach";
import { useRecipeMode } from "@/hooks/useRecipeMode";
import { useMixEngine } from "@/hooks/useMixEngine";
import { useMaxColors, useValuePriority } from "@/hooks/useRecipeLimits";
import { useT } from "@/lib/i18n";
import type { Pigment } from "@/lib/pigments";
import { Swatch } from "./Swatch";
import { RecipeView } from "./RecipeView";
import { Button } from "@/components/ui/button";

// Shows how to get from the base (sampled) color to a chosen variation: the
// recipe for the base mix, then the small adjustment (Coach advice) that nudges
// it toward the variation. Reuses generateRecipe + coach so it always agrees
// with the rest of the app.
function VariationRecipeModal({
  base,
  variation,
  label,
  pigments,
  paletteName,
  onClose,
}: {
  base: RGB;
  variation: Variation;
  label: string;
  pigments: Pigment[];
  paletteName?: string;
  onClose: () => void;
}) {
  const { lang, t } = useT();
  const mode = useRecipeMode();
  const engine = useMixEngine();
  const maxColors = useMaxColors();
  const valuePriority = useValuePriority();

  const baseRecipe = useMemo(
    () => generateRecipe(base, pigments, mode, engine, { maxColors, valuePriority }),
    [base, pigments, mode, engine, maxColors, valuePriority]
  );
  const advice = useMemo(
    () => coach(variation.rgb, base, pigments, lang),
    [variation.rgb, base, pigments, lang]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <h3 className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4 text-accent" />
            {t("variationRecipe.heading")}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm">
          <div className="flex items-center gap-3">
            <span
              className="h-10 w-10 rounded-md border border-border"
              style={{ backgroundColor: variation.hex }}
            />
            <div>
              <div className="font-medium">{label}</div>
              <div className="font-mono text-xs text-muted-foreground">
                {variation.hex}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("variationRecipe.baseTitle")}
              </p>
              {paletteName && (
                <span className="shrink-0 rounded-md bg-secondary/60 px-2 py-1 text-xs text-muted-foreground">
                  {t("recipe.usingPalette", { name: paletteName })}
                </span>
              )}
            </div>
            <RecipeView recipe={baseRecipe} />
          </div>

          <div className="border-t border-border/60 pt-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("variationRecipe.adjustTitle", { label })}
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
              {t("variationRecipe.fromBase")}
            </p>
            {advice.onTarget ? (
              <p className="text-muted-foreground">
                {t("variationRecipe.nothing")}
              </p>
            ) : (
              <ul className="space-y-2">
                {advice.tips.map((tip) => (
                  <li key={tip.id} className="flex items-start gap-2">
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
        </div>

        <div className="flex justify-end border-t border-border/60 px-5 py-3">
          <Button variant="accent" size="sm" onClick={onClose}>
            {t("variationRecipe.close")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function VariationsView({
  rgb,
  pigments,
  onPick,
  paletteName,
}: {
  rgb: RGB;
  pigments: Pigment[];
  onPick: (rgb: RGB) => void;
  paletteName?: string;
}) {
  const { t } = useT();
  const variations = buildVariations(rgb);
  const [open, setOpen] = useState<Variation | null>(null);

  return (
    <>
      {open && (
        <VariationRecipeModal
          base={rgb}
          variation={open}
          label={t(`variations.${open.kind}`)}
          pigments={pigments}
          paletteName={paletteName}
          onClose={() => setOpen(null)}
        />
      )}
      <div className="grid grid-cols-2 items-start gap-2 sm:grid-cols-3">
        {variations.map((v) => (
          <div key={v.kind} className="space-y-1">
            <Swatch
              rgb={v.rgb}
              label={t(`variations.${v.kind}`)}
              sub={v.hex}
              className="h-20"
              onClick={() => onPick(v.rgb)}
            />
            <button
              onClick={() => setOpen(v)}
              className="inline-flex w-full items-center justify-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              <Sparkles className="h-3 w-3" /> {t("variationRecipe.link")}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
