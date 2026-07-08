# Scene / Zone Mode — Spec

## Goal
Evolve Pigment Match from a colorimeter ("what mix reproduces this pixel?") into
a painter's assistant ("what mix makes this **zone** read correctly **within the
scene**?"). Instead of one pixel, analyze a region **relative to a profile of the
whole reference** (warm light ⇒ cool shadows, relative value/chroma, etc.) and
recommend a context-aware mix — not just the literal color.

## Non-negotiables
- **100% additive / backwards compatible.** New tab (`scene`), new pure lib
  (`src/lib/scene.ts`), new image slot (`scene.reference`). No change to the
  mixing engine, existing recipes, other tabs, or saved data. Everything opt-in.
- **Local-first, no AI, no deps.** Pure canvas + Lab math, reusing existing libs
  (`color.ts`, `mixer.ts`, `extract.ts` sampling, `RecipeView`).
- **Honest / guidance, not truth.** It's perception; photos lie (WB/exposure).
  Detected light temperature is user-overridable. Framed as advice.

## Concepts / algorithm

### 1. Scene profile (computed once per reference)
Downsample the image to ~12k sampled pixels (reuse Extract's step sampling),
convert to Lab, then:
- **Light/shadow split**: Otsu threshold on L\* → `split`.
- **Light family** = pixels with L\* ≥ split; **Shadow family** = L\* < split.
- `lightLab`, `shadowLab` = mean Lab of each family.
- **Warm/cool scalar**: `warmCool(lab) = 0.4*a + 0.6*b` (Lab: +b yellow/warm,
  −b blue/cool; +a red/warm, −a green/cool). Positive = warm.
- `lightTemp = warmCool(lightLab)`, `shadowTemp = warmCool(shadowLab)`.
- `polarity`: `warm-light` if `lightTemp > shadowTemp`, else `cool-light`
  (the amount `|lightTemp − shadowTemp|` is the scene's temperature spread).
- `chromaMean`, `chromaMax` = mean / p95 of hypot(a,b).
- `key`: high / mid / low from mean L\*.

### 2. Zone analysis (a dragged region, ~box)
For the pixels inside the selection:
- `mean` Lab (the base color).
- `contrast` = stdev of L\* (edge vs flat).
- `family`: `light` if mean.L ≥ split+δ, `shadow` if ≤ split−δ, else `halftone`.
- `chromaRel` = zoneChroma − chromaMean (more/less saturated than the scene).
- `warm` = warmCool(mean).

### 3. Advice engine (the assistant)
Given zone + profile + the active palette pigments, produce:
- **Warm/cool relational nudge** (flagship): if the scene is warm-light and the
  zone is a shadow that is *warmer* than the shadow family expects, recommend
  cooling it (and vice-versa for cool-light scenes / light-family zones). The
  nudge magnitude scales with how far the zone's temp sits from the family's.
- **Adjusted target color**: nudge the zone's mean Lab along the warm/cool axis
  by the recommended amount → `adjustedRgb`.
- **Pigment to add**: pick from the ACTIVE palette the coolest (or warmest)
  pigment by `warmCool(masstone)`, plus an estimated small % (2–6%).
- **Chroma hint** (secondary): if `chromaRel` is high for a shadow/turning form,
  suggest knocking it back.
- **Value hint** (secondary): where the zone sits in the scene's value range.
- Output is a structured object + localized sentences (like `coach.ts`), plus
  the two recipes below.

### 4. Two recipes, side by side
- **Measured**: `generateRecipe(zoneMean, pigments, …)` — faithful to the pixel.
- **Scene-adjusted**: `generateRecipe(adjustedRgb, pigments, …)` — the context
  recommendation. The painter compares and chooses. Both honor the active
  recipe settings (mode/engine/limits) via the existing hooks + `RecipeView`.

## Data shapes (scene.ts)
```
warmCool(lab): number
interface SceneProfile { split; lightLab; shadowLab; lightTemp; shadowTemp;
  polarity: "warm-light"|"cool-light"|"flat"; tempSpread; chromaMean; chromaMax;
  key: "high"|"mid"|"low"; }
interface ZoneAnalysis { mean: RGB; lab; contrast; family:"light"|"halftone"|"shadow";
  chromaRel; warm; }
interface SceneAdvice { adjustedRgb: RGB; addPigment?: {pigment; percent}; tips:
  {id; text; swatchHex?}[]; headline; }
buildSceneProfile(pixels: RGB[]): SceneProfile
analyzeZone(pixels: RGB[], profile): ZoneAnalysis
sceneAdvice(zone, profile, pigments, lang): SceneAdvice
```

## UI (SceneView, new `scene` tab)
- Upload/camera a reference (persisted to `scene.reference` via `useActiveImage`,
  so it syncs like other images). Canvas with **drag-to-select a zone** (reuse
  the box-selection pattern from `PaletteExtractor`); default zone = a centered
  ~100×100 box.
- **Scene profile card**: light vs shadow swatches + temps, polarity ("warm light
  → cool shadows"), key. An **override** toggle to flip/disable the light polarity
  (photos lie).
- **Zone card**: family (light/halftone/shadow), relative value/chroma, temp.
- **Advice card**: the headline + tips (with pigment chips + %), then the two
  recipes (`RecipeView compact`): Measured vs Scene-adjusted.
- All strings under i18n `scene.*` (EN/ES).

## Build order (each a commit, build+tests green)
1. `scene.ts` + `scene.test.ts` (Otsu, warmCool, profile invariants, advice
   direction: warm-light shadow → cooling suggestion).
2. `SceneView` + i18n + `scene.reference` slot; wire the `scene` tab into App
   (additive), pass `effectivePigments` + palette switcher.
3. Version bump + release notes (EN/ES) + CLAUDE.md + manuals note.

## Limits / future
- Light **direction** is intentionally NOT auto-detected (unreliable from a 2D
  photo); we do light/shadow **family + temperature**, which is robust. Direction
  could be a future manual hint.
- Simultaneous-contrast (neighbor-relative) nudges and a live hover HUD are
  future iterations on top of this foundation.
