import { Anchor, X } from "lucide-react";
import { rgbToHex } from "@/lib/color";
import { isEnabled, type Pigment } from "@/lib/pigments";
import {
  useRequiredTubes,
  addRequiredTube,
  removeRequiredTube,
} from "@/hooks/useRequiredTubes";
import { useT } from "@/lib/i18n";

// Optional must-use tubes for the recipe: pick tubes from a dropdown, they
// show as removable pills, and the engine is forced to keep each of them at a
// meaningful share of the mix. Fully opt-in — with no pills the recipe is
// exactly what it always was.
export function RequiredTubesPicker({ pigments }: { pigments: Pigment[] }) {
  const { t } = useT();
  const required = useRequiredTubes();
  const enabled = pigments.filter(isEnabled);
  // Only ids that exist in the ACTIVE palette count (stale ids from another
  // palette stay stored but invisible/inert).
  const active = required.filter((id) => enabled.some((p) => p.id === id));
  const choices = enabled.filter((p) => !active.includes(p.id));

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          title={t("required.hint")}
        >
          <Anchor className="h-3.5 w-3.5 text-accent" /> {t("required.title")}
        </span>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) addRequiredTube(e.target.value);
            e.target.value = "";
          }}
          className="h-7 rounded-md border border-input bg-background px-2 text-xs"
          aria-label={t("required.title")}
        >
          <option value="">{t("required.add")}</option>
          {choices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {active.map((id) => {
          const p = enabled.find((x) => x.id === id)!;
          return (
            <span
              key={id}
              className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 py-0.5 pl-1.5 pr-1 text-xs"
            >
              <span
                className="h-3.5 w-3.5 rounded-full border border-border/60"
                style={{ backgroundColor: rgbToHex(p.rgb) }}
              />
              {p.name}
              <button
                onClick={() => removeRequiredTube(id)}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label={`remove ${p.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
      </div>
      {active.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {t("required.note")}
        </p>
      )}
    </div>
  );
}
