import { useEffect, useRef } from "react";
import { Eye } from "lucide-react";
import { rgbToHex, type RGB } from "@/lib/color";
import { useT } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TILE = 108; // px per panel
const CENTER = 42; // px center square (the sampled color)

// Simultaneous contrast: the same sampled color shown (1) inside its REAL
// surroundings from the photo, (2) on white, (3) on mid-grey. Perception
// shifts with the surround — a mix can be numerically right and still "look
// wrong" in place. This makes that visible instead of mysterious.
export function ContrastCheck({
  rgb,
  image,
  pos,
}: {
  rgb: RGB;
  image: HTMLImageElement | null;
  pos: { x: number; y: number } | null; // normalized 0..1 within the image
}) {
  const { t } = useT();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !image || !pos) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const gap = 8;
    canvas.width = TILE * 3 + gap * 2;
    canvas.height = TILE;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1) the real surround: a crop of the photo centered on the pick
    const S = Math.max(
      48,
      Math.round(Math.min(image.naturalWidth, image.naturalHeight) * 0.18)
    );
    const cx = pos.x * image.naturalWidth;
    const cy = pos.y * image.naturalHeight;
    const sx = Math.max(0, Math.min(image.naturalWidth - S, cx - S / 2));
    const sy = Math.max(0, Math.min(image.naturalHeight - S, cy - S / 2));
    ctx.drawImage(image, sx, sy, S, S, 0, 0, TILE, TILE);

    // 2) on white · 3) on mid-grey
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(TILE + gap, 0, TILE, TILE);
    ctx.fillStyle = "#808080";
    ctx.fillRect((TILE + gap) * 2, 0, TILE, TILE);

    // the SAME sampled color at the center of each panel
    ctx.fillStyle = rgbToHex(rgb);
    for (let i = 0; i < 3; i++) {
      const x0 = i * (TILE + gap) + (TILE - CENTER) / 2;
      ctx.fillRect(x0, (TILE - CENTER) / 2, CENTER, CENTER);
    }
  }, [rgb, image, pos]);

  if (!image || !pos) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-accent" /> {t("contrast.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <canvas ref={ref} className="max-w-full rounded-md" />
        <div
          className="grid text-center text-[10px] uppercase tracking-wide text-muted-foreground"
          style={{ gridTemplateColumns: "1fr 1fr 1fr", maxWidth: TILE * 3 + 16 }}
        >
          <span>{t("contrast.inPlace")}</span>
          <span>{t("contrast.onWhite")}</span>
          <span>{t("contrast.onGray")}</span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("contrast.note")}
        </p>
      </CardContent>
    </Card>
  );
}
