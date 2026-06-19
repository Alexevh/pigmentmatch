import { recipePercentages, percentLabel, type Recipe } from "@/lib/mixer";
import { rgbToHex } from "@/lib/color";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { setRecipeUnit, useRecipeUnit } from "@/hooks/useRecipeUnit";
import {
  setRecipeMode,
  useRecipeMode,
  type RecipeMode,
} from "@/hooks/useRecipeMode";
import { setMixEngine, useMixEngine } from "@/hooks/useMixEngine";
import type { MixEngine } from "@/lib/mixer";
import type { RecipeItem } from "@/lib/mixer";

function matchColor(match: number): string {
  if (match >= 90) return "text-emerald-400";
  if (match >= 75) return "text-amber-400";
  return "text-rose-400";
}

const toggleBtn = (active: boolean) =>
  cn(
    "rounded px-2 py-0.5 text-xs font-medium transition-colors",
    active
      ? "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground"
  );

function UnitToggle() {
  const { t } = useT();
  const unit = useRecipeUnit();
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-secondary/60 p-0.5">
      <button onClick={() => setRecipeUnit("parts")} className={toggleBtn(unit === "parts")}>{t("recipe.partsLabel")}</button>
      <button onClick={() => setRecipeUnit("percent")} className={toggleBtn(unit === "percent")}>%</button>
    </div>
  );
}

function ModeToggle() {
  const { t } = useT();
  const mode = useRecipeMode();
  const opt = (value: RecipeMode, label: string) => (
    <button onClick={() => setRecipeMode(value)} className={toggleBtn(mode === value)}>{label}</button>
  );
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-secondary/60 p-0.5">
      {opt("simple", t("recipe.simple"))}
      {opt("precise", t("recipe.precise"))}
    </div>
  );
}

function EngineToggle() {
  const engine = useMixEngine();
  const opt = (value: MixEngine, label: string) => (
    <button onClick={() => setMixEngine(value)} className={toggleBtn(engine === value)} title="Mixing model">{label}</button>
  );
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-secondary/60 p-0.5">
      {opt("classic", "Classic")}
      {opt("spectral", "Spectral")}
    </div>
  );
}

function PigmentDot({ hex }: { hex: string }) {
  return (
    <span
      className="h-5 w-5 shrink-0 rounded-full border border-border/50"
      style={{ backgroundColor: hex }}
    />
  );
}

export function RecipeView({
  recipe,
  compact = false,
}: {
  recipe: Recipe;
  compact?: boolean;
}) {
  const { t } = useT();
  const unit = useRecipeUnit();

  if (recipe.items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("recipe.none")}</p>;
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <EngineToggle />
          <ModeToggle />
          <UnitToggle />
        </div>
      )}

      {unit === "percent" ? (
        <PercentList recipe={recipe} />
      ) : (
        <PartsList recipe={recipe} />
      )}

      {!compact ? (
        <div className="flex items-center gap-4 border-t border-border/60 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("recipe.mixed")}</span>
            <span
              className="h-6 w-6 rounded-md border border-border/50"
              style={{ backgroundColor: recipe.mixedHex }}
            />
            <span className="font-mono text-xs text-muted-foreground">
              {recipe.mixedHex}
            </span>
          </div>
          <div className="ml-auto text-right">
            <div className={cn("text-lg font-bold", matchColor(recipe.match))}>
              {recipe.match}%
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t("recipe.match")} · ΔE {recipe.deltaE.toFixed(1)}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
          <span className="text-muted-foreground">{t("recipe.match")}</span>
          <span className={cn("font-bold", matchColor(recipe.match))}>
            {recipe.match}%
          </span>
        </div>
      )}
    </div>
  );
}

function partsText(item: RecipeItem, t: (k: string) => string): string {
  return `${item.parts} ${t(item.parts === 1 ? "recipe.part" : "recipe.parts")}`;
}

function PercentList({ recipe }: { recipe: Recipe }) {
  const pcts = recipePercentages(recipe.items);
  return (
    <div className="space-y-2">
      {recipe.items.map((item, i) => (
        <div key={item.pigment.id} className="flex items-center gap-3 text-sm">
          <PigmentDot hex={rgbToHex(item.pigment.rgb)} />
          <span className="font-semibold tabular-nums w-12 shrink-0">
            {percentLabel(pcts[i])}
          </span>
          <span className="text-foreground/90">{item.pigment.name}</span>
        </div>
      ))}
    </div>
  );
}

function PartsList({ recipe }: { recipe: Recipe }) {
  const { t } = useT();
  const base = recipe.items.filter((i) => i.parts != null);
  const touches = recipe.items.filter((i) => i.parts == null);
  return (
    <>
      <div className="space-y-2">
        {base.map((item) => (
          <div key={item.pigment.id} className="flex items-center gap-3 text-sm">
            <PigmentDot hex={rgbToHex(item.pigment.rgb)} />
            <span className="font-semibold tabular-nums w-16 shrink-0">
              {partsText(item, t)}
            </span>
            <span className="text-foreground/90">{item.pigment.name}</span>
          </div>
        ))}
      </div>

      {touches.length > 0 && (
        <div className="space-y-1.5 border-t border-border/60 pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("recipe.adjustments")}
          </p>
          {touches.map((item) => (
            <div key={item.pigment.id} className="flex items-center gap-3 text-sm">
              <span
                className="h-4 w-4 shrink-0 rounded-full border border-border/50"
                style={{ backgroundColor: rgbToHex(item.pigment.rgb) }}
              />
              <span className="italic text-muted-foreground">
                {t(`recipe.${item.amount}`)} {t("recipe.of")}
              </span>
              <span className="text-foreground/90">{item.pigment.name}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
