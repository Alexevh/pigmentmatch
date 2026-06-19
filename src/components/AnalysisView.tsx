import { analyzeColor, type RGB } from "@/lib/color";
import { useT } from "@/lib/i18n";
import { analysisSentence } from "@/lib/describe";
import { Badge } from "@/components/ui/badge";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Badge>{value}</Badge>
    </div>
  );
}

export function AnalysisView({ rgb }: { rgb: RGB }) {
  const { lang, t } = useT();
  const a = analyzeColor(rgb);
  const sentence = analysisSentence(rgb, lang);

  return (
    <div>
      <p className="mb-3 text-sm italic leading-relaxed text-foreground/90">
        "{sentence}"
      </p>
      <div className="divide-y divide-border/50">
        <Row label={t("analysis.value")} value={t(`analysis.${a.value}`)} />
        <Row label={t("analysis.temperature")} value={t(`analysis.${a.temperature}`)} />
        <Row label={t("analysis.saturation")} value={t(`analysis.${a.saturation}`)} />
        <Row label={t("analysis.hue")} value={t(`analysis.${a.hue}`)} />
      </div>
    </div>
  );
}
