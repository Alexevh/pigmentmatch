import { useMemo, useState } from "react";
import { Replace } from "lucide-react";
import { rgbToHex, rgbToLab, deltaE2000, matchScore } from "@/lib/color";
import { generateRecipe } from "@/lib/mixer";
import { libraryPigments, isEnabled, type Pigment } from "@/lib/pigments";
import { useT } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { RecipeView } from "./RecipeView";

// "I ran out of this tube" helper: given a pigment of the active palette,
// (a) mix its masstone from the REMAINING enabled tubes, and (b) point at the
// closest single library tube as a shopping substitute. Pure UI over
// generateRecipe — no engine changes.
export function SubstituteFinder({ pigments }: { pigments: Pigment[] }) {
  const { t } = useT();
  const [id, setId] = useState<string>("");
  const chosen = pigments.find((p) => p.id === id) ?? null;

  const rest = useMemo(
    () => (chosen ? pigments.filter((p) => p.id !== chosen.id && isEnabled(p)) : []),
    [pigments, chosen]
  );

  const recipe = useMemo(
    () => (chosen && rest.length ? generateRecipe(chosen.rgb, rest, "simple") : null),
    [chosen, rest]
  );

  // Closest single library tube by masstone (skipping same-name tubes — that
  // would suggest buying the very tube that ran out).
  const closest = useMemo(() => {
    if (!chosen) return null;
    const target = rgbToLab(chosen.rgb);
    const strip = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, "").toLowerCase();
    let best: { pigment: Pigment; preset: string; dE: number } | null = null;
    for (const { preset, pigment } of libraryPigments()) {
      if (strip(pigment.name) === strip(chosen.name)) continue;
      const dE = deltaE2000(target, rgbToLab(pigment.rgb));
      if (!best || dE < best.dE) best = { pigment, preset, dE };
    }
    return best;
  }, [chosen]);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Replace className="h-4 w-4 text-accent" />
          <p className="text-sm font-medium">{t("palette.subTitle")}</p>
        </div>
        <p className="text-xs text-muted-foreground">{t("palette.subIntro")}</p>
        <select
          value={id}
          onChange={(e) => setId(e.target.value)}
          className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">{t("palette.subPick")}</option>
          {pigments.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {chosen && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("palette.subMix")}
              </p>
              {recipe && recipe.items.length > 0 ? (
                <>
                  <RecipeView recipe={recipe} compact />
                  {recipe.match < 80 && (
                    <p className="text-xs text-amber-400">
                      {t("palette.subMixPoor")}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("palette.subNoMix")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("palette.subBuy")}
              </p>
              {closest ? (
                <div className="flex items-center gap-2 rounded-md border border-border p-2">
                  <span
                    className="h-8 w-8 shrink-0 rounded-md border border-border/60"
                    style={{ backgroundColor: rgbToHex(closest.pigment.rgb) }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{closest.pigment.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {closest.preset} · {t("palette.subMatch", {
                        match: matchScore(closest.dE),
                      })}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
