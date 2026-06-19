import { buildVariations, type RGB } from "@/lib/color";
import { useT } from "@/lib/i18n";
import { Swatch } from "./Swatch";

export function VariationsView({
  rgb,
  onPick,
}: {
  rgb: RGB;
  onPick: (rgb: RGB) => void;
}) {
  const { t } = useT();
  const variations = buildVariations(rgb);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {variations.map((v) => (
        <Swatch
          key={v.kind}
          rgb={v.rgb}
          label={t(`variations.${v.kind}`)}
          sub={v.hex}
          className="h-20"
          onClick={() => onPick(v.rgb)}
        />
      ))}
    </div>
  );
}
