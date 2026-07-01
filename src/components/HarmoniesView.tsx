import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  buildHarmonies,
  type RGB,
  type Harmony,
  type HarmonyKind,
} from "@/lib/color";
import { generateRecipe } from "@/lib/mixer";
import { useRecipeMode } from "@/hooks/useRecipeMode";
import { useMixEngine } from "@/hooks/useMixEngine";
import {
  useMaxColors,
  useValuePriority,
  useGoldenRatio,
} from "@/hooks/useRecipeLimits";
import { useT } from "@/lib/i18n";
import type { Pigment } from "@/lib/pigments";
import { Swatch } from "./Swatch";
import { RecipeView } from "./RecipeView";
import { Button } from "@/components/ui/button";

// The recipe to mix one harmony color, in a modal (honors the active recipe
// settings so it agrees with the rest of the app).
function HarmonyRecipeModal({
  color,
  label,
  pigments,
  onClose,
}: {
  color: Harmony;
  label: string;
  pigments: Pigment[];
  onClose: () => void;
}) {
  const mode = useRecipeMode();
  const engine = useMixEngine();
  const maxColors = useMaxColors();
  const valuePriority = useValuePriority();
  const goldenRatio = useGoldenRatio();
  const recipe = useMemo(
    () =>
      generateRecipe(color.rgb, pigments, mode, engine, {
        maxColors,
        valuePriority,
        goldenRatio,
      }),
    [color.rgb, pigments, mode, engine, maxColors, valuePriority, goldenRatio]
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
          <h3 className="font-semibold">{label}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <Swatch rgb={color.rgb} label={label} sub={color.hex} className="h-24" />
          <RecipeView recipe={recipe} compact />
        </div>
      </div>
    </div>
  );
}

// Color-wheel harmonies for a base color: complement, analogous, triads. Click a
// swatch to make it the new target; "How to mix it" shows its recipe.
export function HarmoniesView({
  rgb,
  pigments,
  onPick,
}: {
  rgb: RGB;
  pigments: Pigment[];
  onPick: (rgb: RGB) => void;
}) {
  const { t } = useT();
  const [openKind, setOpenKind] = useState<HarmonyKind | null>(null);
  const harmonies = useMemo(() => buildHarmonies(rgb), [rgb]);
  const active = harmonies.find((h) => h.kind === openKind) ?? null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {harmonies.map((h) => (
          <div key={h.kind} className="space-y-1.5">
            <Swatch
              rgb={h.rgb}
              label={t(`harmony.${h.kind}`)}
              sub={h.hex}
              className="h-20"
              onClick={() => onPick(h.rgb)}
            />
            <button
              onClick={() => setOpenKind(h.kind)}
              className="text-xs font-medium text-accent hover:underline"
            >
              {t("variationRecipe.link")}
            </button>
          </div>
        ))}
      </div>
      {active && (
        <HarmonyRecipeModal
          color={active}
          label={t(`harmony.${active.kind}`)}
          pigments={pigments}
          onClose={() => setOpenKind(null)}
        />
      )}
    </>
  );
}
