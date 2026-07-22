import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { rgbToHex, type RGB } from "@/lib/color";
import { generateRecipe, suggestPigment } from "@/lib/mixer";
import { libraryPigments } from "@/lib/pigments";
import { useRecipeMode } from "@/hooks/useRecipeMode";
import { useMixEngine } from "@/hooks/useMixEngine";
import {
  useMaxColors,
  useValuePriority,
  useGoldenRatio,
} from "@/hooks/useRecipeLimits";
import { useRequiredTubes } from "@/hooks/useRequiredTubes";
import { useT } from "@/lib/i18n";
import type { Pigment } from "@/lib/pigments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Swatch } from "./Swatch";
import { RecipeView } from "./RecipeView";
import { AnalysisView } from "./AnalysisView";
import { VariationsView } from "./VariationsView";
import { HarmoniesView } from "./HarmoniesView";
import { ColorStringView } from "./ColorStringView";
import { GamutMap } from "./GamutMap";
import { RequiredTubesPicker } from "./RequiredTubesPicker";
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
  const goldenRatio = useGoldenRatio();
  const [showGamut, setShowGamut] = useState(false);
  // Must-use tubes (opt-in): only ids present in the current pigments count.
  const requiredTubes = useRequiredTubes();
  const requiredIds = useMemo(
    () => requiredTubes.filter((id) => pigments.some((p) => p.id === id)),
    [requiredTubes, pigments]
  );
  const recipe = useMemo(
    () =>
      generateRecipe(rgb, pigments, mode, engine, {
        maxColors,
        valuePriority,
        goldenRatio,
        requiredIds,
      }),
    [rgb, pigments, mode, engine, maxColors, valuePriority, goldenRatio, requiredIds]
  );

  // When the match is poor, the palette probably can't reach this color. Offer
  // the single library pigment that would close the gap most. Deduped by name.
  const REACH_THRESHOLD = 90;
  const candidates = useMemo(() => {
    const seen = new Set<string>();
    const out: Pigment[] = [];
    for (const { pigment } of libraryPigments()) {
      const key = pigment.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(pigment);
    }
    return out;
  }, []);
  const suggestion = useMemo(
    () =>
      recipe.match >= REACH_THRESHOLD
        ? null
        : suggestPigment(rgb, pigments, candidates, recipe.deltaE),
    [rgb, pigments, candidates, recipe.match, recipe.deltaE]
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
      <CardContent className="space-y-3">
        {/* Optional must-use tubes: dropdown + removable pills; the engine is
            forced to keep each selected tube at a meaningful share. */}
        <RequiredTubesPicker pigments={pigments} />
        <RecipeView recipe={recipe} target={rgb} paletteName={activeName} />
        {recipe.match < REACH_THRESHOLD && (
          <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              <div className="flex-1">
                <p>{t("reach.warn")}</p>
                {suggestion ? (
                  <p className="mt-0.5">
                    {t("reach.suggest", {
                      name: suggestion.pigment.name,
                      match: suggestion.match,
                    })}
                  </p>
                ) : (
                  <p className="mt-0.5">{t("reach.noSuggest")}</p>
                )}
                <button
                  onClick={() => setShowGamut((v) => !v)}
                  className="mt-1 text-amber-400 hover:underline"
                >
                  {showGamut ? t("gamut.hide") : t("gamut.show")}
                </button>
              </div>
            </div>
            {showGamut && (
              <GamutMap
                pigments={pigments}
                target={rgb}
                suggestion={suggestion?.pigment ?? null}
              />
            )}
          </div>
        )}
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
  const harmonies = (
    <Card>
      <CardHeader>
        <CardTitle>{t("harmony.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <HarmoniesView rgb={rgb} pigments={pigments} onPick={onPick} />
      </CardContent>
    </Card>
  );

  const strings = (
    <Card>
      <CardHeader>
        <CardTitle>{t("strings.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ColorStringView rgb={rgb} pigments={pigments} />
      </CardContent>
    </Card>
  );

  if (stack) {
    return (
      <div className="space-y-4">
        {!hideSwatch && swatch}
        {recipeCard}
        {strings}
        {variations}
        {harmonies}
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
        {strings}
        {variations}
        {harmonies}
      </div>
    </div>
  );
}
