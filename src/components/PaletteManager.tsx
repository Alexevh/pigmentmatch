import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  RotateCcw,
  Palette as PaletteIcon,
  Library,
} from "lucide-react";
import { hexToRgb, rgbToHex } from "@/lib/color";
import {
  PALETTE_PRESETS,
  isEnabled,
  libraryPigments,
  type Pigment,
  type Temperature,
} from "@/lib/pigments";
import type { usePalettes } from "@/hooks/usePalettes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

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
  const available = isEnabled(pigment);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <input
          type="checkbox"
          checked={available}
          onChange={(e) => onUpdate({ enabled: e.target.checked })}
          className="h-4 w-4 shrink-0 cursor-pointer accent-accent"
          title={
            available
              ? "Available — used in mix suggestions"
              : "Unavailable — ignored in mix suggestions"
          }
          aria-label={`${pigment.name} available for mixing`}
        />
        <input
          type="color"
          value={rgbToHex(pigment.rgb)}
          onChange={(e) =>
            onUpdate({ rgb: hexToRgb(e.target.value) ?? pigment.rgb })
          }
          className={cn(
            "h-9 w-9 shrink-0 cursor-pointer rounded-md border border-input bg-background p-0.5",
            !available && "opacity-40"
          )}
          aria-label={`${pigment.name} color`}
        />
        <Input
          value={pigment.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className={cn("h-9 flex-1", !available && "text-muted-foreground")}
        />
        {!available && (
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            out
          </span>
        )}
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
  const [showLibrary, setShowLibrary] = useState(false);

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

      <div className="flex flex-wrap gap-2">
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
          className="flex-1"
        >
          <Plus className="h-4 w-4" /> Add new pigment
        </Button>
        <Button
          variant={showLibrary ? "accent" : "outline"}
          onClick={() => setShowLibrary((s) => !s)}
          className="flex-1"
        >
          <Library className="h-4 w-4" /> Add from library
        </Button>
      </div>

      {showLibrary && (
        <PigmentLibrary
          existingNames={active.pigments.map((p) => p.name)}
          onAdd={(pigment) => {
            const { id: _id, ...rest } = pigment;
            void _id;
            addPigment(rest);
          }}
        />
      )}
    </div>
  );
}

// Browse and cherry-pick individual pigments from every preset.
function PigmentLibrary({
  existingNames,
  onAdd,
}: {
  existingNames: string[];
  onAdd: (pigment: Pigment) => void;
}) {
  const [query, setQuery] = useState("");
  const all = useMemo(() => libraryPigments(), []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? all.filter(
        (x) =>
          x.pigment.name.toLowerCase().includes(q) ||
          x.preset.toLowerCase().includes(q)
      )
    : all;

  // group by source preset
  const groups = filtered.reduce<Record<string, typeof filtered>>((acc, x) => {
    (acc[x.preset] ??= []).push(x);
    return acc;
  }, {});

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 p-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search pigments across all presets…"
          className="h-9"
        />
        <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {Object.entries(groups).map(([preset, items]) => (
            <div key={preset} className="space-y-1">
              <p className="sticky top-0 bg-card py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {preset}
              </p>
              {items.map(({ pigment }) => {
                const already = existingNames.includes(pigment.name);
                return (
                  <div
                    key={preset + pigment.id}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-secondary/40"
                  >
                    <span
                      className="h-5 w-5 shrink-0 rounded-full border border-border/50"
                      style={{ backgroundColor: rgbToHex(pigment.rgb) }}
                    />
                    <span className="flex-1 truncate text-sm">
                      {pigment.name}
                    </span>
                    {already && (
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        in palette
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAdd(pigment)}
                      className="h-7 px-2 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  </div>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No pigments match “{query}”.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
