import { useMemo, useState } from "react";
import {
  Pipette,
  Image as ImageIcon,
  Grid2x2,
  Palette,
  GraduationCap,
  FlaskConical,
  GitCompare,
  Beaker,
  NotebookPen,
  Wand2,
} from "lucide-react";
import type { RGB } from "@/lib/color";
import { usePalettes } from "@/hooks/usePalettes";
import { useCalibration } from "@/hooks/useCalibration";
import { useCalibratedEngine } from "@/hooks/useCalibratedEngine";
import { applyCalibration } from "@/lib/calibration";
import { isEnabled } from "@/lib/pigments";
import { useT, setLang, type Lang } from "@/lib/i18n";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColorInput } from "@/components/ColorInput";
import { AnalysisView } from "@/components/AnalysisView";
import { ResultPanel } from "@/components/ResultPanel";
import { ImageSampler } from "@/components/ImageSampler";
import { PaletteExtractor } from "@/components/PaletteExtractor";
import { PaletteManager } from "@/components/PaletteManager";
import { CoachView } from "@/components/CoachView";
import { CalibrateView } from "@/components/CalibrateView";
import { CompareView } from "@/components/CompareView";
import { MixCheckView } from "@/components/MixCheckView";
import { LogbookView } from "@/components/LogbookView";
import { ImgLabView } from "@/components/ImgLabView";

export default function App() {
  const { lang, t } = useT();
  const api = usePalettes();
  const pigments = api.active?.pigments ?? [];
  const [tab, setTab] = useState("match");
  const [target, setTarget] = useState<RGB>({ r: 146, g: 112, b: 115 }); // #927073

  // Optional calibrated engine: when the toggle is on and a calibration exists
  // for the active palette, recipes everywhere use the fitted pigment strengths.
  const cal = useCalibration(api.activeId, pigments);
  const calibrated = useCalibratedEngine();
  const engineOn = calibrated && cal.calibration != null;

  // Only available pigments feed the recipe/coach/extract suggestions; the
  // Palette and Calibrate tabs still see the full list.
  const enabledPigments = useMemo(
    () => pigments.filter(isEnabled),
    [pigments]
  );
  const effectivePigments = useMemo(
    () =>
      engineOn
        ? applyCalibration(enabledPigments, cal.calibration!)
        : enabledPigments,
    [engineOn, cal.calibration, enabledPigments]
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Palette className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">
              Pigment Match
            </h1>
            <p className="text-xs text-muted-foreground">{t("app.tagline")}</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {engineOn && (
              <span className="hidden items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 font-medium text-accent sm:flex">
                <FlaskConical className="h-3 w-3" /> {t("app.calibrated")}
              </span>
            )}
            <span className="hidden sm:inline">
              {api.active?.name} ·{" "}
              {enabledPigments.length < pigments.length
                ? t("app.pigmentsOf", {
                    enabled: enabledPigments.length,
                    total: pigments.length,
                  })
                : t("app.pigments", { n: pigments.length })}
            </span>
            <div className="flex items-center gap-0.5 rounded-md bg-secondary/60 p-0.5">
              {(["en", "es"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={
                    "rounded px-2 py-0.5 font-medium uppercase transition-colors " +
                    (lang === l
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="match">
              <Pipette className="h-4 w-4" /> {t("tabs.match")}
            </TabsTrigger>
            <TabsTrigger value="image">
              <ImageIcon className="h-4 w-4" /> {t("tabs.image")}
            </TabsTrigger>
            <TabsTrigger value="extract">
              <Grid2x2 className="h-4 w-4" /> {t("tabs.extract")}
            </TabsTrigger>
            <TabsTrigger value="coach">
              <GraduationCap className="h-4 w-4" /> {t("tabs.coach")}
            </TabsTrigger>
            <TabsTrigger value="compare">
              <GitCompare className="h-4 w-4" /> {t("tabs.compare")}
            </TabsTrigger>
            <TabsTrigger value="mix">
              <Beaker className="h-4 w-4" /> {t("tabs.mix")}
            </TabsTrigger>
            <TabsTrigger value="logbook">
              <NotebookPen className="h-4 w-4" /> {t("tabs.logbook")}
            </TabsTrigger>
            <TabsTrigger value="imglab">
              <Wand2 className="h-4 w-4" /> {t("tabs.imglab")}
            </TabsTrigger>
            <TabsTrigger value="calibrate">
              <FlaskConical className="h-4 w-4" /> {t("tabs.calibrate")}
            </TabsTrigger>
            <TabsTrigger value="palette">
              <Palette className="h-4 w-4" /> {t("tabs.palette")}
            </TabsTrigger>
          </TabsList>

          {/* Match: manual color input */}
          <TabsContent value="match" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle>{t("match.targetColor")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ColorInput rgb={target} onChange={setTarget} />
                </CardContent>
              </Card>
              <ResultPanel
                rgb={target}
                pigments={effectivePigments}
                onPick={setTarget}
                palettes={api.palettes}
                activeId={api.activeId}
                onSelectPalette={api.setActiveId}
              />
            </div>
          </TabsContent>

          {/* Image: sample colors by clicking */}
          <TabsContent value="image">
            <div className="grid items-start gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <Card className="h-fit">
                  <CardHeader>
                    <CardTitle>{t("match.sampleFromImage")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ImageSampler onSample={setTarget} />
                  </CardContent>
                </Card>
                <Card className="h-fit">
                  <CardHeader>
                    <CardTitle>{t("analysis.title")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AnalysisView rgb={target} />
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-4">
                <Card className="h-fit">
                  <CardHeader>
                    <CardTitle>{t("match.sampledColor")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ColorInput rgb={target} onChange={setTarget} />
                  </CardContent>
                </Card>
                <ResultPanel
                  rgb={target}
                  pigments={effectivePigments}
                  onPick={setTarget}
                  stack
                  hideAnalysis
                  palettes={api.palettes}
                  activeId={api.activeId}
                  onSelectPalette={api.setActiveId}
                />
              </div>
            </div>
          </TabsContent>

          {/* Extract: dominant colors from a painting */}
          <TabsContent value="extract">
            <Card>
              <CardHeader>
                <CardTitle>{t("extract.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <PaletteExtractor
                  pigments={effectivePigments}
                  onPick={(rgb) => {
                    setTarget(rgb);
                    setTab("match");
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Coach: directional advice toward the target */}
          <TabsContent value="coach">
            <CoachView
              target={target}
              onTargetChange={setTarget}
              pigments={effectivePigments}
            />
          </TabsContent>

          {/* Compare: reference vs work-in-progress critique */}
          <TabsContent value="compare">
            <CompareView pigments={effectivePigments} />
          </TabsContent>

          {/* Mix: reference color vs a photo of the palette mix */}
          <TabsContent value="mix">
            <MixCheckView pigments={effectivePigments} />
          </TabsContent>

          {/* Logbook: save color mixes per project (IndexedDB, with photos) */}
          <TabsContent value="logbook">
            <Card>
              <CardHeader>
                <CardTitle>{t("logbook.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <LogbookView />
              </CardContent>
            </Card>
          </TabsContent>

          {/* IMG Lab: edit/enhance a photo (adjustments + optional AI), download */}
          <TabsContent value="imglab">
            <Card>
              <CardHeader>
                <CardTitle>{t("tabs.imglab")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ImgLabView />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calibrate: optional — fit the model to the painter's real paints */}
          <TabsContent value="calibrate">
            <CalibrateView cal={cal} pigments={pigments} />
          </TabsContent>

          {/* Palette: manage pigments */}
          <TabsContent value="palette">
            <Card>
              <CardHeader>
                <CardTitle>{t("palette.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <PaletteManager api={api} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <footer className="mt-10 border-t border-border/60 pt-5 text-center text-xs text-muted-foreground">
          {t("app.footer")}
        </footer>
      </main>
    </div>
  );
}
