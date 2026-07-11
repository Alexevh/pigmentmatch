import { useEffect, useRef } from "react";
import { rgbToLab, rgbToHex, type RGB } from "@/lib/color";
import { isEnabled, type Pigment } from "@/lib/pigments";
import { useT } from "@/lib/i18n";

// A 2D map of the palette's reachable HUE/CHROMA territory: every enabled
// pigment plotted on the a*/b* plane, the convex hull of those points filled
// (mixes live inside it — single-constant K-M can't exceed its ingredients'
// chroma), and the target marked. A target outside the hull is unreachable in
// hue/chroma no matter the proportions; the suggested library pigment is drawn
// hollow to show how it would extend the territory. Value (L*) is the third
// dimension this map deliberately flattens — it explains the "why" of a poor
// match, not the exact ΔE.
export function GamutMap({
  pigments,
  target,
  suggestion,
}: {
  pigments: Pigment[];
  target: RGB;
  suggestion?: Pigment | null;
}) {
  const { t } = useT();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    const pts = pigments.filter(isEnabled).map((p) => {
      const lab = rgbToLab(p.rgb);
      return { x: lab.a, y: lab.b, hex: rgbToHex(p.rgb), name: p.name };
    });
    const tl = rgbToLab(target);
    const sug = suggestion
      ? { ...rgbToLab(suggestion.rgb), hex: rgbToHex(suggestion.rgb) }
      : null;

    // Scale: fit everything with padding; at least ±60 so small palettes
    // don't look artificially huge.
    let m = 60;
    for (const p of pts) m = Math.max(m, Math.abs(p.x), Math.abs(p.y));
    m = Math.max(m, Math.abs(tl.a), Math.abs(tl.b));
    if (sug) m = Math.max(m, Math.abs(sug.a), Math.abs(sug.b));
    m *= 1.15;
    const sx = (a: number) => W / 2 + (a / m) * (W / 2);
    const sy = (b: number) => H / 2 - (b / m) * (H / 2);

    ctx.clearRect(0, 0, W, H);

    // axes
    ctx.strokeStyle = "rgba(148,163,184,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.fillStyle = "rgba(148,163,184,0.55)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(t("gamut.axisWarm"), W - 58, H / 2 - 5); // +a* red
    ctx.fillText(t("gamut.axisYellow"), W / 2 + 4, 12); // +b* yellow
    ctx.fillText(t("gamut.axisGreen"), 4, H / 2 - 5); // −a* green
    ctx.fillText(t("gamut.axisBlue"), W / 2 + 4, H - 5); // −b* blue

    // convex hull of the pigment cloud (monotone chain)
    if (pts.length >= 3) {
      const sorted = [...pts].sort((p, q) => p.x - q.x || p.y - q.y);
      const cross = (
        o: { x: number; y: number },
        a: { x: number; y: number },
        b: { x: number; y: number }
      ) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
      const lower: typeof pts = [];
      for (const p of sorted) {
        while (
          lower.length >= 2 &&
          cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
        )
          lower.pop();
        lower.push(p);
      }
      const upper: typeof pts = [];
      for (let i = sorted.length - 1; i >= 0; i--) {
        const p = sorted[i];
        while (
          upper.length >= 2 &&
          cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
        )
          upper.pop();
        upper.push(p);
      }
      const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
      ctx.beginPath();
      hull.forEach((p, i) =>
        i === 0 ? ctx.moveTo(sx(p.x), sy(p.y)) : ctx.lineTo(sx(p.x), sy(p.y))
      );
      ctx.closePath();
      ctx.fillStyle = "rgba(120,140,180,0.12)";
      ctx.fill();
      ctx.strokeStyle = "rgba(148,163,184,0.5)";
      ctx.stroke();
    }

    // pigment dots
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y), 5, 0, Math.PI * 2);
      ctx.fillStyle = p.hex;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.stroke();
    }

    // suggested extension (hollow)
    if (sug) {
      ctx.beginPath();
      ctx.arc(sx(sug.a), sy(sug.b), 6, 0, Math.PI * 2);
      ctx.strokeStyle = sug.hex;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // target: a ringed cross so it reads over anything
    const tx = sx(tl.a);
    const ty = sy(tl.b);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tx, ty, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx - 11, ty);
    ctx.lineTo(tx + 11, ty);
    ctx.moveTo(tx, ty - 11);
    ctx.lineTo(tx, ty + 11);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(tx, ty, 4, 0, Math.PI * 2);
    ctx.fillStyle = rgbToHex(target);
    ctx.fill();
  }, [pigments, target, suggestion, t]);

  return (
    <div className="space-y-1.5">
      <canvas
        ref={ref}
        width={280}
        height={280}
        className="max-w-full rounded-md border border-border bg-background/60"
      />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {t("gamut.legend")}
      </p>
    </div>
  );
}
