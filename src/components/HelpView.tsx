import { ChevronDown, Info, ListChecks, MessagesSquare } from "lucide-react";
import { useT } from "@/lib/i18n";

// Help content lives here (bilingual) rather than in i18n.ts because it's long
// prose / structured lists. UI is plain <details> accordions — no deps.
interface Release {
  version: string;
  date: string;
  changes: string[];
}
interface Faq {
  q: string;
  a: string;
}
interface HelpContent {
  aboutTitle: string;
  about: string[];
  releaseTitle: string;
  releases: Release[];
  faqTitle: string;
  faq: Faq[];
}

const HELP: Record<"en" | "es", HelpContent> = {
  en: {
    aboutTitle: "About",
    about: [
      "Pigment Match takes a color you want and works out how to mix it from real oil pigments — and describes it in painter's terms (value, temperature, saturation) instead of raw numbers.",
      "I built it because matching a color by eye was tedious: I used to fight with the color picker in Paint, guessing proportions over and over.",
      "Little by little I added the tools I actually needed for my own painting — image sampling, a coach, comparison, a logbook, palettes for my real tubes. Now it does enough that I wanted to share it.",
    ],
    releaseTitle: "Release notes",
    releases: [
      {
        version: "1.0",
        date: "2026",
        changes: [
          "First stable release.",
          "Match / Image / Extract: turn a color (typed, picked, or sampled from a photo) into a paint-mixing recipe.",
          "Painter analysis and six variations, each with a “How to mix it” guide.",
          "Coach, Compare and Mix tabs to close the gap on the easel.",
          "Logbook (Bitácora): save color mixes per project, with photos.",
          "IMG Lab: image adjustments and optional, experimental AI enhancement.",
          "Palettes: presets (Traditional, Winsor & Newton, Corfix), pigment library, import/export and optional calibration.",
          "Camera capture, English/Spanish, and installable as an offline app (PWA).",
        ],
      },
    ],
    faqTitle: "FAQ",
    faq: [
      {
        q: "Are the recipes exact?",
        a: "They're a strong starting point, not a guarantee. Pigment data is estimated and real paint has variables the model can't capture — finish by eye on the palette (the Coach tab is built for that).",
      },
      {
        q: "Where is my data stored?",
        a: "Only in your browser: palettes and settings in localStorage, the Logbook (with photos) in IndexedDB. Nothing is uploaded. Use the export/import options to back up or move it.",
      },
      {
        q: "A color matches poorly — is it broken?",
        a: "No — usually the active palette just can't reach that color. Add or edit pigments in the Palette tab, or switch to another palette.",
      },
      {
        q: "Do I need an internet connection?",
        a: "No. After it loads it runs offline (it's an installable PWA). Only the optional cloud AI in IMG Lab needs a connection.",
      },
      {
        q: "Is the AI image enhancement free and reliable?",
        a: "The local enhance is free but limited (and runs on your GPU). Cloud AI needs your own API key and may not be free. For color/whites, the plain Adjustments are usually the better tool.",
      },
      {
        q: "Can I use my real paints?",
        a: "Yes — edit the palette to match your tubes (color, opacity, strength), or calibrate it from mixes you've actually made.",
      },
    ],
  },
  es: {
    aboutTitle: "Acerca de",
    about: [
      "Pigment Match toma un color que querés y calcula cómo mezclarlo con pigmentos reales al óleo — y lo describe en términos de pintor (valor, temperatura, saturación) en vez de números.",
      "Lo hice porque igualar un color a ojo era tedioso: antes peleaba con el selector de color de Paint, adivinando proporciones una y otra vez.",
      "De a poco le fui agregando las herramientas que necesitaba para mi propia pintura — muestreo de imágenes, un coach, comparación, una bitácora, paletas con mis tubos reales. Ahora hace lo suficiente como para querer compartirlo.",
    ],
    releaseTitle: "Notas de versión",
    releases: [
      {
        version: "1.0",
        date: "2026",
        changes: [
          "Primera versión estable.",
          "Match / Imagen / Extraer: convertí un color (tipeado, elegido o muestreado de una foto) en una receta de mezcla.",
          "Análisis de pintor y seis variaciones, cada una con su guía “Cómo mezclarlo”.",
          "Pestañas Coach, Comparar y Mezcla para afinar en el caballete.",
          "Bitácora: guardá mezclas de color por proyecto, con fotos.",
          "IMG Lab: ajustes de imagen y mejora con IA opcional y experimental.",
          "Paletas: presets (Tradicional, Winsor & Newton, Corfix), biblioteca de pigmentos, importar/exportar y calibración opcional.",
          "Captura con cámara, inglés/español, e instalable como app offline (PWA).",
        ],
      },
    ],
    faqTitle: "Preguntas frecuentes",
    faq: [
      {
        q: "¿Las recetas son exactas?",
        a: "Son un buen punto de partida, no una garantía. Los datos de pigmentos son estimados y la pintura real tiene variables que el modelo no captura — terminá a ojo en la paleta (para eso está la pestaña Coach).",
      },
      {
        q: "¿Dónde se guardan mis datos?",
        a: "Solo en tu navegador: paletas y preferencias en localStorage, la Bitácora (con fotos) en IndexedDB. No se sube nada. Usá exportar/importar para respaldar o mover los datos.",
      },
      {
        q: "Un color matchea mal, ¿está roto?",
        a: "No — normalmente la paleta activa no puede alcanzar ese color. Agregá o editá pigmentos en la pestaña Paleta, o cambiá de paleta.",
      },
      {
        q: "¿Necesito conexión a internet?",
        a: "No. Después de cargar funciona offline (es una PWA instalable). Solo la IA en la nube de IMG Lab necesita conexión.",
      },
      {
        q: "¿La mejora de imagen con IA es gratis y confiable?",
        a: "La mejora local es gratis pero limitada (corre en tu GPU). La IA en la nube necesita tu propia API key y puede no ser gratis. Para color/blancos, los Ajustes comunes suelen ser mejores.",
      },
      {
        q: "¿Puedo usar mis pinturas reales?",
        a: "Sí — editá la paleta para que coincida con tus tubos (color, opacidad, fuerza), o calibrala con mezclas que hayas hecho de verdad.",
      },
    ],
  },
};

function Accordion({
  icon,
  title,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-border bg-card"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        {icon}
        {title}
        <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border/60 p-4 pt-3">{children}</div>
    </details>
  );
}

export function HelpView() {
  const { lang } = useT();
  const c = HELP[lang];

  return (
    <div className="space-y-4">
      {/* About / purpose */}
      <Accordion
        icon={<Info className="h-4 w-4 text-accent" />}
        title={c.aboutTitle}
        defaultOpen
      >
        <div className="space-y-2 text-sm text-muted-foreground">
          {c.about.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </Accordion>

      {/* Release notes */}
      <Accordion
        icon={<ListChecks className="h-4 w-4 text-accent" />}
        title={c.releaseTitle}
      >
        <div className="space-y-4">
          {c.releases.map((r) => (
            <div key={r.version}>
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className="font-semibold">v{r.version}</span>
                <span className="text-xs text-muted-foreground">{r.date}</span>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {r.changes.map((ch, i) => (
                  <li key={i}>{ch}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Accordion>

      {/* FAQ */}
      <Accordion
        icon={<MessagesSquare className="h-4 w-4 text-accent" />}
        title={c.faqTitle}
      >
        <div className="space-y-3">
          {c.faq.map((f, i) => (
            <div key={i}>
              <p className="text-sm font-medium">{f.q}</p>
              <p className="text-sm text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </Accordion>
    </div>
  );
}
