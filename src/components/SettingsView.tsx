import { Languages, Palette as PaletteIcon, SlidersHorizontal, Cloud } from "lucide-react";
import { useT, setLang, type Lang } from "@/lib/i18n";
import { useGeminiKey, setGeminiKey } from "@/hooks/useGeminiKey";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RecipeControls } from "./RecipeView";

export function SettingsView({
  palettes,
  activeId,
  onSelectPalette,
}: {
  palettes: { id: string; name: string }[];
  activeId: string;
  onSelectPalette: (id: string) => void;
}) {
  const { lang, t } = useT();
  const geminiKey = useGeminiKey();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("settings.intro")}</p>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-accent" /> {t("settings.language")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex w-fit items-center gap-0.5 rounded-md bg-secondary/60 p-0.5">
            {(["en", "es"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={cn(
                  "rounded px-3 py-1 text-sm font-medium uppercase transition-colors",
                  lang === l
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active palette */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PaletteIcon className="h-4 w-4 text-accent" />{" "}
            {t("settings.activePalette")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={activeId}
            onChange={(e) => onSelectPalette(e.target.value)}
            className="h-10 min-w-56 rounded-md border border-input bg-background px-3 text-sm"
          >
            {palettes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Recipe defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-accent" />{" "}
            {t("settings.recipeDefaults")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {t("settings.recipeDefaultsHint")}
          </p>
          <div className="flex justify-start">
            <RecipeControls />
          </div>
        </CardContent>
      </Card>

      {/* Cloud AI key */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-accent" /> {t("settings.aiTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <label className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            {t("settings.aiKey")}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="font-normal text-accent hover:underline"
            >
              {t("settings.getKey")}
            </a>
          </label>
          <Input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder={t("imglab.cloudKeyPh")}
          />
          <p className="text-[11px] text-muted-foreground">
            {t("settings.aiKeyHint")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
