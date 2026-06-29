import { useEffect, useState } from "react";
import { Images, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { listImages } from "@/lib/imageStore";
import { clearActiveImages } from "@/hooks/useCloudSync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Settings card: see how many active images are stored, and empty them all
// (local IndexedDB + the cloud copy, if cloud sync is on).
export function ActiveImagesCard() {
  const { t } = useT();
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const refresh = () => listImages().then((l) => setCount(l.length));

  useEffect(() => {
    refresh();
    const on = () => refresh();
    window.addEventListener("pm-image-changed", on);
    return () => window.removeEventListener("pm-image-changed", on);
  }, []);

  const clear = async () => {
    if (!window.confirm(t("images.clearConfirm"))) return;
    setBusy(true);
    try {
      await clearActiveImages();
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Images className="h-4 w-4 text-accent" /> {t("images.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{t("images.intro")}</p>
        <p className="text-xs text-muted-foreground">
          {t("images.count", { n: count })}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={clear}
          disabled={busy || count === 0}
          className="text-muted-foreground hover:text-rose-400"
        >
          <Trash2 className="h-4 w-4" /> {t("images.clear")}
        </Button>
      </CardContent>
    </Card>
  );
}
