import { isLight, rgbToHex, type RGB } from "@/lib/color";
import { cn } from "@/lib/utils";

export function Swatch({
  rgb,
  className,
  label,
  sub,
  onClick,
}: {
  rgb: RGB;
  className?: string;
  label?: string;
  sub?: string;
  onClick?: () => void;
}) {
  const hex = rgbToHex(rgb);
  const light = isLight(rgb);
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      style={{ backgroundColor: hex }}
      className={cn(
        "relative flex w-full flex-col justify-end overflow-hidden rounded-lg border border-border/40 text-left transition-transform",
        onClick && "hover:scale-[1.015] active:scale-[0.99] cursor-pointer",
        className
      )}
    >
      {(label || sub) && (
        <div
          className={cn(
            "px-3 py-2",
            light ? "text-black/80" : "text-white/90"
          )}
        >
          {label && <div className="text-sm font-semibold">{label}</div>}
          {sub && (
            <div
              className={cn(
                "text-xs font-mono",
                light ? "text-black/55" : "text-white/65"
              )}
            >
              {sub}
            </div>
          )}
        </div>
      )}
    </Comp>
  );
}
