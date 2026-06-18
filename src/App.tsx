import { useState } from "react";
import { Pipette, Image as ImageIcon, Grid2x2, Palette } from "lucide-react";
import type { RGB } from "@/lib/color";
import { usePalettes } from "@/hooks/usePalettes";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColorInput } from "@/components/ColorInput";
import { ResultPanel } from "@/components/ResultPanel";
import { ImageSampler } from "@/components/ImageSampler";
import { PaletteExtractor } from "@/components/PaletteExtractor";
import { PaletteManager } from "@/components/PaletteManager";

export default function App() {
  const api = usePalettes();
  const pigments = api.active?.pigments ?? [];
  const [tab, setTab] = useState("match");
  const [target, setTarget] = useState<RGB>({ r: 146, g: 112, b: 115 }); // #927073

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
            <p className="text-xs text-muted-foreground">
              Think in paint, not in RGB
            </p>
          </div>
          <div className="ml-auto hidden text-xs text-muted-foreground sm:block">
            {api.active?.name} · {pigments.length} pigments
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="match">
              <Pipette className="h-4 w-4" /> Match
            </TabsTrigger>
            <TabsTrigger value="image">
              <ImageIcon className="h-4 w-4" /> Image
            </TabsTrigger>
            <TabsTrigger value="extract">
              <Grid2x2 className="h-4 w-4" /> Extract
            </TabsTrigger>
            <TabsTrigger value="palette">
              <Palette className="h-4 w-4" /> Palette
            </TabsTrigger>
          </TabsList>

          {/* Match: manual color input */}
          <TabsContent value="match" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle>Target color</CardTitle>
                </CardHeader>
                <CardContent>
                  <ColorInput rgb={target} onChange={setTarget} />
                </CardContent>
              </Card>
              <ResultPanel rgb={target} pigments={pigments} onPick={setTarget} />
            </div>
          </TabsContent>

          {/* Image: sample colors by clicking */}
          <TabsContent value="image" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle>Sample from image</CardTitle>
                </CardHeader>
                <CardContent>
                  <ImageSampler onSample={setTarget} />
                </CardContent>
              </Card>
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle>Sampled color</CardTitle>
                </CardHeader>
                <CardContent>
                  <ColorInput rgb={target} onChange={setTarget} />
                </CardContent>
              </Card>
            </div>
            <ResultPanel rgb={target} pigments={pigments} onPick={setTarget} />
          </TabsContent>

          {/* Extract: dominant colors from a painting */}
          <TabsContent value="extract">
            <Card>
              <CardHeader>
                <CardTitle>Palette extraction</CardTitle>
              </CardHeader>
              <CardContent>
                <PaletteExtractor
                  pigments={pigments}
                  onPick={(rgb) => {
                    setTarget(rgb);
                    setTab("match");
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Palette: manage pigments */}
          <TabsContent value="palette">
            <Card>
              <CardHeader>
                <CardTitle>Pigment palette</CardTitle>
              </CardHeader>
              <CardContent>
                <PaletteManager api={api} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <footer className="mt-10 border-t border-border/60 pt-5 text-center text-xs text-muted-foreground">
          Runs entirely in your browser — palettes are saved locally. Recipes
          use a subtractive Kubelka-Munk approximation and are a starting point;
          trust your eye on the easel.
        </footer>
      </main>
    </div>
  );
}
