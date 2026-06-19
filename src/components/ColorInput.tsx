import { useEffect, useState } from "react";
import { hexToRgb, rgbToHex, clamp255, type RGB } from "@/lib/color";
import { useT } from "@/lib/i18n";
import { Input } from "@/components/ui/input";

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
