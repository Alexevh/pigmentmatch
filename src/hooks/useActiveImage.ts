import { useCallback, useEffect, useState } from "react";
import { getImage, putImage, deleteImage } from "@/lib/imageStore";

// Read/write the active image for a slot. Loads from IndexedDB on mount and
// re-reads whenever that slot changes (e.g. a cloud pull populated it, or
// another tab updated it). Pass no slot to get an inert no-op (so callers can
// stay backwards compatible / opt out).
export function useActiveImage(slot?: string) {
  const [blob, setBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (!slot) {
      setBlob(null);
      return;
    }
    let alive = true;
    getImage(slot).then((b) => {
      if (alive) setBlob(b);
    });
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { slot?: string } | undefined;
      if (detail?.slot !== slot) return;
      getImage(slot).then((b) => {
        if (alive) setBlob(b);
      });
    };
    window.addEventListener("pm-image-changed", onChange);
    return () => {
      alive = false;
      window.removeEventListener("pm-image-changed", onChange);
    };
  }, [slot]);

  // Persist (downscaled) or clear; the change event will refresh `blob`.
  const save = useCallback(
    (b: Blob | null) => {
      if (!slot) return;
      if (b) void putImage(slot, b);
      else void deleteImage(slot);
    },
    [slot]
  );

  return { blob, save };
}
