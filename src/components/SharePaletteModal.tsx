import { useEffect, useMemo, useState } from "react";
import { X, Copy, Check, Share2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { paletteShareUrl } from "@/lib/paletteShare";
import type { Palette } from "@/lib/pigments";
import { Button } from "@/components/ui/button";

// Long URLs make an unscannable QR — above this we show only the link.
const QR_MAX = 1200;

export function SharePaletteModal({
  palette,
  onClose,
}: {
  palette: Palette;
  onClose: () => void;
}) {
  const { t } = useT();
  const url = useMemo(() => paletteShareUrl(palette), [palette]);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const tooBig = url.length > QR_MAX;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (tooBig) return;
    let alive = true;
    import("qrcode")
      .then((m) => m.toDataURL(url, { margin: 1, width: 220 }))
      .then((d) => alive && setQr(d))
      .catch(() => {
        /* QR is optional */
      });
    return () => {
      alive = false;
    };
  }, [url, tooBig]);

  const copy = () => {
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        /* ignore */
      });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <h3 className="flex items-center gap-2 font-semibold">
            <Share2 className="h-4 w-4 text-accent" /> {t("share.title")}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-muted-foreground">{t("share.intro")}</p>

          <div className="flex gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="h-9 flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs"
            />
            <Button size="sm" variant="accent" onClick={copy}>
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? t("share.copied") : t("share.copy")}
            </Button>
          </div>

          {tooBig ? (
            <p className="text-xs text-muted-foreground">{t("share.tooBig")}</p>
          ) : (
            qr && (
              <div className="flex flex-col items-center gap-2 pt-1">
                <img
                  src={qr}
                  alt="QR"
                  className="rounded-md border border-border bg-white p-1"
                  width={220}
                  height={220}
                />
                <p className="text-xs text-muted-foreground">
                  {t("share.qrHint")}
                </p>
              </div>
            )
          )}

          <p className="border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
            {t("share.note")}
          </p>
        </div>
      </div>
    </div>
  );
}
