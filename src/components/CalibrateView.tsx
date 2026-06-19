import { useState } from "react";
import { FlaskConical, Trash2, Sparkles, Plus } from "lucide-react";
import { rgbToHex, type RGB } from "@/lib/color";
import type { Pigment } from "@/lib/pigments";
import {
  applyCalibration,
  predictObservation,
  type ObservationItem,
} from "@/lib/calibration";
import { rgbDeltaE } from "@/lib/color";
import type { CalibrationApi } from "@/hooks/useCalibration";
import {
  setCalibratedEngine,
  useCalibratedEngine,
} from "@/hooks/useCalibratedEngine";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorInput } from "./ColorInput";
import { ImageSampler } from "./ImageSampler";

function Dot({ rgb, label }: { rgb: RGB; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="h-9 w-9 rounded-md border border-border/50"
        style={{ backgroundColor: rgbToHex(rgb) }}
      />
      {label && (
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}

export function CalibrateView({
  cal,
  pigments,
}: {
  cal: CalibrationApi;
  pigments: Pigment[];
}) {
  const { t } = useT();
  const calibrated = useCalibratedEngine();
  const [parts, setParts] = useState<Record<string, string>>({});
  const [observed, setObserved] = useState<RGB>({ r: 150, g: 120, b: 100 });
  const [sampling, setSampling] = useState(false);

  const validObs = cal.observations.filter((o) =>
    o.items.some((i) => i.weight > 0)
  );

  // pigments seen by the current engine (calibrated or raw) — for predictions
  const enginePigments =
    cal.calibration != null ? applyCalibration(pigments, cal.calibration) : pigments;

  const formItems: ObservationItem[] = pigments
    .map((p) => ({ pigmentId: p.id, weight: parseFloat(parts[p.id] || "0") }))
    .filter((i) => i.weight > 0);

  const canAdd = formItems.length >= 1;

  const handleAdd = () => {
    if (!canAdd) return;
    cal.addObservation(formItems, observed);
    setParts({});
  };

  const afterError = cal.calibration?.avgError ?? null;

  return (
    <div className="space-y-4">
      {/* Engine toggle ---------------------------------------------------- */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 normal-case tracking-normal text-foreground">
            <FlaskConical className="h-4 w-4 text-accent" />
            {t("calibrate.title")}
          </CardTitle>
          <button
            disabled={!cal.calibration}
            onClick={() => setCalibratedEngine(!calibrated)}
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors disabled:opacity-40",
              calibrated && cal.calibration ? "bg-accent" : "bg-secondary"
            )}
            aria-label="Toggle calibrated mixing"
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                calibrated && cal.calibration
                  ? "translate-x-[22px]"
                  : "translate-x-0.5"
              )}
            />
          </button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t("calibrate.intro")}</p>
          {!cal.calibration ? (
            <p className="text-xs">{t("calibrate.enableHint")}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-border/50 bg-secondary/20 p-3 text-xs">
              <span>
                {t("calibrate.avgBefore")}{" "}
                <span className="font-semibold text-foreground">
                  ΔE {cal.beforeError.toFixed(1)}
                </span>
              </span>
              <span>
                {t("calibrate.after")}{" "}
                <span className="font-semibold text-emerald-400">
                  ΔE {afterError!.toFixed(1)}
                </span>
              </span>
              <span className="text-muted-foreground">
                {calibrated ? t("calibrate.active") : t("calibrate.ready")}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record a mix ----------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{t("calibrate.recordTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {t("calibrate.recordHint")}
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            {pigments.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 rounded-md border border-border/50 bg-secondary/20 px-2 py-1.5"
              >
                <span
                  className="h-5 w-5 shrink-0 rounded-full border border-border/50"
                  style={{ backgroundColor: rgbToHex(p.rgb) }}
                />
                <span className="flex-1 truncate text-sm">{p.name}</span>
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={parts[p.id] ?? ""}
                  placeholder="0"
                  onChange={(e) =>
                    setParts((prev) => ({ ...prev, [p.id]: e.target.value }))
                  }
                  className="h-8 w-16 text-center"
                />
              </label>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
            <Dot rgb={observed} label={t("calibrate.got")} />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("calibrate.realColor")}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSampling((s) => !s)}
                  className="text-xs text-muted-foreground"
                >
                  {sampling
                    ? t("calibrate.enterManually")
                    : t("calibrate.sampleFromPhoto")}
                </Button>
              </div>
              {sampling ? (
                <ImageSampler onSample={setObserved} />
              ) : (
                <ColorInput rgb={observed} onChange={setObserved} />
              )}
            </div>
          </div>

          <Button onClick={handleAdd} disabled={!canAdd} className="w-full">
            <Plus className="h-4 w-4" /> {t("calibrate.addObservation")}
          </Button>
        </CardContent>
      </Card>

      {/* Observations + calibrate ---------------------------------------- */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>
            {t("calibrate.observations", { n: validObs.length })}
          </CardTitle>
          {cal.observations.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={cal.clearObservations}
              className="text-xs text-muted-foreground hover:text-rose-400"
            >
              {t("calibrate.clearAll")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {cal.observations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("calibrate.noObs")}</p>
          ) : (
            <ul className="space-y-2">
              {cal.observations.map((obs) => {
                const recipe = obs.items
                  .filter((i) => i.weight > 0)
                  .map((i) => {
                    const pig = pigments.find((p) => p.id === i.pigmentId);
                    return `${i.weight}× ${pig?.name ?? t("calibrate.removedPigment")}`;
                  })
                  .join("  +  ");
                const predicted = predictObservation(obs, enginePigments);
                const dE = rgbDeltaE(predicted, obs.observed);
                return (
                  <li
                    key={obs.id}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/20 p-2.5"
                  >
                    <Dot rgb={obs.observed} label={t("calibrate.got")} />
                    <Dot rgb={predicted} label={t("calibrate.model")} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{recipe || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("calibrate.modelAway", { de: dE.toFixed(1) })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => cal.removeObservation(obs.id)}
                      className="text-muted-foreground hover:text-rose-400"
                      aria-label="Remove observation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          <Button
            variant="accent"
            onClick={cal.calibrate}
            disabled={validObs.length === 0}
            className="w-full"
          >
            <Sparkles className="h-4 w-4" />
            {cal.calibration ? t("calibrate.recalibrate") : t("calibrate.calibrate")}{" "}
            {t("calibrate.fromN", {
              n: validObs.length,
              word: t(
                validObs.length === 1
                  ? "calibrate.obsSingular"
                  : "calibrate.obsPlural"
              ),
            })}
          </Button>

          {cal.calibration && (
            <Button
              variant="ghost"
              onClick={cal.clearCalibration}
              className="w-full text-xs text-muted-foreground hover:text-rose-400"
            >
              {t("calibrate.discard")}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
