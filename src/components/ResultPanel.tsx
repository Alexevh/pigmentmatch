import { useMemo } from "react";
import { rgbToHex, type RGB } from "@/lib/color";
import { generateRecipe } from "@/lib/mixer";
import { useRecipeMode } from "@/hooks/useRecipeMode";
import { useMixEngine } from "@/hooks/useMixEngine";
import { useT } from "@/lib/i18n";
import type { Pigment } from "@/lib/pigments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Swatch } from "./Swatch";
import { RecipeView } from "./RecipeView";
import { AnalysisView } from "./AnalysisView";
import { VariationsView } from "./VariationsView";

// Shared results for a target color: big swatch, mix recipe, painter analysis
// and color variations. Reused by the Match and Image tabs.
export function ResultPanel({
  rgb,
  pigments,
  onPick,
  stack = false,
}: {
  rgb: RGB;
  pigments: Pigment[];
  onPick: (rgb: RGB) => void;
  // `stack` renders everything in a single column (for the Image tab, where the
  // panel lives in a half-width column beside the photo).
  stack?: boolean;
}) {
  const { t } = useT();
  const mode = useRecipeMode();
  const engine = useMixEngine();
  const recipe = useMemo(
    () => generateRecipe(rgb, pigments, mode, engine),
    [rgb, pigments, mode, engine]
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
  const recipeCard = (
    <Card>
      <CardHeader>
        <CardTitle>{t("recipe.title")}</CardTitle>
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
        <VariationsView rgb={rgb} onPick={onPick} />
      </CardContent>
    </Card>
  );

  if (stack) {
    return (
      <div className="space-y-4">
        {swatch}
        {recipeCard}
        {variations}
        {analysis}
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
