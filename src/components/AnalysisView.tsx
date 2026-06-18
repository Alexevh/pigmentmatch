import { analyzeColor, type RGB } from "@/lib/color";
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
  const a = analyzeColor(rgb);
  return (
    <div>
      <p className="mb-3 text-sm italic leading-relaxed text-foreground/90">
        "{a.sentence}"
      </p>
      <div className="divide-y divide-border/50">
        <Row label="Value" value={a.value} />
        <Row label="Temperature" value={a.temperature} />
        <Row label="Saturation" value={a.saturation} />
        <Row label="Hue tendency" value={a.hue} />
      </div>
    </div>
  );
}
