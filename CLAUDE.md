# CLAUDE.md — Pigment Match

Context for resuming work on this project. Read this first.

## What this is

A **local-first web app for oil painters** that turns a target color (HEX / RGB
/ picked or sampled from an image) into an approximate **paint-mixing recipe**
using a customizable palette of real pigments, and describes color in painter
terms (value / temperature / saturation / hue) rather than math.

- **No backend.** Everything runs in the browser; state persists in
  `localStorage`. Designed as a personal/local tool.
- **Live:** https://alexevh.github.io/pigmentmatch/ (GitHub Pages)
- **Repo:** `Alexevh/pigmentmatch` · branch **`main`** · local git user **Alex
  / alex2005.uy@gmail.com** (set per-repo, not global).

## Localization (i18n)

English (default) + Spanish, toggled in the header (persisted to localStorage).
Strings live in `src/lib/i18n.ts` (nested `en`/`es` dicts); components call
`const { lang, t } = useT()` and `t("key.path", {params})`. Generated sentences
(painter analysis, coach tips, scorecard, relationship hints) are localized too:
the lib functions (`coach`, `scoreCompare`, `renderDiff`, `relationshipHint`,
`analysisSentence`) take a `lang` param and look strings up via `translate()`.
Pigment names and HEX/RGB are intentionally NOT translated. When adding UI text,
add a key to BOTH `en` and `es` rather than hardcoding a string.

## Conventions (important)

- **NEVER add a `Co-Authored-By: Claude` trailer** (or any Claude attribution)
  to commit messages. History was already scrubbed of it once — do not
  reintroduce it.
- **Commit messages via PowerShell here-strings break if they contain double
  quotes** (`"`). Write commit bodies without `"`.
- Commit/push only when the user asks. Pushing to `main` auto-deploys.
- Pigment RGB/opacity/strength values are **informed estimates** from Colour
  Index (CI) codes + color theory, **not measured data**. Always frame them as
  starting points; real accuracy comes from sampling swatches or calibrating.

## Stack & tooling

React + TypeScript + Vite (v8) · Tailwind v3 · shadcn-style components · Lucide
icons · dark mode. Path alias `@` → `src`. Vite `base: "./"` (relative) so the
static build works from any host or subpath.

**PWA:** installable + offline via `vite-plugin-pwa` (Workbox `generateSW`),
configured in `vite.config.ts` with `registerType: "prompt"`, a relative
`scope`/`start_url` (`"./"`) for the Pages subpath, and `palette.svg` as the
(any+maskable) icon. `PwaUpdater` (`virtual:pwa-register/react`) shows a toast
when a new build is deployed so the SW never silently serves a stale cache —
strings under i18n `pwa.*`. The AI model weights (CDN, cross-origin) are NOT
precached, so AI still needs a connection the first time.

```bash
npm run dev      # dev server
npm run build    # tsc -b && vite build  (always run before committing logic)
npm run preview  # preview the production build
```

**Deploy:** `.github/workflows/deploy.yml` builds and publishes to GitHub Pages
on every push to `main`. It uses `npm install` (NOT `npm ci`) on Node 22 —
`npm ci` failed over cross-platform optional-dep drift (`@emnapi`) in the
lockfile. Pages source must be set to "GitHub Actions" in repo settings (done).

**Testing lib logic without the UI:** Node can't run the `.ts` files directly
(extensionless relative imports). Write a temp `*.mts`, then:
```bash
npx esbuild test.mts --bundle --format=esm --platform=node --outfile=.t.mjs && node .t.mjs
```
Clean up the temp files afterward.

## Architecture

```
src/
  lib/
    i18n.ts         EN/ES localization: lang store, dictionary, translate()/useT()
    describe.ts     localized painter-analysis sentence (shared by Analysis + Extract)
    compare.ts      reference-vs-WIP: 4-corner homography warp, Lab fields,
                    value/color diff maps, histogram, scorecard
    color.ts        hex/rgb/hsl/Lab conversions, deltaE (CIE76) + deltaE2000, matchScore,
                    analyzeColor (painter analysis), buildVariations
    pigments.ts     Pigment type; DEFAULT (Traditional Oil 8), WINSOR_NEWTON (25),
                    CORFIX (19); makeX palettes; PALETTE_PRESETS; libraryPigments();
                    isEnabled()
    mixer.ts        subtractive mixing + recipe generator (the heart)
    coach.ts        directional mixing advice from Lab deltas
    calibration.ts  fit pigment tinting strengths to the painter's real mixes
    extract.ts      k-means dominant-color extraction (Lab) + relationship hints
    storage.ts      localStorage (palettes, active id, observations, calibration)
    logbook.ts      IndexedDB store for the Bitácora: projects + color entries
                    (photos stored as Blobs), image downscale, JSON export/import
    imagefx.ts      IMG Lab image processing: pixel adjustments (computeAdjusted)
                    + lazy AI (upscaleImage/restoreImage via UpscalerJS+TF.js)
  hooks/
    usePalettes          palettes CRUD + active selection + presets/library
    useRecipeUnit        "parts" | "percent" display (persisted)
    useRecipeMode        "simple" | "precise" (default simple, persisted)
    useCalibration       per-palette observations + fitted calibration
    useCalibratedEngine  global on/off for the calibrated model (default off)
  components/
    ColorInput, Swatch, RecipeView, AnalysisView, VariationsView,
    PaletteManager (+ PigmentLibrary, availability checkbox, preset dropdown),
    ImageSampler (sampling only: upload/camera, in-box +/- zoom 1-10x with
      drag-to-pan via CSS transform + eyedropper cursor, magnifier loupe default
      off, click to pick). All image EDITING moved to the IMG Lab tab.
    ImgLabView (IMG Lab tab: dedicated image-processing page using imagefx.ts —
      sectioned cards for Adjustments (sliders, live, no deps), AI enhance
      (ESRGAN slim/medium/thick super-resolution, lazy-loaded), and an optional
      **Cloud AI — Gemini "Nano Banana"** (bring-your-own API key in
      localStorage, called from the browser via `cloudEnhance` in imagefx.ts —
      no backend; also covers deblur/denoise/low-light via prompt). A prominent
      "AI is experimental / heavy local resources" warning, a zoom/pan
      inspector, and Download to PNG. NOTE: local MAXIM restoration was removed —
      its global einsum overflows the WebGL texture limit regardless of input,
      so it can't run in the browser),
    PaletteExtractor,
    CoachView, CalibrateView, CompareView, MixCheckView, LogbookView, ResultPanel, ui/
    HelpView (Help tab: About/purpose, Release notes, FAQ — <details> accordions;
      bilingual content lives in the component, not i18n)
  version.ts        APP_VERSION ("1.0"), shown next to the header title + release notes
  App.tsx           tabs: Match · Image · Extract · Coach · Compare · Mix · Logbook · IMG Lab · Calibrate · Palette · Help
```

## How the recipe engine works (`mixer.ts`)

- Pigments mix **subtractively**, so we use a **single-constant Kubelka-Munk**
  approximation per sRGB channel, weighted by each pigment's `strength`
  (`mixColor` / `mixKS`). Blue+yellow drifts to green, white dilutes correctly.
- `generateRecipe(target, pigments, mode)` searches for the proportions whose
  predicted mix is closest to the target in **CIE Lab using ΔE2000** (CIEDE2000,
  perceptual; CIE76 is kept only for fast k-means clustering in extraction):
  single-pigment
  seeds → random sparse restarts (1–4 pigments) → hill-climbing. Deterministic
  (seeded PRNG; no `Math.random`).
- **`reduceWeights`** then drops pigments greedily while staying within a ΔE
  tolerance: **precise = 0.5** (trim search noise), **simple = 2.0** (favor a
  few practical pigments). A pigment is only dropped if removing it stays within
  tolerance, so load-bearing touches (e.g. the warm tint in a near-white) are
  kept.
- **`buildRecipe` recomputes ΔE/match from exactly the displayed weights** — the
  score must always match the recipe shown. (A past bug showed "100% white" at
  99% when white alone was 91%; this is the fix — do not regress it.)
- `matchScore(dE) = round(clamp(100 - dE*1.5, 0, 100))` (dE is now ΔE2000).
- Recipe matching, scoring, the Coach and calibration all use **ΔE2000**
  (`deltaE2000` in color.ts, validated against the Sharma reference 2.0425).
  Method adopted from the Mohammadi/Berns RIT 2004 report (same single-constant
  K-M as ours). That report also points at **NNLS** (non-negative least squares)
  as a direct, deterministic recipe solver — only worthwhile with spectral data
  (many bands), so it's a future upgrade for the spectral engine using
  spectral.js's per-pigment K/S curves, not the 3-channel RGB classic engine.

## Features (all shipped)

- **Match / Image / Extract** tabs produce recipes; **Image** has a click-to-
  sample canvas with an optional magnifier loupe (off by default).
- **Camera capture (local):** `CameraCapture` (reusable modal) opens the device
  camera via `getUserMedia` (PC webcam or phone camera; rear/front flip), draws
  a frame to a canvas, and returns a JPEG `Blob`. Stream stays in the browser —
  no backend; needs a secure context (HTTPS/localhost), which Pages provides.
  Wired into every photo input: `ImageSampler` (Image/Mix/Coach/Calibrate), the
  Logbook `PhotoField` (swatch/reference), and Compare's `Dropzone`
  (reference/WIP). Strings under i18n `camera.*`.
- **Recipe display:** Classic/Spectral (mixing model), Simple/Precise, and
  Parts/% toggles (in `RecipeView`); the recipe card header shows a minimal
  **active-palette chip that doubles as a palette switcher**
  (`PaletteChipSelect`: pill + dropdown, not the Palette-tab `<select>`; App
  passes `palettes`/`activeId`/`onSelectPalette` → `ResultPanel`). The variation
  modal shows the same name as a static chip. A **"What do these options do?"**
  link
  (on its own line above the toggles) opens `OptionsHelpModal` explaining all
  three toggles in plain language (content under i18n `recipeHelp.*`); shown
  only in the full (`!compact`) recipe view.
- **Mixing engines (pluggable):** `generateRecipe(target, pigments, mode,
  engine)`. `classic` = our single-constant K-M per RGB channel (default).
  `spectral` = **spectral.js** (MIT, npm) — reconstructs a full reflectance
  curve from each pigment's sRGB (Scott Burns LHTSS) and mixes with K-M across
  the spectrum; opt-in/experimental. `buildMix()` picks the backend; both feed
  the same search/reduce/buildRecipe. The search budget is engine-aware:
  `spectral` gets more restarts + a longer hill-climb with re-heating
  (`isSpectral` branches in `generateRecipe`); the `classic` path keeps its
  exact original numbers (byte-identical output). Tricky colors (e.g. muted
  greens in a limited palette) can still match a bit worse under spectral.
- **Coach:** given target + current mix, gives value/saturation/hue advice.
- **Variation recipes:** each of the 6 variation swatches (lighter/darker/
  warmer/cooler/more-less saturated) has a **"How to mix it"** link opening
  `VariationRecipeModal` (in `VariationsView`): shows the base color's recipe
  (`generateRecipe`, compact, honoring the active mode/engine) plus the
  adjustment to reach the variation (`coach(variation, base)`) — i.e. base mix +
  what to add. Strings under i18n `variationRecipe.*`. Needs `pigments` (passed
  from `ResultPanel`).
- **Palette:** create/rename/delete/reset palettes; per-pigment editor
  (color/opacity/temperature/strength); **availability checkbox** (`enabled`)
  to exclude a tube without deleting it; **preset dropdown** (add a whole
  preset); **Add from library** (cherry-pick individual pigments from any
  preset into the active palette).
- **Compare:** upload a reference + a work-in-progress photo, align each with a
  4-corner perspective warp (de-keystone), then critique: swipe/onion-skin
  overlay with a squint (blur) slider; value views (grayscale, notan
  posterization, value-difference heatmap, value histogram); color difference
  heatmaps (ΔE / temperature / saturation / hue); click-a-region → Coach;
  side-by-side palette extraction; and a scorecard (value & color accuracy,
  bias readouts, plain-language summary). Optional "normalize lighting" toggle
  shifts the WIP's mean Lab to the reference to ignore exposure/WB differences.
  Value & relative comparisons are emphasized as the trustworthy ones.
- **Mix:** two image samplers — sample the target color from a reference photo
  and the actual paint from a photo of the palette mix; shows each color's
  painter description, a value scale with both marked (+ ΔL / lighter-darker),
  and the Coach's color advice with a match %. (Focused two-photo cousin of
  Coach; reuses ImageSampler, coach(), analysisSentence.)
- **Calibrate (optional):** record "I mixed these parts → got this color"
  observations, fit each pigment's tinting strength (coordinate descent), and
  toggle the calibrated model on globally. Off by default; per-palette.
- **Logbook (Bitácora):** a painter's notebook of color mixes grouped into
  **projects**. Each color **entry** holds a name, a free-text recipe, notes, an
  optional swatch color chip, and optional **swatch + reference photos**. Full
  CRUD; per-project. The chip color can be picked with a native color input or
  **sampled by clicking the uploaded swatch photo** (`SwatchSampler` in
  `LogbookView` draws the stored Blob to a canvas and reads a pixel). **Storage is IndexedDB, not localStorage** (`logbook.ts`):
  photos are stored as **Blobs** (no base64 bloat, large quota) and downscaled
  to ≤1000px JPEG on upload. **Export/Import** is a single self-contained JSON
  file with images inlined as base64 data URLs (portable backup; base64 only in
  the export, not the live store). Import merges with fresh ids (never clobbers).
  Independent of palettes/effectivePigments — it's a reference log, not a recipe
  generator. A **"How is my data stored?"** link opens `StorageInfoModal` (in
  `LogbookView`) explaining localStorage vs IndexedDB, per-browser caveats, and
  backup/restore — content under i18n `logbook.storage.*`.

`App.tsx` filters to `enabledPigments` then applies calibration → these
`effectivePigments` feed Match/Image/Extract/Coach. Palette & Calibrate see the
full list.

## Pending tasks (next sessions)

- **Refine preset pigment RGB/opacity from artistpigments.org measured data.**
  In progress with the user, one tube at a time. The site lists a measured
  **CIE L\*a\*b\* (D50, 2°)** and a **Transparency** flag per paint. Workflow:
  1. The user reads the values off the **correct product line** (W&N **Artists'
     Oil**, not Griffin Alkyd; Corfix's line) for a given tube.
  2. Convert Lab(D50) → sRGB and set the pigment's `rgb`; set `opacity` from the
     Transparency flag (Transparent ≈ 0.3, Semi ≈ 0.5, Opaque ≈ 0.9).
  3. Update the entry in `pigments.ts` (replaces the eyeballed estimate).
  This turns the presets from estimates into measurement-grounded values. Manual
  per-tube reference use only (no bulk copy of their DB).

  Lab(D50)→sRGB recipe (verified): Lab→XYZ with D50 white
  (Xn 0.96422, Yn 1, Zn 0.82521) → Bradford-adapt D50→D65 → XYZ(D65)→linear
  sRGB (standard matrix) → gamma-encode → ×255. Example: W&N-ish Winsor Yellow
  L*85.43 a*8.88 b*91.48 → `#FFCD00` (vs the prior `#FAC814` estimate).

  **Progress (W&N Artists', 25 tubes): 11 refined from measured Lab** —
  Titanium White (neutralized from cream), Ivory Black, Raw Umber, Burnt Umber,
  Burnt Sienna, Yellow Ochre, French Ultramarine, Permanent Alizarin Crimson,
  Payne's Gray, Pale Rose Blush (Griffin fallback), Winsor Yellow. Comments on
  those entries say "measured Lab". **14 remain** (Terra Rosa, Venetian Red,
  Cadmium Red, Cadmium Red Deep Hue, Naples Yellow, Cadmium Yellow Hue, Lemon
  Yellow Hue, Cadmium Yellow Deep Hue, Permanent Rose, Quinacridone Deep Pink,
  Cobalt Violet, Dioxazine Blue, Cerulean Blue, Viridian Green) — these have
  **no published CIE Lab** (Artists' pages lack it, not in Griffin, not on
  W&N's site), so their color stays an estimate; refine via swatch sampling or
  calibration. NEXT: the user will provide each remaining tube's **transparency**
  (read off the physical tube) so we can at least fix their `opacity` without
  needing Lab. Corfix (19 tubes) is all estimates — not yet refined.

## Known limitations / roadmap

- Pigment data is estimated, not measured (see Conventions). Calibration only
  fits **tinting strength**, not masstone color.
- No real blue in the Corfix kit beyond phthalo/turquoise + Payne's Gray, so
  mid-blues match poorly there (expected).
- The **spectral** engine (spectral.js, opt-in) is single-constant K-M
  (scattering assumed constant), not full two-constant. Its search is tuned
  separately from classic but still weaker on some hard colors.
- We store only a single masstone RGB per pigment, so **undertone** (the
  color a pigment shows thinned / glazed / tinted — e.g. ultramarine goes
  violet, phthalo goes cyan) is NOT modeled. Two pigments with similar masstone
  but different undertone look identical to us.
- Opacity is stored but **not used by the mixing math** — it's metadata only.
  Using it properly means two-constant K-M (opacity → scattering coefficient
  S); a naive "weight × opacity" would be wrong (transparent pigments like
  phthalo are very strong tinters).
- Roadmap, possible improvements:
  - **Undertone**: add a second per-pigment color (the tint/undertone), or use
    a measured spectral curve, so thinned/glazed/tinted behavior is correct.
  - **Two-constant K-M** using opacity as scattering S — mainly helps
    transparent+opaque mixes and glazing/layering (which we don't simulate);
    modest gain on flat opaque mixes. Biggest engine change; wants calibrated
    data. REFERENCE: Roy Berns / RIT Munsell Color Science Lab built exactly
    this (two-constant K-M + Saunderson correction) with measured K/S for the
    **Gamblin Conservation Colors** set + a %-recommendation matching tool. It's
    the canonical method — but the data is for conservation paints (not W&N/
    Corfix) and availability/license is unconfirmed. Could power a real
    two-constant engine for a Gamblin-Conservation-Colors preset if obtained.
  - Further spectral search tuning (e.g. multi-start refine).
  - Calibrate more than strength (masstone / K&S).
  - Palette import/export (JSON) for backup/sharing across devices.
  - artistpigments.org has measured spectral curves + undertone tinting strips
    but is view-only (no reusable data license) — reference only, or ask the
    author.
