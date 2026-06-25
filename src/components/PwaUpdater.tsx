import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

// Shows a small toast when a new deployed version is available, so the app never
// silently runs a stale cached build — the user clicks to update and reload.
export function PwaUpdater() {
  const { t } = useT();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 shadow-xl">
      <RefreshCw className="h-4 w-4 text-accent" />
      <span className="text-sm">{t("pwa.updateAvailable")}</span>
      <Button size="sm" variant="accent" onClick={() => updateServiceWorker(true)}>
        {t("pwa.update")}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setNeedRefresh(false)}
        aria-label={t("pwa.dismiss")}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
