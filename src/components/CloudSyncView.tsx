import { useState } from "react";
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  LogIn,
  LogOut,
  ChevronDown,
  Check,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  useFirebaseConfig,
  setFirebaseConfig,
  parseFirebaseConfig,
} from "@/hooks/useFirebaseConfig";
import {
  useCloudSync,
  setCloudEnabled,
  cloudSignInAction,
  cloudSignOutAction,
  cloudBackupNow,
  cloudRestoreNow,
} from "@/hooks/useCloudSync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Firestore security rules the user pastes into their project (not translated —
// it's code). Each user can only read/write their own /users/{uid}/ data.
const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == uid;
    }
  }
}`;

function Toggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
        on ? "bg-accent" : "bg-secondary"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all",
          on ? "left-[1.375rem]" : "left-0.5"
        )}
      />
    </button>
  );
}

export function CloudSyncView() {
  const { t } = useT();
  const config = useFirebaseConfig();
  const sync = useCloudSync();

  // config entry (when none saved yet)
  const [draft, setDraft] = useState("");
  const [cfgErr, setCfgErr] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  // transient result of a manual action
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

  function saveConfig() {
    const parsed = parseFirebaseConfig(draft);
    if (!parsed) {
      setCfgErr(true);
      return;
    }
    setCfgErr(false);
    setFirebaseConfig(parsed);
  }

  async function backup() {
    setMsg(null);
    try {
      const kb = await cloudBackupNow();
      setMsg({ kind: "ok", text: t("cloud.backupDone", { kb }) });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    }
  }

  async function restore() {
    setMsg(null);
    if (!window.confirm(t("cloud.restoreConfirm"))) return;
    try {
      const ok = await cloudRestoreNow();
      if (!ok) setMsg({ kind: "err", text: t("cloud.restoreNone") });
      else setMsg({ kind: "ok", text: t("cloud.restoreDone") });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    }
  }

  const statusText =
    sync.status === "syncing"
      ? t("cloud.stSyncing")
      : sync.status === "ready"
      ? t("cloud.stReady")
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-accent" /> {t("cloud.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("cloud.intro")}</p>

        {!config ? (
          <>
            {/* Setup instructions */}
            <button
              onClick={() => setShowSetup((s) => !s)}
              className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              <ChevronDown
                className={
                  "h-3.5 w-3.5 transition-transform " +
                  (showSetup ? "rotate-180" : "")
                }
              />
              {t("cloud.setupTitle")}
            </button>
            {showSetup && (
              <div className="space-y-2 rounded-md border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
                <ol className="list-decimal space-y-1 pl-4">
                  <li>{t("cloud.s1")}</li>
                  <li>{t("cloud.s2")}</li>
                  <li>{t("cloud.s3")}</li>
                  <li>{t("cloud.s4")}</li>
                  <li>{t("cloud.s5")}</li>
                  <li>{t("cloud.s6")}</li>
                </ol>
                <a
                  href="https://console.firebase.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block font-medium text-accent hover:underline"
                >
                  {t("cloud.openConsole")}
                </a>
                <div>
                  <p className="mb-1 mt-2 font-medium text-foreground">
                    {t("cloud.rulesLabel")}
                  </p>
                  <pre className="overflow-x-auto rounded bg-background p-2 text-[11px] leading-snug">
                    {RULES}
                  </pre>
                </div>
              </div>
            )}

            {/* Paste config */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t("cloud.configLabel")}
              </label>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t("cloud.configPh")}
                rows={6}
                className="w-full rounded-md border border-input bg-background p-2 font-mono text-xs"
              />
              {cfgErr && (
                <p className="flex items-center gap-1 text-xs text-rose-400">
                  <AlertTriangle className="h-3.5 w-3.5" /> {t("cloud.configErr")}
                </p>
              )}
              <Button size="sm" onClick={saveConfig} disabled={!draft.trim()}>
                {t("cloud.saveConfig")}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Configured */}
            <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-accent" />
                {t("cloud.configured", { id: config.projectId })}
              </span>
              <button
                onClick={() => {
                  setCloudEnabled(false);
                  setFirebaseConfig(null);
                }}
                className="text-muted-foreground hover:text-rose-400 hover:underline"
              >
                {t("cloud.removeConfig")}
              </button>
            </div>

            {/* Active sync toggle */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{t("cloud.active")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("cloud.activeHint")}
                </p>
              </div>
              <Toggle on={sync.enabled} onChange={setCloudEnabled} />
            </div>

            {sync.enabled && (
              <div className="space-y-3 border-t border-border/60 pt-3">
                {!sync.user ? (
                  <div className="space-y-1.5">
                    <Button
                      onClick={cloudSignInAction}
                      disabled={sync.busy}
                      variant="accent"
                    >
                      <LogIn className="h-4 w-4" /> {t("cloud.signIn")}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {t("cloud.signInHint")}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t("cloud.signedInAs", { email: sync.user.email ?? "—" })}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={cloudSignOutAction}
                        disabled={sync.busy}
                      >
                        <LogOut className="h-4 w-4" /> {t("cloud.signOut")}
                      </Button>
                    </div>

                    {statusText && (
                      <p className="flex items-center gap-1.5 text-xs text-accent">
                        <RefreshCw
                          className={
                            "h-3.5 w-3.5 " +
                            (sync.status === "syncing" ? "animate-spin" : "")
                          }
                        />
                        {statusText}
                        {sync.lastSync && sync.status === "ready" && (
                          <span className="text-muted-foreground">
                            ·{" "}
                            {t("cloud.lastBackup", {
                              when: new Date(sync.lastSync).toLocaleString(),
                            })}
                          </span>
                        )}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button onClick={backup} variant="secondary" size="sm">
                        <CloudUpload className="h-4 w-4" /> {t("cloud.backup")}
                      </Button>
                      <Button onClick={restore} variant="outline" size="sm">
                        <CloudDownload className="h-4 w-4" /> {t("cloud.restore")}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {!sync.enabled && (
              <p className="text-xs text-muted-foreground">
                {t("cloud.workingLocal")}
              </p>
            )}

            {(msg || sync.error) && (
              <p
                className={
                  "text-xs " +
                  (msg?.kind === "ok" ? "text-accent" : "text-rose-400")
                }
              >
                {msg
                  ? msg.kind === "err"
                    ? t("cloud.err", { msg: msg.text })
                    : msg.text
                  : t("cloud.err", { msg: sync.error ?? "" })}
              </p>
            )}
          </>
        )}

        <p className="border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
          {t("cloud.note")}
        </p>
      </CardContent>
    </Card>
  );
}
