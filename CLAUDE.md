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
- **Recipe display:** Classic/Spectral (mixing model), Simple/Precise, and
  Parts/% toggles (in `RecipeView`).
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
    data.
  - Further spectral search tuning (e.g. multi-start refine).
  - Calibrate more than strength (masstone / K&S).
  - Palette import/export (JSON) for backup/sharing across devices.
  - artistpigments.org has measured spectral curves + undertone tinting strips
    but is view-only (no reusable data license) — reference only, or ask the
    author.
