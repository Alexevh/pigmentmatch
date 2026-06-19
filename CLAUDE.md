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
    color.ts        hex/rgb/hsl/Lab conversions, deltaE (CIE76), matchScore,
                    analyzeColor (painter analysis), buildVariations
    pigments.ts     Pigment type; DEFAULT (Traditional Oil 8), WINSOR_NEWTON (25),
                    CORFIX (19); makeX palettes; PALETTE_PRESETS; libraryPigments();
                    isEnabled()
    mixer.ts        subtractive mixing + recipe generator (the heart)
    coach.ts        directional mixing advice from Lab deltas
    calibration.ts  fit pigment tinting strengths to the painter's real mixes
    extract.ts      k-means dominant-color extraction (Lab) + relationship hints
    storage.ts      localStorage (palettes, active id, observations, calibration)
  hooks/
    usePalettes          palettes CRUD + active selection + presets/library
    useRecipeUnit        "parts" | "percent" display (persisted)
    useRecipeMode        "simple" | "precise" (default simple, persisted)
    useCalibration       per-palette observations + fitted calibration
    useCalibratedEngine  global on/off for the calibrated model (default off)
  components/
    ColorInput, Swatch, RecipeView, AnalysisView, VariationsView,
    PaletteManager (+ PigmentLibrary, availability checkbox, preset dropdown),
    ImageSampler (magnifier loupe, default off), PaletteExtractor,
    CoachView, CalibrateView, ResultPanel, ui/ (button/card/input/tabs/...)
  App.tsx           tabs: Match · Image · Extract · Coach · Calibrate · Palette
```

## How the recipe engine works (`mixer.ts`)

- Pigments mix **subtractively**, so we use a **single-constant Kubelka-Munk**
  approximation per sRGB channel, weighted by each pigment's `strength`
  (`mixColor` / `mixKS`). Blue+yellow drifts to green, white dilutes correctly.
- `generateRecipe(target, pigments, mode)` searches for the proportions whose
  predicted mix is closest to the target in **CIE Lab (ΔE)**: single-pigment
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
- `matchScore(dE) = round(clamp(100 - dE*1.5, 0, 100))`.

## Features (all shipped)

- **Match / Image / Extract** tabs produce recipes; **Image** has a click-to-
  sample canvas with an optional magnifier loupe (off by default).
- **Recipe display:** Simple/Precise and Parts/% toggles (in `RecipeView`).
- **Coach:** given target + current mix, gives value/saturation/hue advice.
- **Palette:** create/rename/delete/reset palettes; per-pigment editor
  (color/opacity/temperature/strength); **availability checkbox** (`enabled`)
  to exclude a tube without deleting it; **preset dropdown** (add a whole
  preset); **Add from library** (cherry-pick individual pigments from any
  preset into the active palette).
- **Calibrate (optional):** record "I mixed these parts → got this color"
  observations, fit each pigment's tinting strength (coordinate descent), and
  toggle the calibrated model on globally. Off by default; per-palette.

`App.tsx` filters to `enabledPigments` then applies calibration → these
`effectivePigments` feed Match/Image/Extract/Coach. Palette & Calibrate see the
full list.

## Known limitations / roadmap

- Pigment data is estimated, not measured (see Conventions). Calibration only
  fits **tinting strength**, not masstone color.
- No real blue in the Corfix kit beyond phthalo/turquoise + Payne's Gray, so
  mid-blues match poorly there (expected).
- Roadmap: full multi-constant **spectral Kubelka-Munk** (would need RGB→
  spectrum reconstruction, e.g. Mallett-Yuksel); calibrate more than strength;
  optional palette import/export (JSON) for backup/sharing across devices.
