import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  readSharedPalette,
  clearSharedPaletteHash,
} from "@/lib/paletteShare";
import type { Palette } from "@/lib/pigments";
import { Button } from "@/components/ui/button";

// If the page was opened with a shared-palette link (#pal=...), offer to import
// it. Mounted once at the app root.
export function SharedPaletteImport({
  onImport,
}: {
  onImport: (p: Palette) => void;
}) {
  const { t } = useT();
  const [incoming, setIncoming] = useState<Palette | null>(null);

  useEffect(() => {
    const r = readSharedPalette();
    if (r) setIncoming(r.palette);
  }, []);

  if (!incoming) return null;

  const dismiss = () => {
    clearSharedPaletteHash();
    setIncoming(null);
  };
  const doImport = () => {
    onImport(incoming);
    clearSharedPaletteHash();
    setIncoming(null);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-background p-5 shadow-xl">
        <h3 className="flex items-center gap-2 font-semibold">
          <Download className="h-4 w-4 text-accent" /> {t("share.importTitle")}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("share.importBody", {
            name: incoming.name,
            n: incoming.pigments.length,
          })}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={dismiss}>
            {t("share.importDismiss")}
          </Button>
          <Button variant="accent" size="sm" onClick={doImport}>
            {t("share.importAdd")}
          </Button>
        </div>
      </div>
    </div>
  );
}
