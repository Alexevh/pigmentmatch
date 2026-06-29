import { Cloud, RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useCloudSync, cloudBackupNow } from "@/hooks/useCloudSync";

// Header badge for active cloud sync. Only shows when sync is on AND signed in.
// Color = state: green in sync, blue syncing, red connection lost. Click forces
// an upload now.
export function CloudStatusButton() {
  const { t } = useT();
  const sync = useCloudSync();

  if (!sync.enabled || !sync.user) return null;

  const busy = sync.status === "syncing" || sync.status === "connecting";
  const error = sync.status === "error";

  const color = error
    ? "text-rose-400 hover:bg-rose-400/10"
    : busy
    ? "text-sky-400 hover:bg-sky-400/10"
    : "text-emerald-400 hover:bg-emerald-400/10";

  const title = busy
    ? t("cloud.stSyncing")
    : `${error ? t("cloud.stError") : t("cloud.stReady")} · ${t(
        "cloud.syncNow"
      )}`;

  return (
    <button
      onClick={() => {
        cloudBackupNow().catch(() => {
          /* status already reflects the error */
        });
      }}
      disabled={busy}
      title={title}
      aria-label={title}
      className={"rounded-md p-1.5 transition-colors disabled:opacity-100 " + color}
    >
      {busy ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : (
        <Cloud className="h-4 w-4" />
      )}
    </button>
  );
}
