import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { rgbToHex, analyzeColor, type RGB } from "@/lib/color";
import { extractPalette, samplePixels, relationshipHint } from "@/lib/extract";
import { generateRecipe, type Recipe } from "@/lib/mixer";
import { useRecipeMode } from "@/hooks/useRecipeMode";
import { useMixEngine } from "@/hooks/useMixEngine";
import type { Pigment } from "@/lib/pigments";
import { Button } from "@/components/ui/button";
import { Swatch } from "./Swatch";
import { RecipeView } from "./RecipeView";

const COUNTS = [8, 12, 20] as const;

interface Extracted {
  rgb: RGB;
  recipe: Recipe;
  description: string;
  hint: string | null;
}

export function PaletteExtractor({
  pigments,
  onPick,
}: {
  pigments: Pigment[];
  onPick: (rgb: RGB) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [count, setCount] = useState<(typeof COUNTS)[number]>(8);
  const [busy, setBusy] = useState(false);
  const [colors, setColors] = useState<Extracted[] | null>(null);
  const pixelsRef = useRef<RGB[] | null>(null);
  const mode = useRecipeMode();
  const engine = useMixEngine();

  const run = (pixels: RGB[], k: number) => {
    setBusy(true);
    // let the spinner paint before the heavy synchronous work
    setTimeout(() => {
      const palette = extractPalette(pixels, k);
      const rgbs = palette;
      const result: Extracted[] = palette.map((rgb) => ({
        rgb,
        recipe: generateRecipe(rgb, pigments, mode, engine),
        description: analyzeColor(rgb).sentence,
        hint: relationshipHint(rgb, rgbs, pigments),
      }));
      setColors(result);
      setBusy(false);
    }, 30);
  };

  const loadFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      pixelsRef.current = samplePixels(img);
      URL.revokeObjectURL(url);
      if (pixelsRef.current) run(pixelsRef.current, count);
    };
    img.src = url;
  };

  return (
    <div className="space-y-5">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadFile(f);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Upload a painting
        </Button>
        <div className="flex items-center gap-1 rounded-lg bg-secondary/60 p-1">
          {COUNTS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setCount(c);
                if (pixelsRef.current) run(pixelsRef.current, c);
              }}
              className={
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                (count === c
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {c} colors
            </button>
          ))}
        </div>
        {busy && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Extracting…
          </span>
        )}
      </div>

      {!colors && !busy && (
        <p className="text-sm text-muted-foreground">
          Upload a painting to extract its dominant colors, arranged from light
          to dark — each with a mixing recipe and a painter's description.
        </p>
      )}

      {colors && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {colors.map((c, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <Swatch
                rgb={c.rgb}
                label={`#${i + 1}`}
                sub={rgbToHex(c.rgb)}
                className="h-24"
                onClick={() => onPick(c.rgb)}
              />
              <div className="space-y-3 p-4">
                <p className="text-xs italic leading-relaxed text-muted-foreground">
                  {c.description}
                </p>
                <RecipeView recipe={c.recipe} compact />
                {c.hint && (
                  <p className="border-t border-border/60 pt-2 text-xs text-accent">
                    {c.hint}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
