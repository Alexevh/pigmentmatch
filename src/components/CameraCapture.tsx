import { useEffect, useRef, useState } from "react";
import { Camera, X, SwitchCamera, Check } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

// Local-only camera capture. Opens the device camera (PC webcam or phone
// camera) with getUserMedia, shows a live preview, and on capture draws the
// current frame to a canvas and returns a JPEG Blob. The video stream never
// leaves the browser — no backend, no upload. Requires a secure context
// (HTTPS or localhost), which GitHub Pages provides.
export function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  // `t` is a fresh function each render; keep it in a ref so the camera effect
  // can use it without listing it as a dependency (which would restart the
  // stream on every render and make the camera flicker on/off).
  const tRef = useRef(t);
  tRef.current = t;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const stop = () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };

    const start = async () => {
      stop();
      setReady(false);
      setError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError(tRef.current("camera.error"));
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
        setReady(true);
      } catch (e) {
        if (cancelled) return;
        const name = (e as { name?: string })?.name;
        setError(
          name === "NotAllowedError" || name === "SecurityError"
            ? tRef.current("camera.denied")
            : tRef.current("camera.error")
        );
      }
    };

    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [facing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob(
      (b) => {
        if (b) {
          onCapture(b);
          onClose();
        }
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h3 className="flex items-center gap-2 font-semibold">
            <Camera className="h-4 w-4 text-accent" /> {t("camera.title")}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3 p-4">
          {error ? (
            <p className="rounded-md bg-secondary/60 px-3 py-8 text-center text-sm text-muted-foreground">
              {error}
            </p>
          ) : (
            <div className="relative overflow-hidden rounded-md border border-border bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full"
              />
              {!ready && (
                <span className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
                  {t("camera.starting")}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!error && (
              <>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={capture}
                  disabled={!ready}
                >
                  <Check className="h-4 w-4" /> {t("camera.capture")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFacing((f) => (f === "environment" ? "user" : "environment"))
                  }
                  title={t("camera.flip")}
                >
                  <SwitchCamera className="h-4 w-4" /> {t("camera.flip")}
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t("camera.cancel")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
