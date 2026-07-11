import { useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  RotateCcw,
  Palette as PaletteIcon,
  Library,
  Download,
  Upload,
  Info,
  Pipette,
  Share2,
} from "lucide-react";
import { hexToRgb, rgbToHex, clamp255 } from "@/lib/color";
import {
  PALETTE_PRESETS,
  isEnabled,
  libraryPigments,
  type Pigment,
  type Palette,
  type Temperature,
} from "@/lib/pigments";
import type { usePalettes } from "@/hooks/usePalettes";
import {
  loadObservations,
  loadCalibration,
  saveObservations,
  saveCalibration,
} from "@/lib/storage";
import type { Calibration, Observation } from "@/lib/calibration";
import { newId } from "@/lib/pigments";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ImageSampler } from "./ImageSampler";
import { SharePaletteModal } from "./SharePaletteModal";
import { SubstituteFinder } from "./SubstituteFinder";
import { cn } from "@/lib/utils";

type PaletteApi = ReturnType<typeof usePalettes>;

const TEMPS: Temperature[] = ["warm", "neutral", "cool"];

// Validate + coerce a parsed JSON object into a Palette (for import).
function normalizePalette(obj: unknown): Palette | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (!Array.isArray(o.pigments)) return null;
  const num = (v: unknown, d: number) =>
    typeof v === "number" && isFinite(v) ? v : d;
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const pigments: Pigment[] = [];
  o.pigments.forEach((raw, i) => {
    const p = raw as Record<string, unknown>;
    const rgb = p.rgb as Record<string, unknown> | undefined;
    if (!rgb || typeof rgb !== "object") return;
    const temp = p.temperature;
    const u = p.undertone as Record<string, unknown> | undefined;
    const undertone =
      u && typeof u === "object"
        ? {
            r: clamp255(num(u.r, 128)),
            g: clamp255(num(u.g, 128)),
            b: clamp255(num(u.b, 128)),
          }
        : undefined;
    pigments.push({
      id: typeof p.id === "string" ? p.id : `imp-${i}`,
      name: typeof p.name === "string" ? p.name : `Pigment ${i + 1}`,
      rgb: {
        r: clamp255(num(rgb.r, 128)),
        g: clamp255(num(rgb.g, 128)),
        b: clamp255(num(rgb.b, 128)),
      },
      undertone,
      opacity: clamp01(num(p.opacity, 0.8)),
      temperature:
        temp === "warm" || temp === "cool" || temp === "neutral"
          ? temp
          : "neutral",
      strength: clamp01(num(p.strength, 0.7)),
      enabled: p.enabled === false ? false : undefined,
    });
  });
  if (!pigments.length) return null;
  return {
    id: "imported",
    name: typeof o.name === "string" ? o.name : "Imported palette",
    pigments,
  };
}

// Validate imported calibration observations: keep only well-formed entries
// whose pigment ids all exist in the imported palette.
function normalizeObservations(raw: unknown, pal: Palette): Observation[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set(pal.pigments.map((p) => p.id));
  const out: Observation[] = [];
  for (const o of raw) {
    const obs = o as Record<string, unknown>;
    const items = obs.items;
    const observed = obs.observed as Record<string, unknown> | undefined;
    if (!Array.isArray(items) || !observed || typeof observed !== "object")
      continue;
    const okItems = items.every(
      (i) =>
        i &&
        typeof (i as Record<string, unknown>).pigmentId === "string" &&
        typeof (i as Record<string, unknown>).weight === "number" &&
        ids.has((i as Record<string, unknown>).pigmentId as string)
    );
    if (!okItems) continue;
    const num = (v: unknown) =>
      typeof v === "number" && isFinite(v) ? clamp255(v) : null;
    const r = num(observed.r);
    const g = num(observed.g);
    const b = num(observed.b);
    if (r == null || g == null || b == null) continue;
    out.push({
      id: newId("obs"),
      items: items as Observation["items"],
      observed: { r, g, b },
    });
  }
  return out;
}

// Loosely validate an imported fitted calibration (its shapes are all plain
// records; anything malformed → skipped, the observations alone still import).
function normalizeCalibration(raw: unknown): Calibration | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (!c.strengthById || typeof c.strengthById !== "object") return null;
  if (typeof c.avgError !== "number") return null;
  return c as unknown as Calibration;
}

function PigmentRow({
  pigment,
  onUpdate,
  onRemove,
}: {
  pigment: Pigment;
  onUpdate: (patch: Partial<Pigment>) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [sampling, setSampling] = useState(false);
  const [samplingUnder, setSamplingUnder] = useState(false);
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
            available ? t("palette.available") : t("palette.unavailable")
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
            {t("palette.out")}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          className="text-muted-foreground"
        >
          {open ? t("palette.hide") : t("palette.edit")}
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
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("palette.colorFromPhoto")}</span>
              <Button
                variant={sampling ? "accent" : "ghost"}
                size="sm"
                onClick={() => setSampling((s) => !s)}
              >
                <Pipette className="h-3.5 w-3.5" />{" "}
                {sampling ? t("palette.hide") : t("palette.sampleColor")}
              </Button>
            </div>
            {sampling && (
              <ImageSampler onSample={(rgb) => onUpdate({ rgb })} />
            )}
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("palette.undertone")}</span>
              {pigment.undertone && (
                <button
                  onClick={() => onUpdate({ undertone: undefined })}
                  className="text-muted-foreground hover:text-rose-400 hover:underline"
                >
                  {t("palette.undertoneClear")}
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {pigment.undertone && (
                <>
                  <input
                    type="color"
                    value={rgbToHex(pigment.undertone)}
                    onChange={(e) =>
                      onUpdate({
                        undertone: hexToRgb(e.target.value) ?? pigment.undertone,
                      })
                    }
                    className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-input bg-background p-0.5"
                    aria-label={`${pigment.name} undertone`}
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {rgbToHex(pigment.undertone)}
                  </span>
                </>
              )}
              {!pigment.undertone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUpdate({ undertone: { ...pigment.rgb } })}
                >
                  {t("palette.undertoneAdd")}
                </Button>
              )}
              <Button
                variant={samplingUnder ? "accent" : "ghost"}
                size="sm"
                onClick={() => setSamplingUnder((s) => !s)}
              >
                <Pipette className="h-3.5 w-3.5" />{" "}
                {samplingUnder ? t("palette.hide") : t("palette.sampleColor")}
              </Button>
            </div>
            {samplingUnder && (
              <div className="mt-2">
                <ImageSampler
                  onSample={(rgb) => onUpdate({ undertone: rgb })}
                />
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("palette.undertoneNote")}
            </p>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>{t("palette.opacity")}</span>
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
              <span>{t("palette.strength")}</span>
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
              {t("palette.temperature")}
            </div>
            <div className="flex gap-1.5">
              {TEMPS.map((temp) => (
                <Button
                  key={temp}
                  size="sm"
                  variant={pigment.temperature === temp ? "accent" : "outline"}
                  onClick={() => onUpdate({ temperature: temp })}
                  className="flex-1"
                >
                  {t(`palette.${temp}`)}
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
  const { t } = useT();
  const [showLibrary, setShowLibrary] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  if (!active) return null;

  const exportActive = () => {
    // Include the palette's calibration data (observations + fitted model) so
    // a backup restores the full working state, not just the tubes. Both are
    // optional on import — old exports (pigments only) keep working.
    const json = JSON.stringify(
      {
        name: active.name,
        pigments: active.pigments,
        observations: loadObservations(active.id),
        calibration: loadCalibration(active.id),
      },
      null,
      2
    );
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active.name.replace(/[^\w-]+/g, "_") || "palette"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Record<
          string,
          unknown
        >;
        const pal = normalizePalette(parsed);
        if (!pal) throw new Error("invalid");
        const newPaletteId = addPreset(() => pal);
        // Restore the calibration data, if the export carried it. Pigment ids
        // are preserved by normalizePalette, so observation items still match.
        const obs = normalizeObservations(parsed.observations, pal);
        if (obs.length) saveObservations(newPaletteId, obs);
        const cal = normalizeCalibration(parsed.calibration);
        if (cal) saveCalibration(newPaletteId, cal);
      } catch {
        alert(t("palette.importError"));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-5">
      {showShare && (
        <SharePaletteModal palette={active} onClose={() => setShowShare(false)} />
      )}
      <div className="rounded-md border border-accent/30 bg-accent/5 p-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-accent">
          <Info className="h-4 w-4 shrink-0" /> {t("palette.masstoneTitle")}
        </p>
        <p className="mt-1">{t("palette.masstoneNote")}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("palette.label")}
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
        <label className="flex flex-1 flex-col gap-1 max-w-[220px]">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("palette.nameLabel")}
          </span>
          <Input
            value={active.name}
            onChange={(e) => renameActive(e.target.value)}
            className="h-10 w-full"
          />
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <select
            value=""
            onChange={(e) => {
              const preset = PALETTE_PRESETS.find((p) => p.id === e.target.value);
              if (preset) addPreset(preset.make);
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            aria-label={t("palette.addPreset")}
          >
            <option value="" disabled>
              {t("palette.addPreset")}
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
            <PaletteIcon className="h-4 w-4" /> {t("palette.new")}
          </Button>
          <Button variant="outline" size="sm" onClick={resetActive}>
            <RotateCcw className="h-4 w-4" /> {t("palette.reset")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={deleteActive}
            disabled={palettes.length <= 1}
            className="text-muted-foreground hover:text-rose-400"
          >
            <Trash2 className="h-4 w-4" /> {t("palette.delete")}
          </Button>
          <Button variant="outline" size="sm" onClick={exportActive}>
            <Download className="h-4 w-4" /> {t("palette.export")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => importRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> {t("palette.import")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowShare(true)}>
            <Share2 className="h-4 w-4" /> {t("palette.share")}
          </Button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
              e.target.value = "";
            }}
          />
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
              name: t("palette.newPigment"),
              rgb: { r: 128, g: 128, b: 128 },
              opacity: 0.8,
              temperature: "neutral",
              strength: 0.7,
            })
          }
          className="flex-1"
        >
          <Plus className="h-4 w-4" /> {t("palette.addNew")}
        </Button>
        <Button
          variant={showLibrary ? "accent" : "outline"}
          onClick={() => setShowLibrary((s) => !s)}
          className="flex-1"
        >
          <Library className="h-4 w-4" /> {t("palette.addFromLibrary")}
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

      <SubstituteFinder pigments={active.pigments} />
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
  const { t } = useT();
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
          placeholder={t("palette.librarySearch")}
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
                        {t("palette.inPalette")}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAdd(pigment)}
                      className="h-7 px-2 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" /> {t("palette.add")}
                    </Button>
                  </div>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("palette.noMatch", { q: query })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
