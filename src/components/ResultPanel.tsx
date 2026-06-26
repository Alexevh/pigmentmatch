import { useMemo } from "react";
import { rgbToHex, type RGB } from "@/lib/color";
import { generateRecipe } from "@/lib/mixer";
import { useRecipeMode } from "@/hooks/useRecipeMode";
import { useMixEngine } from "@/hooks/useMixEngine";
import { useMaxColors, useValuePriority } from "@/hooks/useRecipeLimits";
import { useT } from "@/lib/i18n";
import type { Pigment } from "@/lib/pigments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Swatch } from "./Swatch";
import { RecipeView } from "./RecipeView";
import { AnalysisView } from "./AnalysisView";
import { VariationsView } from "./VariationsView";
import { PaletteChipSelect } from "./PaletteChipSelect";

// Shared results for a target color: big swatch, mix recipe, painter analysis
// and color variations. Reused by the Match and Image tabs.
export function ResultPanel({
  rgb,
  pigments,
  onPick,
  stack = false,
  hideAnalysis = false,
  hideSwatch = false,
  palettes,
  activeId,
  onSelectPalette,
}: {
  rgb: RGB;
  pigments: Pigment[];
  onPick: (rgb: RGB) => void;
  // `stack` renders everything in a single column (for the Image tab, where the
  // panel lives in a half-width column beside the photo).
  stack?: boolean;
  // `hideAnalysis` omits the painter-analysis card (the Image tab shows it
  // under the photo instead).
  hideAnalysis?: boolean;
  // `hideSwatch` omits the big target swatch (the Image tab shows it above the
  // swatch-compare card instead).
  hideSwatch?: boolean;
  // Active palette + switcher, shown as a chip on the recipe so it's clear which
  // pigments the mix is drawn from (and lets the user switch palettes inline).
  palettes?: { id: string; name: string }[];
  activeId?: string;
  onSelectPalette?: (id: string) => void;
}) {
  const { t } = useT();
  const mode = useRecipeMode();
  const engine = useMixEngine();
  const maxColors = useMaxColors();
  const valuePriority = useValuePriority();
  const recipe = useMemo(
    () => generateRecipe(rgb, pigments, mode, engine, { maxColors, valuePriority }),
    [rgb, pigments, mode, engine, maxColors, valuePriority]
  );

  const swatch = (
    <Swatch
      rgb={rgb}
      label={t("match.targetColor")}
      sub={`${rgbToHex(rgb)} · rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`}
      className="h-44"
    />
  );
  const analysis = (
    <Card>
      <CardHeader>
        <CardTitle>{t("analysis.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <AnalysisView rgb={rgb} />
      </CardContent>
    </Card>
  );
  const activeName = palettes?.find((p) => p.id === activeId)?.name;
  const recipeCard = (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{t("recipe.title")}</CardTitle>
          {palettes && activeId && onSelectPalette && (
            <PaletteChipSelect
              palettes={palettes}
              activeId={activeId}
              onSelect={onSelectPalette}
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <RecipeView recipe={recipe} />
      </CardContent>
    </Card>
  );
  const variations = (
    <Card>
      <CardHeader>
        <CardTitle>{t("variations.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <VariationsView
          rgb={rgb}
          pigments={pigments}
          onPick={onPick}
          paletteName={activeName}
        />
      </CardContent>
    </Card>
  );

  if (stack) {
    return (
      <div className="space-y-4">
        {!hideSwatch && swatch}
        {recipeCard}
        {variations}
        {!hideAnalysis && analysis}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        {swatch}
        {analysis}
      </div>
      <div className="space-y-4">
        {recipeCard}
        {variations}
      </div>
    </div>
  );
}
