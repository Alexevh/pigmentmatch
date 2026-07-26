// Lightweight i18n. English (default) + Spanish, switchable at runtime.
// Strings live in a nested dictionary; `t("a.b.c", {n: 5})` looks up the path
// and interpolates {placeholders}.
import { useSyncExternalStore } from "react";

export type Lang = "en" | "es";

const KEY = "pigment-match.lang.v1";

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

let value: Lang = read();
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Keep the <html lang> attribute matching the active language. Content that
// matches its declared language is not offered for auto-translation (together
// with translate="no" in index.html), and it's correct for accessibility.
function syncHtmlLang(lang: Lang) {
  try {
    document.documentElement.lang = lang;
  } catch {
    /* SSR / no document */
  }
}
syncHtmlLang(value);

export function setLang(next: Lang) {
  value = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  syncHtmlLang(next);
  listeners.forEach((l) => l());
}
export function useLang(): Lang {
  return useSyncExternalStore(
    subscribe,
    () => value,
    () => value
  );
}

type Dict = { [k: string]: string | Dict };

const en: Dict = {
  app: {
    tagline: "Think in paint, not in RGB",
    pigments: "{n} pigments",
    pigmentsOf: "{enabled}/{total} pigments",
    calibrated: "Calibrated",
    footer:
      "Runs entirely in your browser — palettes are saved locally. Recipes use a subtractive Kubelka-Munk approximation and are a starting point; trust your eye on the easel.",
  },
  pwa: {
    updateAvailable: "A new version is available.",
    update: "Update",
    dismiss: "Dismiss",
  },
  tabs: {
    match: "Match",
    image: "Image",
    extract: "Extract",
    coach: "Coach",
    compare: "Compare",
    mix: "Mix",
    logbook: "Logbook",
    imglab: "IMG Lab",
    calibrate: "Calibrate",
    palette: "Palette",
    scene: "Scene",
    settings: "Settings",
    help: "Help",
  },
  settings: {
    intro: "App preferences — all saved in this browser.",
    language: "Language",
    activePalette: "Active palette",
    recipeDefaults: "Recipe defaults",
    recipeDefaultsHint:
      "These apply to every recipe across the app (same controls shown on the recipe).",
    aiTitle: "Cloud AI (Gemini)",
    aiKey: "Gemini API key",
    aiKeyHint:
      "Used by IMG Lab's cloud AI. Stored only in this browser and sent only to Google.",
    getKey: "Get a free key",
  },
  images: {
    title: "Active images",
    intro:
      "The photos you upload in Image, Compare, Mix, Extract, Coach and Calibrate are saved here so they persist across reloads and (with cloud sync on) follow you to your other devices.",
    count: "Stored images: {n}",
    clear: "Clear active images",
    clearConfirm:
      "Remove all active images from this device and from the cloud (if sync is on)? This can't be undone.",
  },
  cloud: {
    title: "Cloud sync (optional)",
    intro:
      "Sync your palettes, settings and logbook (text) across devices using your OWN free Firebase project. Sign in with the same Google account on another device to get your data there. Nothing is shared with us — your data lives in your Firebase project.",
    setupTitle: "How to set it up (one time)",
    s1: "Create a project at the Firebase console (Add project).",
    s2: "Build → Firestore Database → Create database (Production mode).",
    s3: "Build → Authentication → Get started → enable the Google sign-in provider.",
    s4: "Authentication → Settings → Authorized domains → add this site's domain.",
    s5: "Project settings (gear) → Your apps → Web (</>) → register the app → copy its firebaseConfig and paste it below.",
    s6: "Firestore → Rules → paste the rules below → Publish.",
    openConsole: "Open the Firebase console",
    rulesLabel: "Security rules (paste in Firestore → Rules):",
    configLabel: "Paste your firebaseConfig here",
    configPh: 'const firebaseConfig = {\n  apiKey: "...",\n  authDomain: "...",\n  projectId: "...",\n  appId: "..."\n};',
    saveConfig: "Save config",
    configErr:
      "Couldn't read that — paste the whole firebaseConfig (it needs apiKey, authDomain, projectId and appId).",
    configured: "Connected to project: {id}",
    removeConfig: "Remove",
    signIn: "Sign in with Google",
    signOut: "Sign out",
    signedInAs: "Signed in as {email}",
    backup: "Back up to cloud",
    restore: "Restore from cloud",
    backupDone: "Backed up to the cloud ({kb} KB).",
    restoreConfirm:
      "Restore will REPLACE the palettes, settings and logbook in this browser with the cloud copy. Continue?",
    restoreNone: "No cloud backup found yet — back up first.",
    restoreDone: "Restored. Reloading…",
    lastBackup: "Last sync: {when}",
    noBackup: "No cloud backup yet.",
    active: "Active sync",
    activeHint:
      "When on, this device loads your data from the cloud when it opens and uploads your changes automatically. Turn off to work only on this device.",
    signInHint:
      "Sign in with the same Google account you use on your other devices.",
    stSyncing: "Syncing…",
    stReady: "In sync",
    stError: "Connection lost",
    syncNow: "Sync now",
    workingLocal: "Sync is off — working only on this device.",
    note: "Photos are not synced (only palettes, settings and logbook text). The Firebase config and sign-in stay on each device — set them up once per browser.",
    err: "Error: {msg}",
  },
  scene: {
    title: "Scene / Zone",
    intro:
      "Analyze a zone within the whole scene — not just a pixel. It reads the light vs shadow temperature of the reference and suggests a mix that reads correctly in context (e.g. cooling a shadow under warm light). Guidance, not truth — trust your eye.",
    upload: "Upload a reference to analyze",
    uploadHint: "Then drag a box over a zone",
    selectHint: "Drag a box on the image to pick the zone to analyze.",
    profileTitle: "Scene profile",
    light: "Light",
    shadow: "Shadow",
    key: "Key",
    keyHigh: "high",
    keyMid: "mid",
    keyLow: "low",
    pol_warmlight: "Warm light → cool shadows",
    pol_coollight: "Cool light → warm shadows",
    pol_flat: "Flat / neutral light",
    override: "Flip light temperature",
    overrideHint: "Photos can mislead — flip if the light reads wrong.",
    zoneTitle: "This zone",
    fam_light: "light",
    fam_halftone: "halftone",
    fam_shadow: "shadow",
    zoneFamily: "Reads as",
    zoneChromaHi: "more saturated than the scene",
    zoneChromaLo: "less saturated than the scene",
    zoneChromaEq: "about the scene's saturation",
    adviceTitle: "Assistant",
    headlineAdjust: "A context tweak will help this sit right:",
    headlineOk: "This zone already sits well for the scene's light.",
    tipCool:
      "This {family} reads warm for a warm-light scene — add ~{percent}% {name} to cool it so it settles into shadow.",
    tipWarm:
      "This {family} reads cool for a cool-light scene — add ~{percent}% {name} to warm it.",
    tipChroma:
      "It's more saturated than the scene's shadows — knock the chroma back a touch so the form turns.",
    val_light: "Keep it clearly in the light family (above the value break).",
    val_halftone: "This is a halftone — the transition; keep it between light and shadow.",
    val_shadow: "Keep it in the shadow family (below the value break).",
    measured: "Measured (the pixel)",
    adjusted: "Scene-adjusted",
    dragToStart: "Drag a box on the image to analyze a zone.",
  },
  imglab: {
    intro:
      "Work on a photo here — adjust it, optionally enhance it with AI, and download the result to reuse. Then upload the cleaned image in the other tabs to sample colors.",
    upload: "Upload an image to work on",
    uploadHint: "Adjust · enhance · download",
    adjustTitle: "Adjustments",
    adjustDesc:
      "Local, predictable tweaks (no AI). Best for color / white balance, exposure and sharpness.",
    oilTitle: "Oil painting (painterly)",
    oilDesc:
      "Simplify the photo into flat paint-like daubs while keeping edges crisp — as if the reference were already painted in oils. Fewer, cleaner color decisions to match. Runs locally (Kuwahara filter, no AI).",
    oilToggle: "Painterly view",
    oilMode_classic: "Classic",
    oilMode_aniso: "Anisotropic (GPU)",
    oilAnisoHint:
      "Strokes stretch along the local edges — a more organic, hand-painted look. Runs on the GPU (WebGL2); if unavailable it silently falls back to Classic.",
    oilBrush: "Brush",
    oilHint:
      "Bigger brush = larger daubs, more simplification. Combine with Contrast above, or with the Stencil below for line art of the simplified shapes.",
    fxTitle: "More filters",
    fxDesc:
      "Classic corrective and artistic filters — all local, no AI. One at a time; corrections apply before the oil filter, the impasto relief on top of it.",
    fxApplying: "Applying…",
    fxNone: "None",
    fxBilateral: "Watercolor smooth (bilateral)",
    fxPosterize: "Posterize values (Lab)",
    fxXdog: "Ink lines (XDoG)",
    fxClahe: "Recover shadows/highlights (CLAHE)",
    fxFlatten: "Even out lighting (retinex)",
    fxImpasto: "Impasto relief",
    fxStrength: "Strength",
    fxRadius: "Radius",
    fxLevels: "Levels",
    fxDetail: "Detail",
    fxInk: "Ink",
    fxClip: "Clip",
    fxHint_bilateral:
      "Edge-preserving smoothing — a softer, washier simplification than the oil filter.",
    fxHint_posterize:
      "Quantizes the VALUES (L*) into bands while keeping the color — the notan idea, in color.",
    fxHint_xdog:
      "Organic ink-like line art (Winnemöller XDoG) — softer and more hand-drawn than the Stencil below.",
    fxHint_clahe:
      "Local contrast recovery for badly exposed references — detail comes back in shadows and highlights without shifting global color.",
    fxHint_flatten:
      "Divides out the estimated lighting field so a side-lit reference reads evenly — the object's own values become easier to judge.",
    fxHint_impasto:
      "Fakes paint thickness by lighting the strokes' relief. Reads best on top of the oil filter.",
    stencilTitle: "Stencil (line art)",
    stencilDesc:
      "Turn the photo into a clean line drawing — black outlines, no color or shading (edge detection, no AI). Great to trace or transfer. Tune the detail, then Download. Tip: bump Contrast above for cleaner lines.",
    stencilToggle: "Stencil",
    stencilDetail: "Detail",
    stencilThickness: "Thickness",
    stencilThicknessHint: "0.3 = fine · 1 = normal · higher = bolder",
    aiExperimental: "AI is experimental",
    aiWarning:
      "The AI features run entirely on your computer (no server), so they use a lot of CPU/GPU and memory. They can be slow, may shift colors, and can fail on modest devices — if that happens, reload the page or try a smaller image.",
    enhanceTitle: "AI enhance — super-resolution",
    enhanceDesc:
      "Upscales a low-resolution / pixelated image and reconstructs detail. The gain shows when you zoom in; it won't help an already-sharp photo.",
    restoreTitle: "AI restore",
    restoreDesc:
      "Cleans up a photo instead of enlarging it: remove blur, remove noise, or lift a dark exposure.",
    run: "Run",
    cloudTitle: "Cloud AI — Gemini (Nano Banana)",
    cloudDesc:
      "Enhance using Google's Gemini image model. It's generative — it can change colors and content, so use it for cleanup, not as a color reference.",
    cloudKey: "Your Gemini API key",
    cloudKeyPh: "Paste your Google AI Studio key",
    cloudGetKey: "Get a free key",
    cloudKeyNote:
      "Your key is stored only in this browser and sent only to Google.",
    cloudInstruction: "Instruction",
    cloudPromptDefault:
      "Sharpen and restore fine detail, reduce noise and compression artifacts; keep the colors and content faithful.",
    cloudRun: "Run cloud AI",
    cloudNoKey: "Enter your Gemini API key first.",
    cloudError: "Cloud AI failed.",
  },
  logbook: {
    title: "Logbook",
    intro:
      "Save color mixes for a piece of work — a skin tone, a sky, a recipe you want to find again. Group them into projects, attach a swatch or reference photo, and come back another day to pick up where you left off.",
    storage: {
      button: "How is my data stored?",
      title: "Where your data lives",
      close: "Got it",
      intro:
        "Pigment Match has no backend — everything stays on this device, in this browser. Nothing is ever uploaded to a server or the cloud.",
      localTitle: "Browser localStorage",
      localBody:
        "Your palettes, calibration, and language / display preferences.",
      idbTitle: "Browser IndexedDB (local database)",
      idbBody:
        "The Logbook — projects, color entries, and their photos (stored as compact images).",
      cautionsTitle: "Things to keep in mind",
      caution1:
        "Data is saved per browser and per device — it does not sync. What you save in one browser won't appear in another, or on your phone.",
      caution2:
        "Clearing your browsing data / “cookies and site data” for this site erases it. Be careful with browser-cleaner tools.",
      caution3:
        "Private / incognito windows usually forget everything when closed.",
      caution4:
        "Reinstalling the browser or switching devices loses it — unless you've exported a backup.",
      backupTitle: "Back up & restore",
      backupBody:
        "Use Export (above) to download your whole Logbook, photos included, as a single .json file — keep it somewhere safe (a cloud drive, emailed to yourself, a USB stick). Use Import to load it back, or to move it to another browser or device. Palettes have their own Export / Import in the Palette tab.",
      tip: "Good habit: export after a big session, the same way you'd save a file.",
    },
    projects: "Projects",
    newProject: "New project",
    projectName: "Project name",
    projectNamePh: "e.g. Portrait commission",
    projectNotesPh: "Notes about this project (optional)",
    noProjects:
      "No projects yet. Create one to start logging your color mixes.",
    rename: "Rename",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    confirmDeleteProject:
      "Delete this project and all its color entries? This can't be undone.",
    confirmDeleteEntry: "Delete this color entry?",
    export: "Export",
    import: "Import",
    pdf: "PDF",
    pdfGenerated: "Generated with Pigment Match",
    exportEmpty: "Nothing to export yet.",
    importError: "Couldn't read that logbook file.",
    imported: "Imported {n} project(s).",
    entries: "Colors",
    noEntries: "No colors logged yet for this project.",
    projectReference: "Reference photo",
    projectFinished: "Finished painting",
    addColor: "Add color",
    editColor: "Edit color",
    colorName: "Color name",
    colorNamePh: "e.g. Generic caucasian skin",
    recipe: "Mix / recipe",
    recipePh: "e.g. 5 Titanium White · 1 Yellow Ochre · touch Cadmium Red · tiny Burnt Umber",
    notes: "Notes",
    notesPh: "Lighting, where it's used, what to tweak… (optional)",
    chipColor: "Swatch color (optional)",
    refPhoto: "Reference photo",
    swatchPhoto: "Swatch photo",
    addPhoto: "Add photo",
    replacePhoto: "Replace",
    removePhoto: "Remove",
    saveColor: "Save color",
    pickFromSwatch: "Pick color from swatch photo",
    count: "{n} color(s)",
    untitled: "Untitled",
    unnamed: "Unnamed color",
  },
  camera: {
    use: "Camera",
    title: "Take a photo",
    capture: "Capture",
    flip: "Flip camera",
    cancel: "Cancel",
    starting: "Starting camera…",
    denied:
      "Camera access was blocked. Allow camera permission for this site in your browser, then try again.",
    error: "Couldn't access a camera on this device.",
  },
  mix: {
    referenceTitle: "Reference — click the color you're matching",
    mixTitle: "Your palette mix — click the paint",
    prompt: "Sample a color from each image to compare value and color.",
    reference: "Reference",
    yourMix: "Your mix",
    valueHeading: "Value",
    colorHeading: "Color & advice",
    grayscale: "Grayscale — judge the values",
    showGrayscale: "Show grayscale (cropped to your samples)",
    probeHint:
      "Move over the reference — the square is your mix's value. Where it blends in, your value matches.",
    lighter: "your mix is lighter",
    darker: "your mix is darker",
    sameValue: "values match closely",
    deltaLabel: "ΔL {n}",
  },
  required: {
    title: "Must-use tubes",
    hint: "Force specific tubes into the recipe — you know your base (e.g. a skin from Pale Rose Blush greyed with Raw Umber) and want the mix built around it.",
    add: "Add a tube…",
    note: "The recipe is forced to keep each pinned tube at a meaningful share (≥2%). The match % honestly reflects the constrained mix — a hard pin can cost a little accuracy.",
  },
  manual: {
    title: "User manual (PDF)",
    desc: "The complete guide to every feature — with worked examples and illustrations drawn from the real mixing engine. Generated in your current language.",
    download: "Download manual",
    generating: "Generating…",
  },
  chart: {
    title: "Calibration chart",
    intro:
      "Calibrate the whole palette in one pass: download the chart, paint each patch with the labeled tube (thick, opaque coats), photograph the sheet flat under even light, upload the photo, align the bold border's corners, and read it. Every patch becomes an observation — masstones plus 1:3 tints with white — auto white-balanced against the blank paper patch.",
    download: "Download chart (PDF)",
    uploadPhoto: "Upload photo of the painted chart",
    replacePhoto: "Replace photo",
    alignHint:
      "Drag the four handles onto the corners of the chart's bold border.",
    read: "Read the chart",
    preview: "Read patches ({n} observations)",
    classify:
      "{add} new · {exact} already recorded (will be skipped) · {conflict} same mix but a different color (you'll be asked).",
    conflictIntro:
      "{n} of these mixes are already recorded with a DIFFERENT color. For each, keep the one you have or replace it with this chart's reading.",
    conflictExisting: "Recorded",
    conflictChart: "This chart",
    conflictKeep: "Keep recorded",
    conflictReplace: "Use chart's",
    addObs: "Add {n} observations",
    added: "Observations added",
    addedSummary: "Added {added}, skipped {skipped} exact duplicate(s).",
    next: "Now press Calibrate below (optionally with “also fit color”) to fit the palette.",
    pdfTitle: "Pigment Match — Calibration chart",
    pdfIntro:
      "Paint each patch with the tube named under it (tints: mix 1 part pigment + 3 parts white). Use thick, opaque paint and stay inside the boxes. Leave the PAPER patch blank. Photograph the whole sheet flat, under even daylight, avoiding glare.",
    pdfPaper: "PAPER — leave blank",
  },
  contrast: {
    title: "Simultaneous contrast",
    inPlace: "In its surround",
    onWhite: "On white",
    onGray: "On grey",
    note:
      "All three center squares are the SAME sampled color — the surround changes how it reads. If a numerically correct mix looks wrong in your painting, judge it against its neighbors, never on the white palette.",
  },
  gamut: {
    show: "See why (gamut map)",
    hide: "Hide gamut map",
    legend:
      "Your pigments on the hue/chroma plane (a*/b*): mixes can only land inside the shaded territory. The crosshair is the target; a hollow ring is the suggested tube that would extend the territory toward it. Value (light/dark) is not shown here.",
    axisWarm: "red / warm →",
    axisYellow: "yellow ↑",
    axisGreen: "← green",
    axisBlue: "blue ↓",
  },
  valueStudy: {
    title: "Value study (notan)",
    intro:
      "The image reduced to its big value masses — how a painting is actually started. Pick how many planes, then click a plane for the mix that hits its average color with your palette.",
    empty: "Upload an image in the extractor above to build the value study.",
    planes: "Planes",
    recipeFor: "Mix for this plane (values L* {lo}–{hi})",
  },
  strings: {
    title: "Color string (value scale)",
    intro:
      "The premixed light→shadow scale of this mix: lighter steps add your white, darker steps add an in-family dark tube (an earth for skin, not black — black just greys the color). Click a step for its proportions.",
    darkenWith: "Darken with",
    baseDot: "Base mix",
    baseStep: "The base mix itself — the recipe above.",
    addStep: "Base mix + {percent}% {name} (of the total).",
    tip: "Numbers on the swatches are the value (L*). Premix these puddles before the session and you'll never chase a value mid-stroke.",
    none: "Add at least two available pigments (ideally including a white) to build a value string.",
  },
  match: {
    targetColor: "Target color",
    sampleFromImage: "Sample from image",
    sampledColor: "Sampled color",
    picker: "Picker",
    eyedropper: "Screen",
    eyedropperHint:
      "Pick a color from anywhere on your screen — another window, a reference image, a paused video. Esc cancels.",
  },
  recipe: {
    title: "Mixing recipe",
    usingPalette: "Palette: {name}",
    none: "No pigments in this palette. Add some to generate a recipe.",
    adjustments: "Adjustments",
    of: "of",
    mixed: "Mixed",
    match: "match",
    value: "Value",
    maxColorsAuto: "Auto",
    maxColorsN: "≤{n}",
    maxColorsTitle: "Limit how many pigments the recipe uses",
    valuePriority: "Value-first",
    valuePriorityTitle:
      "When using fewer colors, keep the value (lightness) close and let hue/chroma drift",
    golden: "Golden ratio",
    goldenTitle:
      "Reshape the proportions to the Fibonacci sequence (golden ratio) — an artistic constraint. The mix usually drifts from the target; the match/value % reflect it.",
    goldenModalTitle: "Golden ratio — experimental",
    goldenModalBody:
      "This reshapes the mix into Fibonacci proportions. The resulting color and its value will be noticeably FAR from the target, so the match and value percentages will drop. It's a purely artistic stretch — it does NOT improve the accuracy of the mix in any way.",
    goldenModalNerd:
      "It's just a nerdy little extra I wanted to include. Enable it anyway?",
    goldenModalEnable: "Enable anyway",
    goldenModalCancel: "Cancel",
    batch: "Make",
    unitMl: "ml",
    unitG: "g",
    unitDrops: "drops",
    batchHint: "Split the recipe into real amounts to mix",
    batchNote: "split by proportion",
    batchHelpTitle: "How to measure",
    batchHelpParts:
      "Parts — relative: squeeze beads of equal width and compare their lengths, or count palette-knife scoops. Best for oil / heavy body.",
    batchHelpGrams:
      "Grams — weigh each blob on a small digital scale. Repeatable, and works for oil.",
    batchHelpFluid:
      "ml / drops — for fluid media (fluid acrylic, ink, watercolor). Not practical for stiff oil paste — use parts or grams there.",
    part: "part",
    parts: "parts",
    partsLabel: "Parts",
    simple: "Simple",
    precise: "Precise",
    classic: "Classic",
    spectral: "Spectral",
    "small touch": "small touch",
    "tiny touch": "tiny touch",
    "microscopic touch": "microscopic touch",
  },
  saveRecipe: {
    button: "Save to Logbook",
    title: "Save mix to Logbook",
    project: "Project",
    newProject: "＋ New project",
    newProjectName: "New project name",
    defaultProject: "Untitled project",
    name: "Name",
    recipe: "Recipe",
    notes: "Notes",
    notesTarget: "Target",
    save: "Save",
    cancel: "Cancel",
    saved: "Saved to the Logbook",
  },
  reach: {
    warn: "Your palette can't fully reach this color.",
    suggest: "Adding {name} could get closer (→ {match}%).",
    noSuggest: "Try adding or editing pigments, or switch palettes.",
  },
  plan: {
    button: "What tubes do I need?",
    hint: "The smallest set of pigments that can mix these colors.",
    result: "These {n} tubes can mix your palette:",
    partial: "Best effort — some colors are still out of reach.",
    use: "Use these tubes",
    useHint:
      "Creates a palette with these pigments and makes it active, so the recipes recompute with them.",
    newPaletteName: "Planned palette",
  },
  harmony: {
    title: "Color harmonies",
    complement: "Complement",
    analogA: "Analogous −",
    analogB: "Analogous +",
    triadA: "Triad +",
    triadB: "Triad −",
    howToMix: "How to mix it",
  },
  onboarding: {
    title: "Welcome to Pigment Match",
    s1Title: "Match any color",
    s1Body:
      "Type, pick or sample a color and get a paint-mixing recipe from real pigments — described in painter's terms (value, temperature, saturation), not just numbers.",
    s2Title: "From a color, a photo, or a painting",
    s2Body:
      "Match a color directly, sample it from a photo in the Image tab, or pull a whole palette from a painting in Extract (and see what tubes you'd need).",
    s3Title: "Make it yours",
    s3Body:
      "In Palette, set your real tubes — color, undertone and tinting strength. Calibrate fine-tunes the model to mixes you've actually made. Accuracy starts here.",
    s4Title: "Close the gap on the easel",
    s4Body:
      "Coach, Compare and Mix help you nail it while painting, and the Logbook saves your mixes. Settings and Help are the icons at the top-right.",
    skip: "Skip",
    back: "Back",
    next: "Next",
    start: "Get started",
    replay: "Replay the intro",
  },
  share: {
    title: "Share this palette",
    intro:
      "This link carries the whole palette (its pigments) — no account or upload needed. Open it on another device to import it.",
    copy: "Copy",
    copied: "Copied",
    qrHint: "Scan to open on your phone",
    tooBig: "This palette is too big for a scannable QR — use the link instead.",
    note: "The palette travels inside the link itself; nothing is uploaded anywhere.",
    importTitle: "Import shared palette?",
    importBody: 'Add "{name}" ({n} pigments) to your palettes?',
    importAdd: "Import",
    importDismiss: "Not now",
  },
  recipeHelp: {
    button: "What do these options do?",
    title: "Recipe options",
    close: "Got it",
    modelTitle: "Mixing model — Classic / Spectral",
    modelIntro: "How the app predicts the color a mix will produce.",
    classic:
      "Classic (default): fast and reliable — a single-constant Kubelka-Munk approximation per color channel. This is the recommended starting point.",
    spectral:
      "Spectral (experimental): rebuilds a full reflectance curve for each pigment and mixes it across the light spectrum, so it's more physically detailed. It can match some mixes better, but on tricky colors in a limited palette it's sometimes slightly worse, and it's a bit slower. Switch to it to compare.",
    km2:
      "2-const (experimental): a two-constant Kubelka-Munk that uses each pigment's opacity as its scattering — so opaque tubes take over a mixture more than transparent ones of equal tinting strength. Approximate (opacity is an estimate, not measured); try it to compare.",
    modeTitle: "Detail — Simple / Precise",
    modeIntro: "How many pigments the recipe is allowed to use.",
    simple:
      "Simple (default): favors fewer pigments — a practical mix you can actually pour. It drops any pigment whose removal barely changes the color.",
    precise:
      "Precise: squeezes the lowest possible color error, even if that means a few extra touches.",
    unitTitle: "Units — Parts / %",
    unitIntro: "How the amounts are shown.",
    parts:
      "Parts: painter-style ratios (1 part white, 2 parts ochre…), with the smallest amounts written as touches.",
    percent:
      "%: each pigment as a percentage of the whole mix — they add up to 100, and anything under 1% shows as <1%.",
    limitTitle: "Fewer colors / Value-first (optional)",
    limitIntro:
      "For a more artistic, limited mix. Both are off by default — leave them and recipes work exactly as before.",
    maxColors:
      "Max colors (Auto / ≤2 / ≤3 / ≤4): caps how many pigments the recipe uses. The color may end up further off, but the mix is simpler and more practical.",
    valueFirst:
      "Value-first: when using fewer colors, it keeps the value (lightness) close and lets the hue/chroma drift — useful when the value matters more than an exact color match. The ΔL readout shows how close the value is.",
    readoutsTitle: "The two scores — Match & Value",
    readoutsIntro:
      "At the bottom of the recipe. Both are percentages with the same colors: green ≥90% (great), amber ≥75% (close), red below.",
    matchReadout:
      "Match (ΔE): how close the overall color is — hue, chroma and value together. ΔE is the raw perceptual error (lower is better).",
    valueReadout:
      "Value (ΔL): how close just the value (lightness) is — often the most important thing in a painting. 90% ≈ ΔL 2 (barely perceptible), 75% ≈ ΔL 5. ΔL is the lightness difference on a 0–100 scale.",
  },
  analysis: {
    title: "Painter analysis",
    value: "Value",
    temperature: "Temperature",
    saturation: "Saturation",
    hue: "Hue tendency",
    // enum labels
    Light: "Light",
    Medium: "Medium",
    Dark: "Dark",
    Warm: "Warm",
    Neutral: "Neutral",
    Cool: "Cool",
    High: "High",
    Low: "Low",
    "Very low": "Very low",
    Reddish: "Reddish",
    Orange: "Orange",
    Yellowish: "Yellowish",
    Green: "Green",
    Blue: "Blue",
    Violet: "Violet",
    // sentence fragments
    grey: "grey",
    lightGrey: "light grey",
    deepGrey: "deep grey",
    light: "light",
    midValue: "mid-value",
    dark: "dark",
    veryLowSat: "very low saturation",
    lowSat: "low saturation",
    medSat: "moderately saturated",
    highSat: "highly saturated",
    neutralTemp: "neutral in temperature",
    slightly: "slightly",
    tendency: "with a slight {hue} tendency",
    sentence: "A {sat} {noun}, {temp}{tendency}.",
  },
  variations: {
    title: "Variations",
    Lighter: "Lighter",
    Darker: "Darker",
    Warmer: "Warmer",
    Cooler: "Cooler",
    "More saturated": "More saturated",
    "Less saturated": "Less saturated",
  },
  variationRecipe: {
    link: "How to mix it",
    heading: "Reaching this variation",
    baseTitle: "Start from your base mix",
    adjustTitle: "Then adjust toward {label}",
    fromBase: "Mix your base color, then nudge it:",
    nothing: "It's already there — no real change needed.",
    close: "Close",
  },
  image: {
    uploadTitle: "Upload an image to sample colors",
    uploadHint: "Click anywhere on it to pick a color",
    brush: "Brush",
    brushTitle:
      "Sample area: 0 = one pixel (default). Higher averages a square so a click on a detailed area gives one representative color.",
    avg: "Average",
    avgHint:
      "Average several picks: each click adds a take and the result is the running mean — much more reliable than a single click on a noisy phone photo. Click 3-5 spots on the same swatch.",
    avgCount: "{n}× · ±{d} ΔE",
    avgSpreadHint:
      "Number of takes and how much they disagree (worst-case ΔE from the mean). A big spread means the photo is noisy — take more picks or use a bigger brush.",
    avgClear: "Clear takes",
    wb: "White balance",
    wbPicking: "Click a white/gray card",
    wbHint:
      "Correct your phone's color cast: put a white or gray card in the same photo under the same light, click it here, then pick your color. Every pick is neutralized against it.",
    wbActive: "WB on",
    wbActiveHint:
      "Picked colors are corrected against your reference card. Uploading a new photo resets it.",
    wbKeepValue: "Keep value",
    wbKeepValueHint:
      "Correct only the color cast and keep the sampled color's own lightness (value). Off = full correction, which can also brighten/darken the color.",
    wbClear: "Clear white-balance reference",
    compareTitle: "Compare with your swatch",
    compareHint:
      "Upload a photo of your painted swatch and click it to compare with the target color above.",
    compareHowTo: "How to reach the target from your sample",
    replace: "Replace image",
    zoom: "Zoom",
    zoomOn: "Zoom on",
    zoomOff: "Zoom off",
    adjust: "Adjust",
    sharpen: "Sharpen",
    brightness: "Brightness",
    contrast: "Contrast",
    saturation: "Saturation",
    temperature: "Temperature",
    reset: "Reset",
    adjustHint:
      "Adjustments help you read the image; the color you pick comes from the adjusted view.",
    ai: "Enhance (AI)",
    aiBusy: "Enhancing…",
    aiError:
      "AI enhance failed — your device's GPU likely ran out of memory (WebGL context lost). Reload the page, then try again with a smaller image or the 2x factor. Some devices can't run this.",
    aiTitle:
      "Experimental: upscales the image with AI (downloaded on first use). May shift colors — sample with care.",
    aiModel: "AI model — stronger = more visible detail, but heavier and slower",
    aiFast: "Fast",
    aiBetter: "Better",
    aiBest: "Best",
    aiBigNote:
      "This image is already high-resolution — AI enhance won't add much (it helps low-res / blurry photos).",
    restore: "Restore (AI)",
    restoreTitle:
      "Experimental AI restoration: deblur / denoise / low-light. Heavy download on first use, slow, results vary — may shift colors.",
    restoreModel: "Restoration type",
    rDeblur: "Deblur",
    rDenoise: "Denoise",
    rLowlight: "Low-light",
    processing: "Processing…",
    download: "Download",
  },
  extract: {
    title: "Palette extraction",
    upload: "Upload a painting",
    colors: "{n} colors",
    extracting: "Extracting…",
    prompt:
      "Upload a painting to extract its dominant colors, arranged from light to dark — each with a mixing recipe and a painter's description.",
    colorN: "Color #{n}",
    mapView: "Color map",
    wholeImage: "Whole image",
    invert: "Invert",
    invertHint:
      "Extract from everything EXCEPT the dragged box — e.g. box the background to leave it out.",
    selectHint:
      "Tip: drag a box on the image to extract colors from just that area.",
    and: "and",
    lightening: "lightening it",
    darkening: "darkening it",
    hintAdd: "Close to {from} — reach it by adding a touch of {push}{extra}.",
    hintAdjust: "Close to {from} — reach it by {extra}.",
    hintVeryClose: "Very close to {from}.",
    coolBlue: "a cool blue",
    warmYellow: "a warm yellow",
    aRed: "a red",
  },
  coach: {
    title: "Coach",
    target: "Target color",
    yourMix: "Your current mix",
    sampleFromPhoto: "Sample from photo",
    enterManually: "Enter manually",
    quantTitle: "How much, exactly?",
    quantBatch: "My puddle is about",
    quantAdvice:
      "Add ~{amount} {unit} of {name} to your {batch} {unit} puddle (≈{percent}% of the final mix).",
    quantRatio:
      "Add 1 part {name} for every {n} parts of your puddle. A “part” is any consistent scoop — a knife-tip, a bead.",
    quantResult: "Predicted result: match goes {before}% → {match}%.",
    quantNote:
      "An estimate — your puddle's real tinting strength is unknown. Add in 2-3 steps and re-sample; strong pigments (phthalos, dioxazine) go a long way.",
    unit_parts: "parts",
    unit_ml: "ml",
    unit_g: "g",
    unit_drops: "drops",
    footer:
      "Add color in tiny steps and re-sample — chasing a target is always a few small corrections, not one big one.",
    headlineThere: "You're there — the difference is barely perceptible.",
    headlineVeryClose: "Very close — just fine-tune from here.",
    headlineClose: "Close. A couple of adjustments and you'll have it.",
    headlineFar: "Not there yet — work through these in order.",
    done: "Lay it in and trust it.",
    subtle: "The differences are subtle — adjust by eye in tiny steps.",
    much: "much ",
    aBit: "a bit ",
    slightly: "slightly ",
    tooDark: "Your mix is {mag}too dark — lift the value with {pig}.",
    tooLight:
      "Your mix is {mag}too light — bring the value down with a touch of {pig}.",
    tooSat:
      "It's {mag}too saturated — knock it back with a touch of {pig}.",
    tooDull: "It's {mag}too grey — intensify it with more {pig}.",
    hueWarmer:
      "The hue leans off — it needs to go warmer. Nudge it with a touch of {pig}.",
    hueCooler:
      "The hue leans off — it needs to go cooler. Nudge it with a touch of {pig}.",
    fineTune: "Almost there — nudge it with a tiny touch of {pig}.",
    white: "white",
    darkPigment: "a dark pigment",
    neutralEarth: "a neutral / earth tone",
    satPigment: "a saturated pigment",
    rightPigment: "the right pigment",
  },
  palette: {
    title: "Pigment palette",
    subTitle: "Tube substitute",
    subIntro:
      "Ran out of a tube mid-painting? Pick it and see how to approximate it by mixing your remaining tubes — plus the closest single tube in the library, as a shopping suggestion.",
    subPick: "Pick the tube you ran out of…",
    subMix: "Mix it from your other tubes",
    subMixPoor:
      "That mix is a rough stand-in — this pigment is hard to reach with the rest of your palette.",
    subNoMix: "No other available tubes to mix from.",
    subBuy: "Closest single tube (library)",
    subMatch: "match {match}%",
    masstoneTitle: "Set each pigment's real color",
    masstoneNote:
      "Recipes are built from each pigment's base color (its masstone), so accuracy starts here. The bundled values are informed estimates — for the best results set each tube's true color: paint a pure swatch, photograph it in good light, sample it in the Image tab and copy that HEX onto the pigment (or click its color square). Do the same whenever you add or create a paint. Calibration only fits tinting strength, not color — the masstone lives here.",
    label: "Palette",
    nameLabel: "Name",
    addPreset: "Add preset…",
    new: "New",
    reset: "Reset",
    delete: "Delete",
    export: "Export",
    import: "Import",
    importError: "Couldn't read that palette file.",
    addNew: "Add new pigment",
    addFromLibrary: "Add from library",
    newPigment: "New Pigment",
    opacity: "Opacity",
    strength: "Tinting strength",
    share: "Share",
    undertone: "Undertone",
    undertoneAdd: "＋ Add undertone",
    undertoneClear: "Remove",
    undertoneNote:
      "Optional. The color this pigment shows in a thin, transparent film over white (a thin scrape / drawdown) — usually a cleaner, shifted hue: ultramarine → violet, phthalo → cyan. Pick it, or sample it from a photo of that thin scrape. It's the saturated hue, not a pale tint — the model lightens it as the pigment becomes a smaller part of the mix.",
    temperature: "Temperature",
    warm: "warm",
    cool: "cool",
    neutral: "neutral",
    edit: "Edit",
    hide: "Hide",
    colorFromPhoto: "Color from a swatch photo",
    sampleColor: "Pick from photo",
    available: "Available — used in mix suggestions",
    unavailable: "Unavailable — ignored in mix suggestions",
    out: "out",
    inPalette: "in palette",
    add: "Add",
    librarySearch: "Search pigments across all presets…",
    noMatch: "No pigments match “{q}”.",
  },
  calibrate: {
    title: "Calibrated mixing",
    intro:
      "Teach the model your real paints. Record a few mixes you've actually made, then calibrate — recipes across the whole app will use the fitted model while this is on.",
    enableHint: "Record observations below and press Calibrate to enable this.",
    avgBefore: "Average error before:",
    after: "after:",
    active: "Active everywhere",
    ready: "Ready — toggle on to use",
    suggestTitle: "Suggested next mixes",
    suggestHint:
      "The most informative mixes to record next — tints with white reveal each pigment's real strength, pairs pin down how they interact. Click one to prefill the parts, then mix it, photograph it and record the color.",
    suggestTint: "A 1:3 tint with white — best reveals this pigment's tinting strength.",
    suggestPair: "A 1:1 pair — pins down how these two interact in a mix.",
    recordTitle: "Record a mix you made",
    recordHint:
      "Enter the parts you used of each pigment, then set the real color you got (type it or sample a photo of your swatch).",
    mixNoteTitle: "Record mixes, not single pigments",
    mixNote:
      "A single pigment on its own teaches the model nothing about tinting strength — strength only shows up in mixtures (one pigment alone always predicts its own masstone, whatever its strength). The most useful observations are a pigment mixed with white at a known ratio — e.g. 1 white + 0.5 ochre, or 1 white + a touch of ultramarine (strong colors need very little). Cover each pigment in at least one mix with white, and add any mix the app currently gets wrong. Note: this fits tinting strength only — a pigment's base color is set in the Palette tab.",
    realColor: "Real color you got",
    got: "got",
    model: "model",
    removedPigment: "removed pigment",
    addObservation: "Add observation",
    observations: "Observations ({n})",
    clearAll: "Clear all",
    noObs:
      "No observations yet. Record a few mixes above — three or more gives the best fit.",
    modelAway: "model is ΔE {de} away",
    calibrate: "Calibrate",
    recalibrate: "Re-calibrate",
    fitColor:
      "Also fit color (masstone / undertone), not just tinting strength — nudges each pigment's color toward your real tubes. Needs a few good observations.",
    fromN: "from {n} {word}",
    obsSingular: "observation",
    obsPlural: "observations",
    discard: "Discard calibration",
    sampleFromPhoto: "Sample from photo",
    enterManually: "Enter manually",
  },
  compare: {
    title: "Comparison",
    uploadRef: "Upload the reference / original",
    uploadWip: "Upload your painting in progress",
    alignTitle: "Align — drag the 4 dots to each painting's corners",
    reference: "Reference",
    yourPainting: "Your painting",
    analyze: "Analyze differences",
    replace: "Replace",
    startOver: "Start over",
    normalize: "Normalize lighting (ignore exposure/WB differences)",
    overlay: "Overlay",
    values: "Values",
    color: "Color",
    regionCoach: "Region coach",
    palettes: "Palettes",
    scorecard: "Scorecard",
    swipe: "swipe",
    onion: "onion",
    paintingOpacity: "Painting opacity",
    squint: "Squint",
    overlayHint: "Left/under = reference · right/over = your painting.",
    grayscale: "Grayscale (value)",
    notanSteps: "Notan steps",
    notan: "Notan (posterized value masses)",
    valueDiff: "Value difference",
    valueDist: "Value distribution",
    histHint:
      "Orange = reference, white = your painting. A narrow spread means a washed-out value range.",
    overallDE: "Overall (ΔE)",
    temperature: "Temperature",
    saturation: "Saturation",
    hue: "Hue",
    diffSuffix: " difference",
    pickHint: "Click a spot on the reference to critique that region.",
    pickPrompt: "Pick a region to see how your painting compares there.",
    refLabel: "reference",
    yoursLabel: "yours",
    refPalette: "Reference palette",
    yourPalette: "Your palette",
    paletteHint:
      "Both arranged light → dark. Compare which families are missing or pushed.",
    valueAccuracy: "Value accuracy",
    colorAccuracy: "Color accuracy",
    valueBias: "Value bias",
    tempBias: "Temperature bias",
    satBias: "Saturation bias",
    meanError: "Mean color error",
    tip: "Tip: value (light/dark) and relative comparisons are the most reliable — photo color and lighting are never exact. Use this as guidance.",
    // legends
    tooDark: "too dark",
    tooLight: "too light",
    tooCool: "too cool",
    tooWarm: "too warm",
    underSat: "undersaturated",
    overSat: "oversaturated",
    onHue: "on hue",
    hueOff: "hue way off",
    matches: "matches",
    veryDiff: "very different",
    neutral: "neutral",
    darker: "darker",
    lighter: "lighter",
    cooler: "cooler",
    warmer: "warmer",
    duller: "duller",
    moreSat: "more saturated",
    // scorecard sentence
    much: "much ",
    aBit: "a bit ",
    slightlyW: "slightly ",
    valClose: "your values are close",
    valBalanced: "your values are off in places but balanced overall",
    valRun: "your values run {mag}{dir}",
    mixTemp: "the mix is {mag}too {dir}",
    satState: "{mag}{dir}",
    colorMatched: "color is well matched",
  },
};

// Spanish — same shape.
const es: Dict = {
  app: {
    tagline: "Pensá en pintura, no en RGB",
    pigments: "{n} pigmentos",
    pigmentsOf: "{enabled}/{total} pigmentos",
    calibrated: "Calibrado",
    footer:
      "Corre enteramente en tu navegador — las paletas se guardan localmente. Las recetas usan una aproximación sustractiva de Kubelka-Munk y son un punto de partida; confiá en tu ojo en el caballete.",
  },
  pwa: {
    updateAvailable: "Hay una nueva versión disponible.",
    update: "Actualizar",
    dismiss: "Descartar",
  },
  tabs: {
    match: "Match",
    image: "Imagen",
    extract: "Extraer",
    coach: "Coach",
    compare: "Comparar",
    mix: "Mezcla",
    logbook: "Bitácora",
    imglab: "IMG Lab",
    calibrate: "Calibrar",
    palette: "Paleta",
    scene: "Escena",
    settings: "Config",
    help: "Ayuda",
  },
  settings: {
    intro: "Preferencias de la app — todo se guarda en este navegador.",
    language: "Idioma",
    activePalette: "Paleta activa",
    recipeDefaults: "Valores por defecto de receta",
    recipeDefaultsHint:
      "Se aplican a todas las recetas de la app (los mismos controles que se ven en la receta).",
    aiTitle: "IA en la nube (Gemini)",
    aiKey: "API key de Gemini",
    aiKeyHint:
      "La usa la IA en la nube de IMG Lab. Se guarda solo en este navegador y se envía únicamente a Google.",
    getKey: "Conseguir una key gratis",
  },
  images: {
    title: "Imágenes activas",
    intro:
      "Las fotos que subís en Imagen, Comparar, Mezcla, Extraer, Coach y Calibrar se guardan acá para que persistan al recargar y (con el sync en la nube activo) te sigan a tus otros dispositivos.",
    count: "Imágenes guardadas: {n}",
    clear: "Vaciar imágenes activas",
    clearConfirm:
      "¿Eliminar todas las imágenes activas de este dispositivo y de la nube (si el sync está activo)? No se puede deshacer.",
  },
  cloud: {
    title: "Sync en la nube (opcional)",
    intro:
      "Sincronizá tus paletas, preferencias y bitácora (texto) entre dispositivos usando TU propio proyecto gratuito de Firebase. Iniciá sesión con la misma cuenta de Google en otro dispositivo para ver tus datos ahí. No compartís nada con nosotros — tus datos viven en tu proyecto de Firebase.",
    setupTitle: "Cómo configurarlo (una sola vez)",
    s1: "Creá un proyecto en la consola de Firebase (Add project).",
    s2: "Build → Firestore Database → Create database (modo Production).",
    s3: "Build → Authentication → Get started → activá el proveedor Google.",
    s4: "Authentication → Settings → Authorized domains → agregá el dominio de este sitio.",
    s5: "Project settings (engranaje) → Your apps → Web (</>) → registrá la app → copiá su firebaseConfig y pegalo abajo.",
    s6: "Firestore → Rules → pegá las reglas de abajo → Publish.",
    openConsole: "Abrir la consola de Firebase",
    rulesLabel: "Reglas de seguridad (pegá en Firestore → Rules):",
    configLabel: "Pegá acá tu firebaseConfig",
    configPh: 'const firebaseConfig = {\n  apiKey: "...",\n  authDomain: "...",\n  projectId: "...",\n  appId: "..."\n};',
    saveConfig: "Guardar config",
    configErr:
      "No se pudo leer — pegá el firebaseConfig completo (necesita apiKey, authDomain, projectId y appId).",
    configured: "Conectado al proyecto: {id}",
    removeConfig: "Quitar",
    signIn: "Iniciar sesión con Google",
    signOut: "Cerrar sesión",
    signedInAs: "Sesión iniciada como {email}",
    backup: "Respaldar en la nube",
    restore: "Restaurar de la nube",
    backupDone: "Respaldado en la nube ({kb} KB).",
    restoreConfirm:
      "Restaurar REEMPLAZARÁ las paletas, preferencias y bitácora de este navegador con la copia de la nube. ¿Continuar?",
    restoreNone: "Todavía no hay respaldo en la nube — respaldá primero.",
    restoreDone: "Restaurado. Recargando…",
    lastBackup: "Última sync: {when}",
    noBackup: "Aún no hay respaldo en la nube.",
    active: "Sync activo",
    activeHint:
      "Cuando está activo, este dispositivo carga tus datos de la nube al abrir y sube tus cambios automáticamente. Apagalo para trabajar solo en este dispositivo.",
    signInHint:
      "Iniciá sesión con la misma cuenta de Google que usás en tus otros dispositivos.",
    stSyncing: "Sincronizando…",
    stReady: "Al día",
    stError: "Sin conexión",
    syncNow: "Sincronizar ahora",
    workingLocal: "Sync apagado — trabajando solo en este dispositivo.",
    note: "Las fotos no se sincronizan (solo paletas, preferencias y texto de la bitácora). La config de Firebase y la sesión quedan en cada dispositivo — configuralas una vez por navegador.",
    err: "Error: {msg}",
  },
  scene: {
    title: "Escena / Zona",
    intro:
      "Analiza una zona dentro de toda la escena — no solo un píxel. Lee la temperatura de luces vs sombras de la referencia y sugiere una mezcla que lea bien en contexto (ej. enfriar una sombra bajo luz cálida). Es una guía, no la verdad — confiá en tu ojo.",
    upload: "Subí una referencia para analizar",
    uploadHint: "Después arrastrá un recuadro sobre una zona",
    selectHint: "Arrastrá un recuadro en la imagen para elegir la zona a analizar.",
    profileTitle: "Perfil de la escena",
    light: "Luz",
    shadow: "Sombra",
    key: "Clave",
    keyHigh: "alta",
    keyMid: "media",
    keyLow: "baja",
    pol_warmlight: "Luz cálida → sombras frías",
    pol_coollight: "Luz fría → sombras cálidas",
    pol_flat: "Luz plana / neutra",
    override: "Invertir temperatura de la luz",
    overrideHint: "Las fotos engañan — invertí si la luz se lee mal.",
    zoneTitle: "Esta zona",
    fam_light: "luz",
    fam_halftone: "media tinta",
    fam_shadow: "sombra",
    zoneFamily: "Se lee como",
    zoneChromaHi: "más saturada que la escena",
    zoneChromaLo: "menos saturada que la escena",
    zoneChromaEq: "similar a la saturación de la escena",
    adviceTitle: "Asistente",
    headlineAdjust: "Un ajuste de contexto la va a hacer encajar:",
    headlineOk: "Esta zona ya encaja bien con la luz de la escena.",
    tipCool:
      "Esta {family} se lee cálida para una escena de luz cálida — agregá ~{percent}% de {name} para enfriarla y que se asiente en sombra.",
    tipWarm:
      "Esta {family} se lee fría para una escena de luz fría — agregá ~{percent}% de {name} para entibiarla.",
    tipChroma:
      "Está más saturada que las sombras de la escena — bajá un poco el croma para que la forma gire.",
    val_light: "Mantenela claramente en la familia de luz (arriba del quiebre de valor).",
    val_halftone: "Es una media tinta — la transición; mantenela entre luz y sombra.",
    val_shadow: "Mantenela en la familia de sombra (debajo del quiebre de valor).",
    measured: "Medida (el píxel)",
    adjusted: "Ajustada a la escena",
    dragToStart: "Arrastrá un recuadro en la imagen para analizar una zona.",
  },
  imglab: {
    intro:
      "Trabajá una foto acá — ajustala, opcionalmente mejorala con IA y descargá el resultado para reusarlo. Después subí la imagen ya limpia en las otras pestañas para muestrear colores.",
    upload: "Subí una imagen para trabajar",
    uploadHint: "Ajustar · mejorar · descargar",
    adjustTitle: "Ajustes",
    adjustDesc:
      "Retoques locales y predecibles (sin IA). Ideales para color / balance de blancos, exposición y nitidez.",
    oilTitle: "Pintura al óleo (pictórico)",
    oilDesc:
      "Simplificá la foto en manchas planas como de pintura manteniendo los bordes nítidos — como si la referencia ya estuviera pintada al óleo. Menos decisiones de color, y más limpias, para igualar. Corre localmente (filtro Kuwahara, sin IA).",
    oilToggle: "Vista pictórica",
    oilMode_classic: "Clásico",
    oilMode_aniso: "Anisotrópico (GPU)",
    oilAnisoHint:
      "Las pinceladas se estiran siguiendo los bordes locales — un look más orgánico, pintado a mano. Corre en la GPU (WebGL2); si no está disponible cae silenciosamente al Clásico.",
    oilBrush: "Pincel",
    oilHint:
      "Pincel más grande = manchas más grandes, más simplificación. Combinalo con el Contraste de arriba, o con el Stencil de abajo para líneas de las formas simplificadas.",
    fxTitle: "Más filtros",
    fxDesc:
      "Filtros clásicos correctivos y artísticos — todos locales, sin IA. De a uno; las correcciones se aplican antes del filtro de óleo, el relieve impasto encima de él.",
    fxApplying: "Aplicando…",
    fxNone: "Ninguno",
    fxBilateral: "Suavizado acuarela (bilateral)",
    fxPosterize: "Posterizar valores (Lab)",
    fxXdog: "Líneas a tinta (XDoG)",
    fxClahe: "Recuperar sombras/luces (CLAHE)",
    fxFlatten: "Emparejar iluminación (retinex)",
    fxImpasto: "Relieve impasto",
    fxStrength: "Intensidad",
    fxRadius: "Radio",
    fxLevels: "Niveles",
    fxDetail: "Detalle",
    fxInk: "Tinta",
    fxClip: "Recorte",
    fxHint_bilateral:
      "Suavizado que respeta bordes — una simplificación más blanda y lavada que el filtro de óleo.",
    fxHint_posterize:
      "Cuantiza los VALORES (L*) en bandas manteniendo el color — la idea del notan, en color.",
    fxHint_xdog:
      "Línea orgánica tipo tinta (XDoG de Winnemöller) — más suave y dibujada a mano que el Stencil de abajo.",
    fxHint_clahe:
      "Recuperación de contraste local para referencias mal expuestas — vuelve el detalle en sombras y luces sin correr el color global.",
    fxHint_flatten:
      "Divide el campo de iluminación estimado para que una referencia iluminada de costado se lea pareja — los valores propios del objeto se juzgan más fácil.",
    fxHint_impasto:
      "Simula el grosor de la pasta iluminando el relieve de las pinceladas. Queda mejor encima del filtro de óleo.",
    stencilTitle: "Stencil (línea)",
    stencilDesc:
      "Convierte la foto en un dibujo de líneas limpio — contornos negros, sin color ni sombras (detección de bordes, sin IA). Ideal para calcar o transferir. Ajustá el detalle y descargá. Tip: subí el Contraste de arriba para líneas más limpias.",
    stencilToggle: "Stencil",
    stencilDetail: "Detalle",
    stencilThickness: "Grosor",
    stencilThicknessHint: "0.3 = fino · 1 = normal · más alto = grueso",
    aiExperimental: "La IA es experimental",
    aiWarning:
      "Las funciones de IA corren enteramente en tu computadora (sin servidor), así que usan mucha CPU/GPU y memoria. Pueden ser lentas, alterar colores y fallar en equipos modestos — si pasa, recargá la página o probá una imagen más chica.",
    enhanceTitle: "Mejora con IA — súper-resolución",
    enhanceDesc:
      "Agranda una imagen de baja resolución / pixelada y reconstruye detalle. La mejora se nota al hacer zoom; no ayuda en una foto ya nítida.",
    restoreTitle: "Restauración con IA",
    restoreDesc:
      "Limpia la foto en lugar de agrandarla: quita desenfoque, quita ruido o realza una exposición oscura.",
    run: "Ejecutar",
    cloudTitle: "IA en la nube — Gemini (Nano Banana)",
    cloudDesc:
      "Mejorá con el modelo de imagen Gemini de Google. Es generativo — puede cambiar colores y contenido, así que usalo para limpieza, no como referencia de color.",
    cloudKey: "Tu API key de Gemini",
    cloudKeyPh: "Pegá tu key de Google AI Studio",
    cloudGetKey: "Conseguir una key gratis",
    cloudKeyNote:
      "Tu key se guarda solo en este navegador y se envía únicamente a Google.",
    cloudInstruction: "Instrucción",
    cloudPromptDefault:
      "Aumentá la nitidez y reconstruí detalle fino, reducí ruido y artefactos de compresión; mantené los colores y el contenido fieles.",
    cloudRun: "Ejecutar IA en la nube",
    cloudNoKey: "Ingresá primero tu API key de Gemini.",
    cloudError: "Falló la IA en la nube.",
  },
  logbook: {
    title: "Bitácora",
    intro:
      "Guardá mezclas de color para un trabajo — un tono de piel, un cielo, una receta que querés volver a encontrar. Agrupalas en proyectos, adjuntá una foto del swatch o de referencia, y volvé otro día a retomar donde lo dejaste.",
    storage: {
      button: "¿Dónde se guardan mis datos?",
      title: "Dónde viven tus datos",
      close: "Entendido",
      intro:
        "Pigment Match no tiene backend — todo queda en este dispositivo, en este navegador. Nunca se sube nada a un servidor ni a la nube.",
      localTitle: "localStorage del navegador",
      localBody:
        "Tus paletas, la calibración y las preferencias de idioma / visualización.",
      idbTitle: "IndexedDB del navegador (base de datos local)",
      idbBody:
        "La Bitácora — proyectos, colores y sus fotos (guardadas como imágenes compactas).",
      cautionsTitle: "Cosas a tener en cuenta",
      caution1:
        "Los datos se guardan por navegador y por dispositivo — no se sincronizan. Lo que guardás en un navegador no aparece en otro, ni en tu teléfono.",
      caution2:
        "Borrar los datos de navegación / “cookies y datos de sitios” de este sitio los elimina. Cuidado con los limpiadores de navegador.",
      caution3:
        "Las ventanas privadas / incógnito suelen olvidar todo al cerrarse.",
      caution4:
        "Reinstalar el navegador o cambiar de dispositivo los pierde — salvo que hayas exportado un respaldo.",
      backupTitle: "Respaldar y recuperar",
      backupBody:
        "Usá Exportar (arriba) para descargar toda tu Bitácora, fotos incluidas, en un único archivo .json — guardalo en un lugar seguro (un drive en la nube, enviado a tu propio correo, un pendrive). Usá Importar para volver a cargarlo, o para llevarlo a otro navegador o dispositivo. Las paletas tienen su propio Exportar / Importar en la pestaña Paleta.",
      tip: "Buen hábito: exportá después de una sesión grande, igual que guardarías un archivo.",
    },
    projects: "Proyectos",
    newProject: "Nuevo proyecto",
    projectName: "Nombre del proyecto",
    projectNamePh: "ej. Retrato por encargo",
    projectNotesPh: "Notas sobre este proyecto (opcional)",
    noProjects:
      "Todavía no hay proyectos. Creá uno para empezar a registrar tus mezclas.",
    rename: "Renombrar",
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    confirmDeleteProject:
      "¿Eliminar este proyecto y todos sus colores? No se puede deshacer.",
    confirmDeleteEntry: "¿Eliminar este color?",
    export: "Exportar",
    import: "Importar",
    pdf: "PDF",
    pdfGenerated: "Generado con Pigment Match",
    exportEmpty: "Todavía no hay nada para exportar.",
    importError: "No se pudo leer ese archivo de bitácora.",
    imported: "Se importaron {n} proyecto(s).",
    entries: "Colores",
    noEntries: "Todavía no hay colores registrados en este proyecto.",
    projectReference: "Foto de referencia",
    projectFinished: "Cuadro terminado",
    addColor: "Agregar color",
    editColor: "Editar color",
    colorName: "Nombre del color",
    colorNamePh: "ej. Piel caucásica genérica",
    recipe: "Mezcla / receta",
    recipePh: "ej. 5 Blanco de Titanio · 1 Ocre Amarillo · toque Rojo Cadmio · mínimo Tierra Sombra Tostada",
    notes: "Notas",
    notesPh: "Luz, dónde se usa, qué ajustar… (opcional)",
    chipColor: "Color del swatch (opcional)",
    refPhoto: "Foto de referencia",
    swatchPhoto: "Foto del swatch",
    addPhoto: "Agregar foto",
    replacePhoto: "Reemplazar",
    removePhoto: "Quitar",
    saveColor: "Guardar color",
    pickFromSwatch: "Tomar color de la foto del swatch",
    count: "{n} color(es)",
    untitled: "Sin título",
    unnamed: "Color sin nombre",
  },
  camera: {
    use: "Cámara",
    title: "Sacar una foto",
    capture: "Capturar",
    flip: "Cambiar cámara",
    cancel: "Cancelar",
    starting: "Iniciando cámara…",
    denied:
      "Se bloqueó el acceso a la cámara. Permití el permiso de cámara para este sitio en tu navegador y volvé a intentar.",
    error: "No se pudo acceder a una cámara en este dispositivo.",
  },
  mix: {
    referenceTitle: "Referencia — hacé clic en el color a igualar",
    mixTitle: "Tu mezcla en la paleta — hacé clic en la pintura",
    prompt: "Muestreá un color de cada imagen para comparar valor y color.",
    reference: "Referencia",
    yourMix: "Tu mezcla",
    valueHeading: "Valor",
    colorHeading: "Color y consejos",
    grayscale: "Escala de grises — juzgá los valores",
    showGrayscale: "Mostrar grises (recortado a lo que muestreaste)",
    probeHint:
      "Movete sobre la referencia — el cuadradito es el valor de tu mezcla. Donde se funde, tu valor coincide.",
    lighter: "tu mezcla está más clara",
    darker: "tu mezcla está más oscura",
    sameValue: "los valores coinciden",
    deltaLabel: "ΔL {n}",
  },
  required: {
    title: "Tubos obligatorios",
    hint: "Forzá tubos específicos dentro de la receta — vos conocés tu base (p. ej. una piel desde Pale Rose Blush agrisada con Raw Umber) y querés que la mezcla se construya alrededor de eso.",
    add: "Agregar un tubo…",
    note: "La receta queda obligada a mantener cada tubo fijado en una proporción significativa (≥2%). El match % refleja honestamente la mezcla restringida — una fijación dura puede costar algo de exactitud.",
  },
  manual: {
    title: "Manual de usuario (PDF)",
    desc: "La guía completa de todas las funcionalidades — con ejemplos prácticos e ilustraciones dibujadas desde el motor de mezcla real. Se genera en tu idioma actual.",
    download: "Descargar manual",
    generating: "Generando…",
  },
  chart: {
    title: "Carta de calibración",
    intro:
      "Calibrá toda la paleta de una pasada: descargá la carta, pintá cada parcela con el tubo que indica (capas gruesas y opacas), fotografiá la hoja plana con luz pareja, subí la foto, alineá las esquinas del borde grueso y leela. Cada parcela se convierte en una observación — masstones más tintes 1:3 con blanco — con balance de blancos automático contra la parcela de papel en blanco.",
    download: "Descargar carta (PDF)",
    uploadPhoto: "Subir foto de la carta pintada",
    replacePhoto: "Reemplazar foto",
    alignHint:
      "Arrastrá las cuatro manijas hasta las esquinas del borde grueso de la carta.",
    read: "Leer la carta",
    preview: "Parcelas leídas ({n} observaciones)",
    classify:
      "{add} nuevas · {exact} ya registradas (se omiten) · {conflict} misma mezcla pero otro color (se te va a preguntar).",
    conflictIntro:
      "{n} de estas mezclas ya están registradas con un color DISTINTO. Para cada una, conservá la que tenés o reemplazala por la lectura de esta carta.",
    conflictExisting: "Registrada",
    conflictChart: "Esta carta",
    conflictKeep: "Conservar la registrada",
    conflictReplace: "Usar la de la carta",
    addObs: "Agregar {n} observaciones",
    added: "Observaciones agregadas",
    addedSummary: "Se agregaron {added}, se omitieron {skipped} duplicado(s) exacto(s).",
    next: "Ahora tocá Calibrar abajo (opcionalmente con “ajustar también el color”) para ajustar la paleta.",
    pdfTitle: "Pigment Match — Carta de calibración",
    pdfIntro:
      "Pintá cada parcela con el tubo que la etiqueta indica (tintes: mezclá 1 parte de pigmento + 3 partes de blanco). Usá pintura gruesa y opaca y quedate dentro de los recuadros. Dejá la parcela PAPEL sin pintar. Fotografiá la hoja entera plana, con luz de día pareja y sin brillos.",
    pdfPaper: "PAPEL — dejar en blanco",
  },
  contrast: {
    title: "Contraste simultáneo",
    inPlace: "En su entorno",
    onWhite: "Sobre blanco",
    onGray: "Sobre gris",
    note:
      "Los tres cuadrados centrales son EL MISMO color muestreado — el entorno cambia cómo se lee. Si una mezcla numéricamente correcta se ve mal en tu cuadro, juzgala contra sus vecinos, nunca sobre la paleta blanca.",
  },
  gamut: {
    show: "Ver por qué (mapa de gamut)",
    hide: "Ocultar mapa de gamut",
    legend:
      "Tus pigmentos en el plano matiz/croma (a*/b*): las mezclas solo pueden caer dentro del territorio sombreado. La cruz es el objetivo; el anillo hueco es el tubo sugerido que extendería el territorio hacia él. El valor (claro/oscuro) no se muestra acá.",
    axisWarm: "rojo / cálido →",
    axisYellow: "amarillo ↑",
    axisGreen: "← verde",
    axisBlue: "azul ↓",
  },
  valueStudy: {
    title: "Estudio de valores (notan)",
    intro:
      "La imagen reducida a sus grandes masas de valor — como se empieza un cuadro de verdad. Elegí cuántos planos, y hacé clic en un plano para ver la mezcla que da su color promedio con tu paleta.",
    empty: "Subí una imagen en el extractor de arriba para armar el estudio de valores.",
    planes: "Planos",
    recipeFor: "Mezcla para este plano (valores L* {lo}–{hi})",
  },
  strings: {
    title: "Escala de valor (color string)",
    intro:
      "La escala luz→sombra premezclada de esta mezcla: los pasos claros agregan tu blanco, los oscuros agregan un tubo oscuro de la misma familia (una tierra para la piel, no negro — el negro solo engrisa el color). Hacé clic en un paso para ver sus proporciones.",
    darkenWith: "Oscurecer con",
    baseDot: "Mezcla base",
    baseStep: "La mezcla base — la receta de arriba.",
    addStep: "Mezcla base + {percent}% de {name} (del total).",
    tip: "Los números en los swatches son el valor (L*). Premezclá estos montoncitos antes de la sesión y no vas a perseguir un valor a mitad de pincelada.",
    none: "Agregá al menos dos pigmentos disponibles (idealmente con un blanco) para armar la escala.",
  },
  match: {
    targetColor: "Color objetivo",
    sampleFromImage: "Muestrear de imagen",
    sampledColor: "Color muestreado",
    picker: "Selector",
    eyedropper: "Pantalla",
    eyedropperHint:
      "Tomá un color de cualquier parte de tu pantalla — otra ventana, una imagen de referencia, un video pausado. Esc cancela.",
  },
  recipe: {
    title: "Receta de mezcla",
    usingPalette: "Paleta: {name}",
    none: "No hay pigmentos en esta paleta. Agregá algunos para generar una receta.",
    adjustments: "Ajustes",
    of: "de",
    mixed: "Mezcla",
    match: "match",
    value: "Valor",
    maxColorsAuto: "Auto",
    maxColorsN: "≤{n}",
    maxColorsTitle: "Limitar cuántos pigmentos usa la receta",
    valuePriority: "Prioriza valor",
    valuePriorityTitle:
      "Al usar menos colores, mantiene el valor (luminosidad) cerca y deja correr matiz/saturación",
    golden: "Proporción áurea",
    goldenTitle:
      "Reajusta las proporciones a la secuencia de Fibonacci (proporción áurea) — una restricción artística. La mezcla suele alejarse del objetivo; los % de match/valor lo reflejan.",
    goldenModalTitle: "Proporción áurea — experimental",
    goldenModalBody:
      "Esto reajusta la mezcla a proporciones de Fibonacci. El color resultante y su valor van a quedar notablemente LEJOS del objetivo, así que los porcentajes de match y valor van a bajar. Es un stretch puramente artístico — NO mejora en nada la exactitud de la mezcla.",
    goldenModalNerd:
      "Es solo un detalle nerd que quise incluir. ¿La activás igual?",
    goldenModalEnable: "Activar igual",
    goldenModalCancel: "Cancelar",
    batch: "Preparar",
    unitMl: "ml",
    unitG: "g",
    unitDrops: "gotas",
    batchHint: "Reparte la receta en cantidades reales para mezclar",
    batchNote: "repartido por proporción",
    batchHelpTitle: "Cómo medir",
    batchHelpParts:
      "Partes — relativo: apretá gusanos de igual grosor y comparás sus largos, o contás cargas de espátula. Lo mejor para óleo / heavy body.",
    batchHelpGrams:
      "Gramos — pesá cada bolita en una balanza digital chica. Repetible, y sirve para óleo.",
    batchHelpFluid:
      "ml / gotas — para medios fluidos (acrílico fluido, tinta, acuarela). No práctico para la pasta del óleo — ahí usá partes o gramos.",
    part: "parte",
    parts: "partes",
    partsLabel: "Partes",
    simple: "Simple",
    precise: "Preciso",
    classic: "Classic",
    spectral: "Spectral",
    "small touch": "toque pequeño",
    "tiny touch": "toque mínimo",
    "microscopic touch": "toque microscópico",
  },
  saveRecipe: {
    button: "Guardar en Bitácora",
    title: "Guardar mezcla en Bitácora",
    project: "Proyecto",
    newProject: "＋ Nuevo proyecto",
    newProjectName: "Nombre del nuevo proyecto",
    defaultProject: "Proyecto sin título",
    name: "Nombre",
    recipe: "Receta",
    notes: "Notas",
    notesTarget: "Objetivo",
    save: "Guardar",
    cancel: "Cancelar",
    saved: "Guardado en la Bitácora",
  },
  reach: {
    warn: "Tu paleta no llega del todo a este color.",
    suggest: "Agregar {name} podría acercarte (→ {match}%).",
    noSuggest: "Probá agregar o editar pigmentos, o cambiar de paleta.",
  },
  plan: {
    button: "¿Qué tubos necesito?",
    hint: "El conjunto mínimo de pigmentos que puede mezclar estos colores.",
    result: "Con estos {n} tubos podés mezclar tu paleta:",
    partial: "Lo más cerca posible — algunos colores quedan fuera de alcance.",
    use: "Usar estos tubos",
    useHint:
      "Crea una paleta con estos pigmentos y la activa, así las recetas se recalculan con ellos.",
    newPaletteName: "Paleta planificada",
  },
  harmony: {
    title: "Armonías de color",
    complement: "Complementario",
    analogA: "Análogo −",
    analogB: "Análogo +",
    triadA: "Tríada +",
    triadB: "Tríada −",
    howToMix: "Cómo mezclarlo",
  },
  onboarding: {
    title: "Bienvenido a Pigment Match",
    s1Title: "Igualá cualquier color",
    s1Body:
      "Tipeá, elegí o muestreá un color y obtené una receta de mezcla con pigmentos reales — descripta en términos de pintor (valor, temperatura, saturación), no solo números.",
    s2Title: "Desde un color, una foto o un cuadro",
    s2Body:
      "Igualá un color directo, muestrealo de una foto en la pestaña Imagen, o sacá una paleta entera de un cuadro en Extraer (y mirá qué tubos necesitarías).",
    s3Title: "Hacela tuya",
    s3Body:
      "En Paleta, definí tus tubos reales — color, subtono y fuerza tintórea. Calibrar afina el modelo con mezclas que hiciste de verdad. La precisión empieza acá.",
    s4Title: "Cerrá la brecha en el caballete",
    s4Body:
      "Coach, Comparar y Mezcla te ayudan a afinar mientras pintás, y la Bitácora guarda tus mezclas. Config y Ayuda son los íconos de arriba a la derecha.",
    skip: "Saltar",
    back: "Atrás",
    next: "Siguiente",
    start: "Empezar",
    replay: "Ver la intro de nuevo",
  },
  share: {
    title: "Compartir esta paleta",
    intro:
      "Este link lleva la paleta entera (sus pigmentos) — sin cuenta ni subida. Abrilo en otro dispositivo para importarla.",
    copy: "Copiar",
    copied: "Copiado",
    qrHint: "Escaneá para abrir en el teléfono",
    tooBig:
      "Esta paleta es demasiado grande para un QR escaneable — usá el link.",
    note: "La paleta viaja dentro del propio link; no se sube nada a ningún lado.",
    importTitle: "¿Importar paleta compartida?",
    importBody: '¿Agregar "{name}" ({n} pigmentos) a tus paletas?',
    importAdd: "Importar",
    importDismiss: "Ahora no",
  },
  recipeHelp: {
    button: "¿Qué hacen estas opciones?",
    title: "Opciones de receta",
    close: "Entendido",
    modelTitle: "Modelo de mezcla — Classic / Spectral",
    modelIntro: "Cómo la app predice el color que va a dar una mezcla.",
    classic:
      "Classic (por defecto): rápido y confiable — una aproximación de Kubelka-Munk de una sola constante por canal de color. Es el punto de partida recomendado.",
    spectral:
      "Spectral (experimental): reconstruye una curva de reflectancia completa para cada pigmento y la mezcla a lo largo del espectro de luz, así que es más detallado físicamente. Puede igualar mejor algunas mezclas, pero en colores difíciles con paleta limitada a veces da un poco peor, y es algo más lento. Cambiá a él para comparar.",
    km2:
      "2-const (experimental): un Kubelka-Munk de dos constantes que usa la opacidad de cada pigmento como su dispersión — así los tubos opacos dominan una mezcla más que los transparentes de igual fuerza tintórea. Aproximado (la opacidad es estimada, no medida); probalo para comparar.",
    modeTitle: "Detalle — Simple / Preciso",
    modeIntro: "Cuántos pigmentos puede usar la receta.",
    simple:
      "Simple (por defecto): prefiere menos pigmentos — una mezcla práctica que realmente podés preparar. Descarta cualquier pigmento que, al quitarlo, casi no cambie el color.",
    precise:
      "Preciso: exprime el menor error de color posible, aunque eso sume algún toque extra.",
    unitTitle: "Unidades — Partes / %",
    unitIntro: "Cómo se muestran las cantidades.",
    parts:
      "Partes: proporciones de pintor (1 parte de blanco, 2 partes de ocre…), con las cantidades más chicas escritas como toques.",
    percent:
      "%: cada pigmento como porcentaje de toda la mezcla — suman 100, y todo lo menor a 1% se muestra como <1%.",
    limitTitle: "Menos colores / Prioriza valor (opcional)",
    limitIntro:
      "Para una mezcla más artística y limitada. Ambos están apagados por defecto — si los dejás así, las recetas funcionan igual que antes.",
    maxColors:
      "Máx colores (Auto / ≤2 / ≤3 / ≤4): limita cuántos pigmentos usa la receta. El color puede quedar más lejos, pero la mezcla es más simple y práctica.",
    valueFirst:
      "Prioriza valor: al usar menos colores, mantiene el valor (luminosidad) cerca y deja correr el matiz/saturación — útil cuando el valor importa más que igualar el color exacto. El número ΔL muestra qué tan cerca está el valor.",
    readoutsTitle: "Los dos puntajes — Match y Valor",
    readoutsIntro:
      "Al pie de la receta. Ambos son porcentajes con los mismos colores: verde ≥90% (muy bien), ámbar ≥75% (cerca), rojo por debajo.",
    matchReadout:
      "Match (ΔE): qué tan cerca está el color en general — matiz, croma y valor juntos. ΔE es el error perceptual crudo (más bajo es mejor).",
    valueReadout:
      "Valor (ΔL): qué tan cerca está solo el valor (luminosidad) — a menudo lo más importante en una pintura. 90% ≈ ΔL 2 (casi imperceptible), 75% ≈ ΔL 5. ΔL es la diferencia de luminosidad en escala 0–100.",
  },
  analysis: {
    title: "Análisis de pintor",
    value: "Valor",
    temperature: "Temperatura",
    saturation: "Saturación",
    hue: "Tendencia de matiz",
    Light: "Claro",
    Medium: "Medio",
    Dark: "Oscuro",
    Warm: "Cálido",
    Neutral: "Neutro",
    Cool: "Frío",
    High: "Alta",
    Low: "Baja",
    "Very low": "Muy baja",
    Reddish: "Rojizo",
    Orange: "Naranja",
    Yellowish: "Amarillento",
    Green: "Verde",
    Blue: "Azul",
    Violet: "Violeta",
    grey: "gris",
    lightGrey: "gris claro",
    deepGrey: "gris profundo",
    light: "claro",
    midValue: "de valor medio",
    dark: "oscuro",
    veryLowSat: "saturación muy baja",
    lowSat: "baja saturación",
    medSat: "moderadamente saturado",
    highSat: "muy saturado",
    neutralTemp: "neutro en temperatura",
    slightly: "ligeramente",
    tendency: "con una leve tendencia al {hue}",
    sentence: "Un {noun} de {sat}, {temp}{tendency}.",
  },
  variations: {
    title: "Variaciones",
    Lighter: "Más claro",
    Darker: "Más oscuro",
    Warmer: "Más cálido",
    Cooler: "Más frío",
    "More saturated": "Más saturado",
    "Less saturated": "Menos saturado",
  },
  variationRecipe: {
    link: "Cómo mezclarlo",
    heading: "Cómo llegar a esta variación",
    baseTitle: "Partí de tu mezcla base",
    adjustTitle: "Después ajustá hacia {label}",
    fromBase: "Preparás tu color base y después lo empujás:",
    nothing: "Ya está ahí — no hace falta cambiar nada.",
    close: "Cerrar",
  },
  image: {
    uploadTitle: "Subí una imagen para muestrear colores",
    uploadHint: "Hacé clic en cualquier punto para tomar un color",
    brush: "Pincel",
    brushTitle:
      "Área de muestreo: 0 = un píxel (por defecto). Más alto promedia un cuadrado, así un clic en una zona con detalle da un color representativo.",
    avg: "Promediar",
    avgHint:
      "Promediá varias tomas: cada clic agrega una toma y el resultado es la media acumulada — mucho más confiable que un solo clic en una foto de celular con ruido. Hacé clic en 3-5 puntos del mismo swatch.",
    avgCount: "{n}× · ±{d} ΔE",
    avgSpreadHint:
      "Cantidad de tomas y cuánto difieren entre sí (peor ΔE contra la media). Una dispersión grande significa foto con ruido — tomá más muestras o usá un pincel más grande.",
    avgClear: "Limpiar tomas",
    wb: "Balance de blancos",
    wbPicking: "Hacé clic en una tarjeta blanca/gris",
    wbHint:
      "Corregí el tinte de color de tu teléfono: poné una tarjeta blanca o gris en la misma foto y con la misma luz, hacé clic en ella acá y después tomá tu color. Cada muestra se neutraliza contra ella.",
    wbActive: "BdB activo",
    wbActiveHint:
      "Los colores tomados se corrigen contra tu tarjeta de referencia. Subir una foto nueva lo reinicia.",
    wbKeepValue: "Conservar valor",
    wbKeepValueHint:
      "Corrige solo el tinte de color y mantiene la luminosidad (valor) del color muestreado. Apagado = corrección completa, que también puede aclarar/oscurecer el color.",
    wbClear: "Quitar la referencia de balance de blancos",
    compareTitle: "Comparar con tu swatch",
    compareHint:
      "Subí una foto de tu swatch pintado y hacé clic para compararlo con el color objetivo de arriba.",
    compareHowTo: "Cómo llegar al objetivo desde tu muestra",
    replace: "Reemplazar imagen",
    zoom: "Zoom",
    zoomOn: "Zoom activado",
    zoomOff: "Zoom desactivado",
    adjust: "Ajustes",
    sharpen: "Nitidez",
    brightness: "Brillo",
    contrast: "Contraste",
    saturation: "Saturación",
    temperature: "Temperatura",
    reset: "Reset",
    adjustHint:
      "Los ajustes te ayudan a leer la imagen; el color que tomás sale de la vista ajustada.",
    ai: "Mejorar (IA)",
    aiBusy: "Mejorando…",
    aiError:
      "Falló la mejora con IA — probablemente la GPU se quedó sin memoria (se perdió el contexto WebGL). Recargá la página y probá de nuevo con una imagen más chica o el factor 2x. Algunos equipos no pueden ejecutarlo.",
    aiTitle:
      "Experimental: agranda la imagen con IA (se descarga la primera vez). Puede alterar colores — muestreá con cuidado.",
    aiModel: "Modelo de IA — más potente = más detalle visible, pero más pesado y lento",
    aiFast: "Rápido",
    aiBetter: "Mejor",
    aiBest: "Máx",
    aiBigNote:
      "Esta imagen ya es de alta resolución — la mejora con IA no aportará mucho (sirve para fotos de baja resolución / borrosas).",
    restore: "Restaurar (IA)",
    restoreTitle:
      "Restauración con IA experimental: desenfoque / ruido / luz. Descarga pesada la primera vez, lenta, resultados variables — puede alterar colores.",
    restoreModel: "Tipo de restauración",
    rDeblur: "Desenfoque",
    rDenoise: "Ruido",
    rLowlight: "Luz",
    processing: "Procesando…",
    download: "Descargar",
  },
  extract: {
    title: "Extracción de paleta",
    upload: "Subí una pintura",
    colors: "{n} colores",
    extracting: "Extrayendo…",
    prompt:
      "Subí una pintura para extraer sus colores dominantes, ordenados de claro a oscuro — cada uno con su receta de mezcla y una descripción de pintor.",
    colorN: "Color #{n}",
    mapView: "Mapa de color",
    wholeImage: "Toda la imagen",
    invert: "Invertir",
    invertHint:
      "Extrae de todo MENOS el recuadro dibujado — p. ej. encuadrá el fondo para dejarlo afuera.",
    selectHint:
      "Tip: arrastrá un recuadro sobre la imagen para extraer colores solo de esa zona.",
    and: "y",
    lightening: "aclarándolo",
    darkening: "oscureciéndolo",
    hintAdd: "Cercano a {from} — llegás agregando un toque de {push}{extra}.",
    hintAdjust: "Cercano a {from} — llegás {extra}.",
    hintVeryClose: "Muy cercano a {from}.",
    coolBlue: "un azul frío",
    warmYellow: "un amarillo cálido",
    aRed: "un rojo",
  },
  coach: {
    title: "Coach",
    target: "Color objetivo",
    yourMix: "Tu mezcla actual",
    sampleFromPhoto: "Muestrear de foto",
    enterManually: "Ingresar a mano",
    quantTitle: "¿Cuánto exactamente?",
    quantBatch: "Mi montón es de unos",
    quantAdvice:
      "Agregá ~{amount} {unit} de {name} a tu montón de {batch} {unit} (≈{percent}% de la mezcla final).",
    quantRatio:
      "Agregá 1 parte de {name} por cada {n} partes de tu montón. Una “parte” es cualquier medida constante — una punta de espátula, un poroto.",
    quantResult: "Resultado previsto: el match pasa de {before}% → {match}%.",
    quantNote:
      "Es una estimación — la fuerza tintórea real de tu montón no se conoce. Agregá en 2-3 pasos y volvé a muestrear; los pigmentos fuertes (ftalos, dioxazina) rinden muchísimo.",
    unit_parts: "partes",
    unit_ml: "ml",
    unit_g: "g",
    unit_drops: "gotas",
    footer:
      "Agregá color de a poquito y volvé a muestrear — igualar un color son siempre varias correcciones chicas, nunca una grande.",
    headlineThere: "Llegaste — la diferencia es casi imperceptible.",
    headlineVeryClose: "Muy cerca — solo ajustá un poco desde acá.",
    headlineClose: "Cerca. Un par de ajustes y lo tenés.",
    headlineFar: "Todavía no — seguí estos pasos en orden.",
    done: "Aplicalo y confiá.",
    subtle: "Las diferencias son sutiles — ajustá a ojo en pasos mínimos.",
    much: "muy ",
    aBit: "un poco ",
    slightly: "ligeramente ",
    tooDark: "Tu mezcla está {mag}oscura — levantá el valor con {pig}.",
    tooLight:
      "Tu mezcla está {mag}clara — bajá el valor con un toque de {pig}.",
    tooSat:
      "Está {mag}saturada — bajala con un toque de {pig}.",
    tooDull: "Está {mag}gris — intensificala con más {pig}.",
    hueWarmer:
      "El matiz está corrido — necesita ir más cálido. Empujalo con un toque de {pig}.",
    hueCooler:
      "El matiz está corrido — necesita ir más frío. Empujalo con un toque de {pig}.",
    fineTune: "Casi — empujalo con un toque mínimo de {pig}.",
    white: "blanco",
    darkPigment: "un pigmento oscuro",
    neutralEarth: "un tierra / neutro",
    satPigment: "un pigmento saturado",
    rightPigment: "el pigmento adecuado",
  },
  palette: {
    title: "Paleta de pigmentos",
    subTitle: "Sustituto de tubo",
    subIntro:
      "¿Se te acabó un tubo a mitad de cuadro? Elegilo y mirá cómo aproximarlo mezclando los tubos que te quedan — más el tubo único más parecido de la librería, como sugerencia de compra.",
    subPick: "Elegí el tubo que se te acabó…",
    subMix: "Mezclalo con tus otros tubos",
    subMixPoor:
      "Esa mezcla es una aproximación gruesa — este pigmento es difícil de alcanzar con el resto de tu paleta.",
    subNoMix: "No hay otros tubos disponibles para mezclar.",
    subBuy: "Tubo único más parecido (librería)",
    subMatch: "match {match}%",
    masstoneTitle: "Fijá el color real de cada pigmento",
    masstoneNote:
      "Las recetas se construyen a partir del color base (el masstone) de cada pigmento, así que la precisión empieza acá. Los valores que vienen cargados son estimaciones informadas — para el mejor resultado, fijá el color real de cada tubo: pintá un swatch puro, fotografialo con buena luz, muestrealo en la pestaña Imagen y copiá ese HEX en el pigmento (o hacé clic en su cuadrado de color). Hacé lo mismo cada vez que agregues o crees una pintura. La calibración solo ajusta la fuerza tintórea, no el color — el masstone se define acá.",
    label: "Paleta",
    nameLabel: "Nombre",
    addPreset: "Agregar preset…",
    new: "Nueva",
    reset: "Reset",
    delete: "Eliminar",
    export: "Exportar",
    import: "Importar",
    importError: "No se pudo leer ese archivo de paleta.",
    addNew: "Agregar pigmento nuevo",
    addFromLibrary: "Agregar de la biblioteca",
    newPigment: "Pigmento nuevo",
    opacity: "Opacidad",
    strength: "Fuerza tintórea",
    share: "Compartir",
    undertone: "Subtono (undertone)",
    undertoneAdd: "＋ Agregar subtono",
    undertoneClear: "Quitar",
    undertoneNote:
      "Opcional. El color que muestra este pigmento en capa fina y transparente sobre blanco (una raspada finita) — suele ser un tono más limpio y corrido: ultramar → violeta, ftalo → cian. Elegilo, o tomalo de una foto de esa raspada. Es el hue saturado, no un tinte claro — el modelo lo aclara a medida que el pigmento es una parte más chica de la mezcla.",
    temperature: "Temperatura",
    warm: "cálido",
    cool: "frío",
    neutral: "neutro",
    edit: "Editar",
    hide: "Ocultar",
    colorFromPhoto: "Color desde una foto de swatch",
    sampleColor: "Tomar de foto",
    available: "Disponible — se usa en las sugerencias",
    unavailable: "No disponible — se ignora en las sugerencias",
    out: "fuera",
    inPalette: "en paleta",
    add: "Agregar",
    librarySearch: "Buscar pigmentos en todos los presets…",
    noMatch: "Ningún pigmento coincide con “{q}”.",
  },
  calibrate: {
    title: "Mezcla calibrada",
    intro:
      "Enseñale el modelo a tus pinturas reales. Registrá unas mezclas que hayas hecho y calibrá — mientras esté activo, todas las recetas usan el modelo ajustado.",
    enableHint:
      "Registrá observaciones abajo y apretá Calibrar para activarlo.",
    avgBefore: "Error promedio antes:",
    after: "después:",
    active: "Activo en todo",
    ready: "Listo — activá el toggle para usarlo",
    suggestTitle: "Próximas mezclas sugeridas",
    suggestHint:
      "Las mezclas más informativas para registrar ahora — los tintes con blanco revelan la fuerza real de cada pigmento, los pares fijan cómo interactúan. Hacé clic en una para precargar las partes; después mezclala, fotografiala y registrá el color.",
    suggestTint: "Un tinte 1:3 con blanco — es lo que mejor revela la fuerza tintórea de este pigmento.",
    suggestPair: "Un par 1:1 — fija cómo interactúan estos dos en una mezcla.",
    recordTitle: "Registrá una mezcla que hiciste",
    recordHint:
      "Ingresá las partes que usaste de cada pigmento y fijá el color real que obtuviste (escribilo o muestrealo de una foto del swatch).",
    mixNoteTitle: "Registrá mezclas, no pigmentos solos",
    mixNote:
      "Un pigmento solo no le enseña nada al modelo sobre la fuerza tintórea — la fuerza solo se manifiesta en mezclas (un pigmento solo siempre predice su propio masstone, sea cual sea su fuerza). Las observaciones más útiles son un pigmento mezclado con blanco en una proporción conocida — ej. 1 blanco + 0.5 ocre, o 1 blanco + un toque de ultramar (los colores fuertes necesitan muy poco). Cubrí cada pigmento en al menos una mezcla con blanco, y sumá cualquier mezcla que la app hoy prediga mal. Nota: esto ajusta solo la fuerza tintórea — el color base del pigmento se fija en la pestaña Paleta.",
    realColor: "Color real que obtuviste",
    got: "obtenido",
    model: "modelo",
    removedPigment: "pigmento eliminado",
    addObservation: "Agregar observación",
    observations: "Observaciones ({n})",
    clearAll: "Borrar todo",
    noObs:
      "Sin observaciones todavía. Registrá unas mezclas arriba — tres o más da el mejor ajuste.",
    modelAway: "el modelo está a ΔE {de}",
    calibrate: "Calibrar",
    recalibrate: "Recalibrar",
    fitColor:
      "Ajustar también el color (masstone / subtono), no solo la fuerza tintórea — corre el color de cada pigmento hacia tus tubos reales. Necesita unas cuantas observaciones buenas.",
    fromN: "desde {n} {word}",
    obsSingular: "observación",
    obsPlural: "observaciones",
    discard: "Descartar calibración",
    sampleFromPhoto: "Muestrear de foto",
    enterManually: "Ingresar a mano",
  },
  compare: {
    title: "Comparación",
    uploadRef: "Subí la referencia / original",
    uploadWip: "Subí tu pintura en curso",
    alignTitle: "Alineá — arrastrá los 4 puntos a las esquinas de cada cuadro",
    reference: "Referencia",
    yourPainting: "Tu pintura",
    analyze: "Analizar diferencias",
    replace: "Reemplazar",
    startOver: "Empezar de nuevo",
    normalize: "Normalizar luz (ignorar diferencias de exposición/BB)",
    overlay: "Superponer",
    values: "Valores",
    color: "Color",
    regionCoach: "Coach por zona",
    palettes: "Paletas",
    scorecard: "Puntaje",
    swipe: "deslizar",
    onion: "opacidad",
    paintingOpacity: "Opacidad de la pintura",
    squint: "Entrecerrar",
    overlayHint: "Izquierda/abajo = referencia · derecha/arriba = tu pintura.",
    grayscale: "Escala de grises (valor)",
    notanSteps: "Pasos de notan",
    notan: "Notan (masas de valor posterizadas)",
    valueDiff: "Diferencia de valor",
    valueDist: "Distribución de valor",
    histHint:
      "Naranja = referencia, blanco = tu pintura. Un rango angosto = valores lavados.",
    overallDE: "General (ΔE)",
    temperature: "Temperatura",
    saturation: "Saturación",
    hue: "Matiz",
    diffSuffix: " — diferencia",
    pickHint: "Hacé clic en la referencia para criticar esa zona.",
    pickPrompt: "Elegí una zona para ver cómo compara tu pintura ahí.",
    refLabel: "referencia",
    yoursLabel: "tuya",
    refPalette: "Paleta de la referencia",
    yourPalette: "Tu paleta",
    paletteHint:
      "Ambas ordenadas de claro a oscuro. Compará qué familias faltan o están corridas.",
    valueAccuracy: "Precisión de valor",
    colorAccuracy: "Precisión de color",
    valueBias: "Sesgo de valor",
    tempBias: "Sesgo de temperatura",
    satBias: "Sesgo de saturación",
    meanError: "Error de color medio",
    tip: "Tip: el valor (claro/oscuro) y la comparación relativa son lo más confiable — el color y la luz de las fotos nunca son exactos. Usalo como guía.",
    tooDark: "muy oscuro",
    tooLight: "muy claro",
    tooCool: "muy frío",
    tooWarm: "muy cálido",
    underSat: "sub-saturado",
    overSat: "sobre-saturado",
    onHue: "matiz ok",
    hueOff: "matiz muy corrido",
    matches: "coincide",
    veryDiff: "muy distinto",
    neutral: "neutro",
    darker: "más oscuro",
    lighter: "más claro",
    cooler: "más frío",
    warmer: "más cálido",
    duller: "más apagado",
    moreSat: "más saturado",
    much: "muy ",
    aBit: "un poco ",
    slightlyW: "ligeramente ",
    valClose: "tus valores están cerca",
    valBalanced: "tus valores fallan por zonas pero equilibran en general",
    valRun: "tus valores están {mag}{dir}",
    mixTemp: "la mezcla está {mag}{dir}",
    satState: "{mag}{dir}",
    colorMatched: "el color está bien igualado",
  },
};

const DICTS: Record<Lang, Dict> = { en, es };

function lookup(dict: Dict, path: string): string | undefined {
  const parts = path.split(".");
  let cur: string | Dict | undefined = dict;
  for (const p of parts) {
    if (typeof cur !== "object" || cur == null) return undefined;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function translate(
  lang: Lang,
  key: string,
  params?: Record<string, string | number>
): string {
  let s = lookup(DICTS[lang], key) ?? lookup(en, key) ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      // Function replacement so `$` sequences in a VALUE (a user-typed palette
      // or project name containing "$&", "$'"…) are inserted literally instead
      // of being expanded as replacement patterns.
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), () => String(v));
    }
  }
  return s;
}

export function useT(): {
  lang: Lang;
  t: (key: string, params?: Record<string, string | number>) => string;
} {
  const lang = useLang();
  return { lang, t: (key, params) => translate(lang, key, params) };
}
