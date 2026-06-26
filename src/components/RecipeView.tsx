import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { recipePercentages, percentLabel, type Recipe } from "@/lib/mixer";
import { rgbToHex, valueScore } from "@/lib/color";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { setRecipeUnit, useRecipeUnit } from "@/hooks/useRecipeUnit";
import {
  setRecipeMode,
  useRecipeMode,
  type RecipeMode,
} from "@/hooks/useRecipeMode";
import { setMixEngine, useMixEngine } from "@/hooks/useMixEngine";
import {
  setMaxColors,
  useMaxColors,
  setValuePriority,
  useValuePriority,
} from "@/hooks/useRecipeLimits";
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

// Optional cap on how many pigments a recipe uses (off by default).
function MaxColorsSelect() {
  const { t } = useT();
  const max = useMaxColors();
  return (
    <select
      value={max ?? "auto"}
      onChange={(e) =>
        setMaxColors(e.target.value === "auto" ? null : parseInt(e.target.value, 10))
      }
      title={t("recipe.maxColorsTitle")}
      className="h-7 rounded-md bg-secondary/60 px-1.5 text-xs text-muted-foreground"
    >
      <option value="auto">{t("recipe.maxColorsAuto")}</option>
      <option value="2">{t("recipe.maxColorsN", { n: 2 })}</option>
      <option value="3">{t("recipe.maxColorsN", { n: 3 })}</option>
      <option value="4">{t("recipe.maxColorsN", { n: 4 })}</option>
    </select>
  );
}

// Optional: protect value (L*) over hue/chroma when simplifying (off by default).
function ValuePriorityToggle() {
  const { t } = useT();
  const on = useValuePriority();
  return (
    <button
      onClick={() => setValuePriority(!on)}
      title={t("recipe.valuePriorityTitle")}
      className={cn(
        "rounded-md px-2 py-1 text-xs font-medium transition-colors",
        on
          ? "bg-accent/15 text-accent"
          : "bg-secondary/60 text-muted-foreground hover:text-foreground"
      )}
    >
      {t("recipe.valuePriority")}
    </button>
  );
}

// Explains the three recipe toggles (mixing model, detail, units) in plain
// language so the user knows what each one changes.
function OptionsHelpModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const Section = ({
    title,
    intro,
    a,
    b,
  }: {
    title: string;
    intro: string;
    a: string;
    b: string;
  }) => (
    <div>
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground">{intro}</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
        <li>{a}</li>
        <li>{b}</li>
      </ul>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <h3 className="flex items-center gap-2 font-semibold">
            <HelpCircle className="h-4 w-4 text-accent" />
            {t("recipeHelp.title")}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm">
          <Section
            title={t("recipeHelp.modelTitle")}
            intro={t("recipeHelp.modelIntro")}
            a={t("recipeHelp.classic")}
            b={t("recipeHelp.spectral")}
          />
          <Section
            title={t("recipeHelp.modeTitle")}
            intro={t("recipeHelp.modeIntro")}
            a={t("recipeHelp.simple")}
            b={t("recipeHelp.precise")}
          />
          <Section
            title={t("recipeHelp.unitTitle")}
            intro={t("recipeHelp.unitIntro")}
            a={t("recipeHelp.parts")}
            b={t("recipeHelp.percent")}
          />
          <Section
            title={t("recipeHelp.limitTitle")}
            intro={t("recipeHelp.limitIntro")}
            a={t("recipeHelp.maxColors")}
            b={t("recipeHelp.valueFirst")}
          />
          <Section
            title={t("recipeHelp.readoutsTitle")}
            intro={t("recipeHelp.readoutsIntro")}
            a={t("recipeHelp.matchReadout")}
            b={t("recipeHelp.valueReadout")}
          />
        </div>

        <div className="flex justify-end border-t border-border/60 px-5 py-3">
          <Button variant="accent" size="sm" onClick={onClose}>
            {t("recipeHelp.close")}
          </Button>
        </div>
      </div>
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

// The full row of recipe controls (help link + all toggles). Reused by the
// recipe card and the Extract tab so settings can be changed from either place.
export function RecipeControls() {
  const { t } = useT();
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div className="flex flex-col items-end gap-1.5">
      {showHelp && <OptionsHelpModal onClose={() => setShowHelp(false)} />}
      <button
        onClick={() => setShowHelp(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
      >
        <HelpCircle className="h-3.5 w-3.5" /> {t("recipeHelp.button")}
      </button>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <EngineToggle />
        <ModeToggle />
        <UnitToggle />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <MaxColorsSelect />
        <ValuePriorityToggle />
      </div>
    </div>
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
      {!compact && <RecipeControls />}

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
          <div className="ml-auto flex items-center gap-4 text-right">
            <div>
              <div
                className={cn(
                  "text-base font-semibold",
                  matchColor(valueScore(recipe.deltaL))
                )}
              >
                {valueScore(recipe.deltaL)}%
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t("recipe.value")} · ΔL {recipe.deltaL.toFixed(1)}
              </div>
            </div>
            <div>
              <div className={cn("text-lg font-bold", matchColor(recipe.match))}>
                {recipe.match}%
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t("recipe.match")} · ΔE {recipe.deltaE.toFixed(1)}
              </div>
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
