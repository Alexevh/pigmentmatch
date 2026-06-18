import { useState } from "react";
import { Plus, Trash2, RotateCcw, Palette as PaletteIcon } from "lucide-react";
import { hexToRgb, rgbToHex } from "@/lib/color";
import {
  PALETTE_PRESETS,
  type Pigment,
  type Temperature,
} from "@/lib/pigments";
import type { usePalettes } from "@/hooks/usePalettes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

type PaletteApi = ReturnType<typeof usePalettes>;

const TEMPS: Temperature[] = ["warm", "neutral", "cool"];

function PigmentRow({
  pigment,
  onUpdate,
  onRemove,
}: {
  pigment: Pigment;
  onUpdate: (patch: Partial<Pigment>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <input
          type="color"
          value={rgbToHex(pigment.rgb)}
          onChange={(e) =>
            onUpdate({ rgb: hexToRgb(e.target.value) ?? pigment.rgb })
          }
          className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-input bg-background p-0.5"
          aria-label={`${pigment.name} color`}
        />
        <Input
          value={pigment.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="h-9 flex-1"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          className="text-muted-foreground"
        >
          {open ? "Hide" : "Edit"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="text-muted-foreground hover:text-rose-400"
          aria-label="Remove pigment"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {open && (
        <CardContent className="space-y-3 border-t border-border/60 bg-secondary/20 pt-3">
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Opacity</span>
              <span className="tabular-nums">
                {Math.round(pigment.opacity * 100)}%
              </span>
            </div>
            <Slider
              value={pigment.opacity}
              onChange={(v) => onUpdate({ opacity: v })}
            />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Tinting strength</span>
              <span className="tabular-nums">
                {Math.round(pigment.strength * 100)}%
              </span>
            </div>
            <Slider
              value={pigment.strength}
              onChange={(v) => onUpdate({ strength: v })}
            />
          </div>
          <div>
            <div className="mb-1.5 text-xs text-muted-foreground">
              Temperature
            </div>
            <div className="flex gap-1.5">
              {TEMPS.map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={pigment.temperature === t ? "accent" : "outline"}
                  onClick={() => onUpdate({ temperature: t })}
                  className="flex-1 capitalize"
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function PaletteManager({ api }: { api: PaletteApi }) {
  const {
    palettes,
    active,
    activeId,
    setActiveId,
    addPigment,
    updatePigment,
    removePigment,
    addPalette,
    addPreset,
    renameActive,
    deleteActive,
    resetActive,
  } = api;

  if (!active) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Palette
          </span>
          <select
            value={activeId}
            onChange={(e) => setActiveId(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {palettes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <Input
          value={active.name}
          onChange={(e) => renameActive(e.target.value)}
          className="h-10 max-w-[220px] flex-1"
        />
        <div className="ml-auto flex flex-wrap gap-2">
          <select
            value=""
            onChange={(e) => {
              const preset = PALETTE_PRESETS.find((p) => p.id === e.target.value);
              if (preset) addPreset(preset.make);
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            aria-label="Add palette from preset"
          >
            <option value="" disabled>
              Add preset…
            </option>
            {PALETTE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addPalette("New Palette")}
          >
            <PaletteIcon className="h-4 w-4" /> New
          </Button>
          <Button variant="outline" size="sm" onClick={resetActive}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={deleteActive}
            disabled={palettes.length <= 1}
            className="text-muted-foreground hover:text-rose-400"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {active.pigments.map((p) => (
          <PigmentRow
            key={p.id}
            pigment={p}
            onUpdate={(patch) => updatePigment(p.id, patch)}
            onRemove={() => removePigment(p.id)}
          />
        ))}
      </div>

      <Button
        variant="secondary"
        onClick={() =>
          addPigment({
            name: "New Pigment",
            rgb: { r: 128, g: 128, b: 128 },
            opacity: 0.8,
            temperature: "neutral",
            strength: 0.7,
          })
        }
        className="w-full"
      >
        <Plus className="h-4 w-4" /> Add pigment
      </Button>
    </div>
  );
}
