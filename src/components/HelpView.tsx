import { ChevronDown, Info, ListChecks, MessagesSquare, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openOnboarding } from "@/hooks/useOnboarding";

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
        version: "1.2.0",
        date: "2026",
        changes: [
          "New Scene tab — a painter's assistant, not just a colorimeter. Upload a reference and drag a box over a zone; it reads the scene's light-vs-shadow temperature and tells you how to make that zone read right in context (e.g. “this shadow reads warm for a warm-light scene — add ~3% Ultramarine to cool it”). Shows the measured mix and a scene-adjusted mix side by side. Local, no AI; a “flip light” override for when the photo misleads.",
        ],
      },
      {
        version: "1.1.5",
        date: "2026",
        changes: [
          "Stencil: added an editable line-weight control (a number you type, continuous fine → bold, anti-aliased) so you can dial the exact stroke thickness.",
        ],
      },
      {
        version: "1.1.4",
        date: "2026",
        changes: [
          "IMG Lab: new “Stencil (line art)” option — turns a photo into a clean black-line drawing (no color or shading) you can trace or transfer, with a Detail slider. Runs locally (edge detection, no AI); Download saves it.",
          "Compare: you can now replace an already-uploaded reference or WIP image without starting over.",
        ],
      },
      {
        version: "1.1.3",
        date: "2026",
        changes: [
          "Much better dark colors: the built-in palettes stored their dark, transparent pigments (blacks, umbers, sienna, ultramarine, alizarin, viridian, Payne's…) far too light — like tints instead of the thick masstone. They're now corrected, so deep browns/darks are reachable and recipes stop collapsing to grey or odd complementaries. Bright/opaque tubes (cadmiums, yellows, ochre, whites) are unchanged. (Your own saved palettes aren't touched — reset or re-add a preset to get the new values, or set a pigment's color yourself.)",
        ],
      },
      {
        version: "1.1.2",
        date: "2026",
        changes: [
          "Fix: “Value-first” no longer collapses a color that's darker (or lighter) than every pigment in the palette into a single flat neutral — it now keeps the hue while still favoring the value.",
        ],
      },
      {
        version: "1.1.1",
        date: "2026",
        changes: [
          "Undertone now also works with the Spectral mixing engine (not just Classic / 2-const).",
          "Calibrate can optionally fit each pigment's color (masstone / undertone) from your real mixes, not just its tinting strength.",
          "Share a photo straight into the app from your phone's share sheet — it opens in the Image tab (installed PWA).",
          "Under the hood: tests now run automatically before every deploy.",
        ],
      },
      {
        version: "1.1.0",
        date: "2026",
        changes: [
          "Recipe amounts: an optional “Make [amount]” control turns the proportions into real quantities (ml / g / drops), with a note on how to measure each.",
          "Save to Logbook: one click on a recipe saves the mix (color, recipe text, match) as a Logbook entry in a project you pick or create.",
          "Reachability: when your palette can't reach a color, a note suggests the single pigment to add that would get closest.",
          "Palette planner (Extract): “What tubes do I need?” finds the smallest set of pigments that can mix a whole painting — with a button to turn them into a palette.",
          "Color harmonies: complement, analogous and triadic colors for any target, each with its own recipe.",
          "Undertone: give a pigment a second color (the thin/tinted hue) for more accurate tints and glazes; pick it or sample it from a photo.",
          "New optional mixing engine “2-const” that uses each pigment's opacity (opaque tubes take over a mix more than transparent ones).",
          "First-run intro tour (re-openable from Help) and a scrollable tab bar on phones.",
          "Share a palette by link or QR — the whole palette travels in the link, no account needed; opening it offers to import.",
          "Under the hood: an automated test suite guards the color/mixing engine.",
        ],
      },
      {
        version: "1.0.4",
        date: "2026",
        changes: [
          "Your active photos now persist: the images you upload in Image, Compare, Mix and Extract are saved locally (IndexedDB) and reappear after a reload or when you switch tabs — no need to re-upload.",
          "With cloud sync on, those photos also follow you across devices: upload a reference on one device and it's already there on another. Each image syncs on its own, downscaled to stay small.",
          "Fully backwards compatible: if you don't configure cloud sync, images are still saved and restored locally. An empty slot behaves exactly as before.",
        ],
      },
      {
        version: "1.0.3",
        date: "2026",
        changes: [
          "Settings and Help are now icon buttons in the header (next to the language switch), freeing up room in the tab bar.",
          "Cloud sync status icon in the header: it only appears when sync is active, and its color shows the state — green in sync, blue syncing, red connection lost. Click it to force a sync now.",
        ],
      },
      {
        version: "1.0.2",
        date: "2026",
        changes: [
          "Optional cloud sync (Settings → Cloud sync): keep your palettes, settings and logbook (text) in sync across devices using your OWN free Firebase project — nothing is shared with anyone.",
          "It's a single toggle: when Active sync is on and you're signed in with Google, the app loads your data from the cloud when it opens and uploads changes automatically. When off, the app stays 100% local as before.",
          "Manual Back up / Restore buttons are still there if you prefer to do it by hand. Photos are not synced (only text).",
          "Built-in setup guide and the exact Firestore security rules to paste, right in the app.",
        ],
      },
      {
        version: "1.0.1",
        date: "2026",
        changes: [
          "Logbook: each project now has a reference photo and a finished-painting photo, shown above its colors.",
          "Logbook: export a whole project to PDF (its photos plus every color's recipe, notes and photos).",
          "Recipe: optional “Max colors” and “Value-first” controls for a simpler, more artistic mix that keeps the value (with a ΔL value readout). Off by default.",
          "Image: compare a photo of your own swatch against the target color (match %, value ΔL and Coach advice).",
          "Image: optional sample brush (averages an area instead of one pixel) for high-detail photos.",
          "Extract: optional Color map (posterize the painting into its palette) and drag-to-select an area to extract from.",
          "Extract: a 4-color option, plus the palette switcher and recipe controls right there so you can work from the Extract tab.",
          "Calibrate: added guidance — record mixes (a pigment with white), not single pigments, since calibration fits tinting strength.",
          "Palette: added a note about setting each pigment's real color (masstone) for accurate recipes.",
          "Palette: pick a pigment's color straight from a swatch photo when creating or editing it.",
          "New Settings tab: language, active palette, recipe defaults and your Gemini API key in one place.",
        ],
      },
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
        q: "What do the Match and Value percentages mean?",
        a: "Match (ΔE) is how close the overall color is — hue, chroma and value together. Value (ΔL) is how close just the value (lightness) is, often the most important thing in a painting. Both use the same colors: green ≥90% (great), amber ≥75% (close), red below. A 90% value ≈ ΔL 2, which is barely perceptible.",
      },
      {
        q: "Where is my data stored?",
        a: "Only in your browser: palettes and settings in localStorage, the Logbook (with photos) in IndexedDB. Nothing is uploaded unless you turn on the optional cloud sync (Settings tab), which uses your own Firebase project. Use the export/import options to back up or move data without any cloud.",
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
        version: "1.2.0",
        date: "2026",
        changes: [
          "Nueva pestaña Escena — un asistente para pintores, no solo un colorímetro. Subí una referencia y arrastrá un recuadro sobre una zona; lee la temperatura de luces vs sombras de la escena y te dice cómo hacer que esa zona lea bien en contexto (ej. “esta sombra se lee cálida para una escena de luz cálida — agregá ~3% de Ultramar para enfriarla”). Muestra la mezcla medida y la ajustada a la escena lado a lado. Local, sin IA; con un “invertir luz” por si la foto engaña.",
        ],
      },
      {
        version: "1.1.5",
        date: "2026",
        changes: [
          "Stencil: se agregó un control de grosor de línea editable (un número que tipeás, continuo fino → grueso, con anti-aliasing) para regular el trazo exacto.",
        ],
      },
      {
        version: "1.1.4",
        date: "2026",
        changes: [
          "IMG Lab: nueva opción “Stencil (línea)” — convierte una foto en un dibujo de líneas negras limpio (sin color ni sombras) para calcar o transferir, con un control de Detalle. Corre local (detección de bordes, sin IA); Descargar lo guarda.",
          "Comparar: ahora podés reemplazar una imagen (referencia o pintura) ya subida sin empezar de nuevo.",
        ],
      },
      {
        version: "1.1.3",
        date: "2026",
        changes: [
          "Colores oscuros mucho mejores: las paletas incluidas guardaban sus pigmentos oscuros y transparentes (negros, umbers, siena, ultramar, alizarina, viridian, Payne's…) demasiado claros — como tintes en vez del masstone grueso. Ahora están corregidos, así los marrones/oscuros profundos son alcanzables y las recetas dejan de colapsar a gris o complementarios raros. Los tubos brillantes/opacos (cadmios, amarillos, ocre, blancos) no cambian. (Tus paletas ya guardadas no se tocan — reseteá o re-agregá un preset para tener los nuevos valores, o fijá el color de un pigmento vos mismo.)",
        ],
      },
      {
        version: "1.1.2",
        date: "2026",
        changes: [
          "Fix: “Priorizar valor” ya no colapsa un color más oscuro (o más claro) que todos los pigmentos de la paleta a un neutro plano — ahora mantiene el matiz sin dejar de cuidar el valor.",
        ],
      },
      {
        version: "1.1.1",
        date: "2026",
        changes: [
          "El subtono ahora también funciona con el motor Spectral (no solo Classic / 2-const).",
          "Calibrar puede ajustar opcionalmente el color de cada pigmento (masstone / subtono) desde tus mezclas reales, no solo su fuerza tintórea.",
          "Compartí una foto directo al app desde el menú de compartir del teléfono — se abre en la pestaña Imagen (PWA instalada).",
          "Por dentro: los tests ahora corren automáticamente antes de cada deploy.",
        ],
      },
      {
        version: "1.1.0",
        date: "2026",
        changes: [
          "Cantidades de receta: un control opcional “Preparar [cantidad]” convierte las proporciones en cantidades reales (ml / g / gotas), con una nota de cómo medir cada una.",
          "Guardar en Bitácora: un clic en la receta guarda la mezcla (color, receta, match) como entrada de un proyecto que elegís o creás.",
          "Alcanzabilidad: cuando tu paleta no llega a un color, una nota sugiere el pigmento que más te acercaría si lo agregás.",
          "Planificador de paleta (Extraer): “¿Qué tubos necesito?” encuentra el conjunto mínimo de pigmentos para mezclar todo un cuadro — con un botón para volverlo una paleta.",
          "Armonías de color: complementario, análogos y tríadas de cualquier color, cada uno con su receta.",
          "Subtono (undertone): dale a un pigmento un segundo color (el tono fino/en tinte) para tintes y veladuras más precisos; elegilo o tomalo de una foto.",
          "Nuevo motor de mezcla opcional “2-const” que usa la opacidad de cada pigmento (los opacos dominan la mezcla más que los transparentes).",
          "Tour de intro en la primera vez (reabrible desde Ayuda) y barra de pestañas scrolleable en el teléfono.",
          "Compartí una paleta por link o QR — la paleta entera viaja en el link, sin cuenta; al abrirlo te ofrece importarla.",
          "Por dentro: una suite de tests automatizados que protege el motor de color/mezcla.",
        ],
      },
      {
        version: "1.0.4",
        date: "2026",
        changes: [
          "Tus fotos activas ahora persisten: las imágenes que subís en Imagen, Comparar, Mezcla y Extraer se guardan localmente (IndexedDB) y reaparecen al recargar o al cambiar de pestaña — no hace falta volver a subirlas.",
          "Con el sync en la nube activo, esas fotos también te siguen entre dispositivos: subís una referencia en uno y ya está en el otro. Cada imagen se sincroniza por separado, reducida para ocupar poco.",
          "Totalmente retrocompatible: si no configurás el sync, las imágenes igual se guardan y se restauran localmente. Un espacio vacío funciona igual que antes.",
        ],
      },
      {
        version: "1.0.3",
        date: "2026",
        changes: [
          "Config y Ayuda ahora son botones de ícono en el encabezado (al lado del cambio de idioma), liberando espacio en la barra de pestañas.",
          "Ícono de estado del sync en el encabezado: aparece solo cuando el sync está activo, y su color muestra el estado — verde al día, azul sincronizando, rojo sin conexión. Hacé click para forzar la sincronización.",
        ],
      },
      {
        version: "1.0.2",
        date: "2026",
        changes: [
          "Sync en la nube opcional (Config → Sync en la nube): mantené tus paletas, preferencias y bitácora (texto) sincronizadas entre dispositivos usando TU propio proyecto gratuito de Firebase — no se comparte nada con nadie.",
          "Es un solo interruptor: con Sync activo encendido y sesión iniciada con Google, la app carga tus datos de la nube al abrir y sube los cambios automáticamente. Apagado, la app sigue 100% local como antes.",
          "Siguen los botones de Respaldar / Restaurar manuales por si preferís hacerlo a mano. Las fotos no se sincronizan (solo texto).",
          "Guía de configuración y las reglas de seguridad de Firestore listas para copiar, dentro de la app.",
        ],
      },
      {
        version: "1.0.1",
        date: "2026",
        changes: [
          "Bitácora: cada proyecto ahora tiene una foto de referencia y una del cuadro terminado, arriba de sus colores.",
          "Bitácora: exportá un proyecto entero a PDF (sus fotos más la receta, notas y fotos de cada color).",
          "Receta: controles opcionales “Máx colores” y “Prioriza valor” para una mezcla más simple y artística que cuida el valor (con un número ΔL). Apagados por defecto.",
          "Imagen: compará una foto de tu propio swatch contra el color objetivo (match %, ΔL de valor y consejo del Coach).",
          "Imagen: pincel de muestreo opcional (promedia un área en vez de 1 píxel) para fotos con mucho detalle.",
          "Extraer: Mapa de color opcional (posteriza la pintura en su paleta) y selección de área arrastrando para extraer solo de esa zona.",
          "Extraer: opción de 4 colores, más el selector de paleta y los controles de receta ahí mismo para trabajar desde Extraer.",
          "Calibrar: se agregó una guía — registrá mezclas (un pigmento con blanco), no pigmentos solos, ya que la calibración ajusta la fuerza tintórea.",
          "Paleta: se agregó una nota sobre fijar el color real (masstone) de cada pigmento para recetas precisas.",
          "Paleta: tomá el color de un pigmento directo de una foto de swatch al crearlo o editarlo.",
          "Nueva pestaña Config: idioma, paleta activa, valores por defecto de receta y tu API key de Gemini en un solo lugar.",
        ],
      },
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
        q: "¿Qué significan los porcentajes de Match y Valor?",
        a: "Match (ΔE) es qué tan cerca está el color en general — matiz, croma y valor juntos. Valor (ΔL) es qué tan cerca está solo el valor (luminosidad), a menudo lo más importante en una pintura. Ambos usan los mismos colores: verde ≥90% (muy bien), ámbar ≥75% (cerca), rojo por debajo. Un valor de 90% ≈ ΔL 2, casi imperceptible.",
      },
      {
        q: "¿Dónde se guardan mis datos?",
        a: "Solo en tu navegador: paletas y preferencias en localStorage, la Bitácora (con fotos) en IndexedDB. No se sube nada salvo que actives el sync en la nube opcional (pestaña Config), que usa tu propio proyecto de Firebase. Usá exportar/importar para respaldar o mover los datos sin ninguna nube.",
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
  const { lang, t } = useT();
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
          <button
            onClick={openOnboarding}
            className="inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-accent hover:underline"
          >
            <Sparkles className="h-3.5 w-3.5" /> {t("onboarding.replay")}
          </button>
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
