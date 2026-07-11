import { useEffect, useState } from "react";
import { Pipette } from "lucide-react";
import { hexToRgb, rgbToHex, clamp255, type RGB } from "@/lib/color";
import { useT } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Browser EyeDropper API (Chromium): pick a color from ANYWHERE on screen —
// another window, a reference PDF, a video frame. Progressive enhancement:
// the button only renders where the API exists (Firefox/Safari lack it).
interface EyeDropperResult {
  sRGBHex: string;
}
interface EyeDropperCtor {
  new (): { open: () => Promise<EyeDropperResult> };
}
const EYEDROPPER: EyeDropperCtor | undefined = (
  window as unknown as { EyeDropper?: EyeDropperCtor }
).EyeDropper;

function Channel({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Input
        type="number"
        min={0}
        max={255}
        value={value}
        onChange={(e) => onChange(clamp255(Number(e.target.value)))}
        className="h-9 text-center"
      />
    </label>
  );
}

export function ColorInput({
  rgb,
  onChange,
}: {
  rgb: RGB;
  onChange: (rgb: RGB) => void;
}) {
  const { t } = useT();
  const [hexText, setHexText] = useState(rgbToHex(rgb));

  // keep the hex field in sync when rgb changes from elsewhere (picker, image…)
  useEffect(() => {
    setHexText(rgbToHex(rgb));
  }, [rgb]);

  const commitHex = (text: string) => {
    const parsed = hexToRgb(text);
    if (parsed) onChange(parsed);
    else setHexText(rgbToHex(rgb)); // revert invalid input
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("match.picker")}
          </span>
          <input
            type="color"
            value={rgbToHex(rgb)}
            onChange={(e) => onChange(hexToRgb(e.target.value) ?? rgb)}
            className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
            aria-label="Color picker"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            HEX
          </span>
          <Input
            value={hexText}
            onChange={(e) => setHexText(e.target.value)}
            onBlur={() => commitHex(hexText)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitHex(hexText);
            }}
            placeholder="#927073"
            className="font-mono uppercase"
          />
        </label>
        {EYEDROPPER && (
          <Button
            variant="outline"
            className="h-10"
            title={t("match.eyedropperHint")}
            onClick={async () => {
              try {
                const res = await new EYEDROPPER().open();
                const parsed = hexToRgb(res.sRGBHex);
                if (parsed) onChange(parsed);
              } catch {
                // user pressed Esc — not an error
              }
            }}
          >
            <Pipette className="h-4 w-4" /> {t("match.eyedropper")}
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Channel
          label="R"
          value={rgb.r}
          onChange={(r) => onChange({ ...rgb, r })}
        />
        <Channel
          label="G"
          value={rgb.g}
          onChange={(g) => onChange({ ...rgb, g })}
        />
        <Channel
          label="B"
          value={rgb.b}
          onChange={(b) => onChange({ ...rgb, b })}
        />
      </div>
    </div>
  );
}
