import { useMemo } from "react";
import { rgbToHex, type RGB } from "@/lib/color";
import { generateRecipe } from "@/lib/mixer";
import { useRecipeMode } from "@/hooks/useRecipeMode";
import { useMixEngine } from "@/hooks/useMixEngine";
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
}: {
  rgb: RGB;
  pigments: Pigment[];
  onPick: (rgb: RGB) => void;
}) {
  const mode = useRecipeMode();
  const engine = useMixEngine();
  const recipe = useMemo(
    () => generateRecipe(rgb, pigments, mode, engine),
    [rgb, pigments, mode, engine]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Swatch
          rgb={rgb}
          label="Target color"
          sub={`${rgbToHex(rgb)} · rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`}
          className="h-44"
        />
        <Card>
          <CardHeader>
            <CardTitle>Painter analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <AnalysisView rgb={rgb} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Mixing recipe</CardTitle>
          </CardHeader>
          <CardContent>
            <RecipeView recipe={recipe} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Variations</CardTitle>
          </CardHeader>
          <CardContent>
            <VariationsView rgb={rgb} onPick={onPick} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
