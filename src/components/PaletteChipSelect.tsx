import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// The active-palette chip on the recipe, doubled as a minimal palette switcher.
// Keeps the pill look (no full <select>); clicking opens a small dropdown of
// palettes. Deliberately not the Palette-tab select, to keep this minimal.
export function PaletteChipSelect({
  palettes,
  activeId,
  onSelect,
}: {
  palettes: { id: string; name: string }[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = palettes.find((p) => p.id === activeId);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-1 text-xs font-normal normal-case text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        {t("recipe.usingPalette", { name: active?.name ?? "" })}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 max-h-64 w-48 overflow-y-auto rounded-md border border-border bg-background p-1 shadow-xl">
          {palettes.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onSelect(p.id);
                setOpen(false);
              }}
              className={cn(
                "block w-full truncate rounded px-2 py-1.5 text-left text-xs transition-colors",
                p.id === activeId
                  ? "bg-accent/15 font-medium text-accent"
                  : "text-foreground/90 hover:bg-secondary/60"
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
